# SaveTix

TikTok downloader untuk video, foto carousel, dan audio, dibuat untuk deploy di Vercel.

## Fitur

- UI dark-only, hitam dan putih, mobile-first.
- Video, audio, dan foto yang tersedia dari hasil scrape.
- Galeri foto carousel dan tombol download per slide.
- SEO metadata, canonical URL, JSON-LD, robots.txt, sitemap.xml, Open Graph, Twitter Card, dan preview WhatsApp.
- API hanya menerima URL TikTok melalui POST.
- Puppeteer Core dengan Chromium serverless untuk fungsi Vercel.

## Deploy ke Vercel

1. Upload folder proyek ini ke repository Git.
2. Import repository di Vercel.
3. Framework preset pilih `Other`.
4. Build command dan output directory dapat dikosongkan.
5. Deploy. Hubungkan domain `savetix.vercel.app` pada pengaturan proyek jika belum otomatis.

## Development lokal

Memerlukan Node.js 20 atau lebih baru.

```bash
npm install
npx vercel dev
```

## Endpoint

`POST /api/download`

Body JSON:

```json
{
  "url": "https://www.tiktok.com/@username/video/1234567890"
}
```

Respons sukses mengikuti struktur dasar scrape dengan `status`, `author_scrape`, `dedication`, dan `data`. `data` berisi `caption`, `cover`, `media`, `type`, serta `images` untuk foto carousel.

## Catatan operasional

Scraper menggunakan situs pihak ketiga `tikdownloader.io` melalui browser headless. Perubahan UI, endpoint internal, proteksi anti-bot, atau kebijakan situs tersebut dapat menyebabkan proses gagal tanpa perubahan pada SaveTix. Fungsi browser headless memerlukan kuota dan batas waktu Vercel yang sesuai; dukungan durasi maksimum bergantung pada paket Vercel. Uji endpoint setelah deployment.

Link media yang dikembalikan berasal dari layanan sumber. Tombol membuka URL media di tab baru; browser atau host media dapat menentukan apakah file langsung diunduh atau dibuka. Gunakan hanya untuk konten yang kamu miliki atau punya izin untuk menyimpannya.
