import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const ALLOWED_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']);

function response(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(payload)
  };
}

function validateTikTokUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Masukkan URL TikTok yang valid.');
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(host) && !host.endsWith('.tiktok.com')) {
    throw new Error('URL harus berasal dari TikTok.');
  }
  if (parsed.username || parsed.password || parsed.port) {
    throw new Error('URL TikTok tidak valid.');
  }
  return parsed.href;
}

function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x([\da-f]{1,6});/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function absoluteUrl(value, base = 'https://tikdownloader.io') {
  if (!value || value === '#') return '';
  try {
    const url = new URL(decodeHtml(value), base);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function extractData(html) {
  const captionMatch = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
  const coverMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  const isDesktop = html.includes('class="video-data"');
  const media = [];
  const add = (type, url) => {
    const normalized = absoluteUrl(url);
    if (normalized && !media.some(item => item.url === normalized)) media.push({ type, url: normalized });
  };

  if (isDesktop) {
    const patterns = [
      ['Video_Watermark', /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?Download MP4\s*\[1\][\s\S]*?<\/a>/i],
      ['Video', /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?Download MP4 HD[\s\S]*?<\/a>/i],
      ['Audio', /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?Download MP3[\s\S]*?<\/a>/i]
    ];
    for (const [type, pattern] of patterns) {
      const match = html.match(pattern);
      if (match) add(type, match[1]);
    }
  }

  const anchorPattern = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let anchor;
  while ((anchor = anchorPattern.exec(html)) !== null) {
    const attrs = `${anchor[1]} ${anchor[3]}`;
    const label = decodeHtml(anchor[4].replace(/<[^>]*>/g, ' ')).toLowerCase();
    const title = (attrs.match(/title=["']([^"']+)["']/i) || [])[1] || '';
    if (/download image/i.test(title) || label.includes('download image')) add('Image', anchor[2]);
    else if (label.includes('mp4 hd')) add('Video', anchor[2]);
    else if (label.includes('mp4 [1]')) add('Video_Watermark', anchor[2]);
    else if (label.includes('mp3')) add('Audio', anchor[2]);
    else if (label.includes('download video') && anchor[2] !== '#') add('Video', anchor[2]);
  }

  const imagePattern = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi;
  let imageAnchor;
  while ((imageAnchor = imagePattern.exec(html)) !== null) {
    const attrs = `${imageAnchor[1]} ${imageAnchor[3]}`;
    if (/title=["']Download Image["']/i.test(attrs)) add('Image', imageAnchor[2]);
  }

  return {
    caption: decodeHtml((captionMatch?.[1] || 'Unknown').replace(/<[^>]*>/g, '').trim()) || 'Unknown',
    cover: absoluteUrl(coverMatch?.[1] || ''),
    media
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).setHeader('Access-Control-Allow-Origin', '*').setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS').setHeader('Access-Control-Allow-Headers', 'Content-Type').end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ status: false, error: 'Gunakan metode POST.' });
  }

  let browser;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const inputUrl = validateTikTokUrl(String(body.url || '').trim());
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 800 },
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (['image', 'stylesheet', 'font', 'media'].includes(request.resourceType())) request.abort().catch(() => {});
      else request.continue().catch(() => {});
    });

    const responsePromise = page.waitForResponse(
      result => result.url().includes('/api/ajaxSearch') && result.request().method() === 'POST',
      { timeout: 30000 }
    );

    await page.goto('https://tikdownloader.io/en', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('#s_input', { timeout: 12000 });
    await page.locator('#s_input').fill(inputUrl);
    await page.waitForSelector('.search-form button', { timeout: 10000 });
    await page.locator('.search-form button').click();

    const rawResponse = await responsePromise;
    const result = await rawResponse.json();
    if (!result || result.status !== 'ok' || typeof result.data !== 'string' || !result.data) {
      throw new Error('Gagal mengambil data. Pastikan link TikTok publik masih tersedia.');
    }

    const html = result.data;
    let convertedVideo = '';
    if (html.includes('id="ConvertToVideo"')) {
      await page.waitForSelector('#ConvertToVideo', { timeout: 8000 }).catch(() => {});
      convertedVideo = await Promise.race([
        page.evaluate(() => new Promise(resolve => {
          window.convertSuccess = value => resolve(value || '');
          window.convertFailed = () => resolve('');
          window.renderFail = () => resolve('');
          const button = document.querySelector('#ConvertToVideo');
          if (button) button.click();
          else resolve('');
        })).catch(() => ''),
        new Promise(resolve => setTimeout(() => resolve(''), 18000))
      ]);
    }

    const data = extractData(html);
    if (convertedVideo) data.media.unshift({ type: 'Video_Converted', url: absoluteUrl(convertedVideo) });
    if (!data.media.length) throw new Error('Link download tidak ditemukan pada hasil scrape.');

    const images = [...new Set(data.media.filter(item => item.type === 'Image').map(item => item.url))];
    return res.status(200).json({
      status: true,
      author: 'SaveTix Team',
      data: {
        ...data,
        type: images.length ? 'photo' : 'video',
        images,
        media: data.media
      }
    });
  } catch (error) {
    return res.status(400).json({
      status: false,
      author_scrape: 'SaveTix Team',
      dedication: 'For SaveTix users',
      error: error?.message || 'Terjadi kesalahan saat memproses link.'
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
