const form = document.querySelector('#download-form');
const input = document.querySelector('#tiktok-url');
const pasteButton = document.querySelector('#paste-button');
const submitButton = document.querySelector('#submit-button');
const loadingState = document.querySelector('#loading-state');
const errorMessage = document.querySelector('#error-message');
const resultsSection = document.querySelector('#results-section');
const resultPreview = document.querySelector('#result-preview');
const resultCaption = document.querySelector('#result-caption');
const resultSubtitle = document.querySelector('#result-subtitle');
const mediaList = document.querySelector('#media-list');
const clearButton = document.querySelector('#clear-button');

const mediaLabels = {
  Video: 'Video HD',
  Video_Converted: 'Video',
  Video_Watermark: 'Video dengan watermark',
  Audio: 'Audio / MP3',
  Image: 'Foto'
};

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function resetResults() {
  resultsSection.hidden = true;
  resultPreview.replaceChildren();
  mediaList.replaceChildren();
  errorMessage.hidden = true;
}

function makeDownloadLink(url, filename) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.download = filename;
  return anchor;
}

function renderResult(data) {
  resultCaption.textContent = data.caption || 'Konten TikTok';
  resultSubtitle.textContent = data.type === 'photo' ? `${data.images?.length || 0} foto ditemukan` : `${data.media.length} opsi file tersedia`;

  if (data.cover) {
    const image = document.createElement('img');
    image.src = data.cover;
    image.alt = 'Preview konten TikTok';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.onerror = () => {
      resultPreview.replaceChildren();
      const icon = document.createElement('i');
      icon.className = 'fa-brands fa-tiktok result-placeholder';
      resultPreview.append(icon);
    };
    resultPreview.replaceChildren(image);
  } else {
    const icon = document.createElement('i');
    icon.className = 'fa-brands fa-tiktok result-placeholder';
    resultPreview.replaceChildren(icon);
  }

  const images = data.media.filter(item => item.type === 'Image');
  if (images.length) {
    const slides = document.createElement('div');
    slides.className = 'slides';
    images.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'slide';
      const image = document.createElement('img');
      image.src = item.url;
      image.alt = `Foto carousel ${index + 1}`;
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      const link = makeDownloadLink(item.url, `savetix-foto-${index + 1}.jpg`);
      link.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i> Simpan';
      link.setAttribute('aria-label', `Simpan foto ${index + 1}`);
      card.append(image, link);
      slides.append(card);
    });
    resultPreview.append(slides);
  }

  const uniqueMedia = data.media.filter((item, index, all) => all.findIndex(candidate => candidate.url === item.url) === index);
  uniqueMedia.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'media-item';
    const label = document.createElement('div');
    label.className = 'media-type';
    label.textContent = mediaLabels[item.type] || item.type.replaceAll('_', ' ');
    const detail = document.createElement('small');
    detail.textContent = item.type === 'Image' ? `Foto ${images.findIndex(image => image.url === item.url) + 1}` : 'Buka file untuk mengunduh';
    label.append(detail);
    const link = makeDownloadLink(item.url, `savetix-${item.type.toLowerCase()}-${index + 1}`);
    link.className = 'media-download';
    link.innerHTML = '<i class="fa-solid fa-download" aria-hidden="true"></i> Download';
    link.setAttribute('aria-label', `Download ${label.textContent}`);
    row.append(label, link);
    mediaList.append(row);
  });

  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

pasteButton.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) input.value = text.trim();
    else input.focus();
  } catch {
    input.focus();
    input.select();
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  resetResults();
  const url = input.value.trim();
  if (!url) return showError('Tempel link TikTok terlebih dahulu.');

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return showError('Format link tidak valid.');
  }
  if (parsed.protocol !== 'https:' || !/(^|\.)tiktok\.com$/i.test(parsed.hostname)) {
    return showError('Masukkan link TikTok yang valid, termasuk link pendek vt.tiktok.com.');
  }

  submitButton.disabled = true;
  submitButton.innerHTML = '<span>Memproses</span><i class="fa-solid fa-spinner fa-spin"></i>';
  loadingState.hidden = false;
  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.status || !result.data) throw new Error(result.error || 'Gagal mengambil data TikTok. Coba lagi nanti.');
    renderResult(result.data);
  } catch (error) {
    showError(error.message || 'Terjadi kesalahan. Periksa koneksi lalu coba lagi.');
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = '<span>Download</span><i class="fa-solid fa-arrow-down"></i>';
    loadingState.hidden = true;
  }
});

clearButton.addEventListener('click', resetResults);
