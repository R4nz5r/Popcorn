const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
  const publicDir = path.join(__dirname, '..', 'public');

  // 1. Generate 1200x630 OpenGraph Banner for WhatsApp/Twitter/Facebook
  const svgCard = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#1f1d19"/>
      <stop offset="60%" stop-color="#121110"/>
      <stop offset="100%" stop-color="#0a0908"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#fef08a"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <mask id="carton-mask">
      <path d="M14 26 L19.5 56 C20 57.5 21.5 58.5 23.5 58.5 L40.5 58.5 C42.5 58.5 44 57.5 44.5 56 L50 26 Z" fill="#FFFFFF"/>
    </mask>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Glow effect -->
  <circle cx="600" cy="230" r="320" fill="url(#glow)"/>

  <!-- Popcorn Bucket Icon (Scaled up) -->
  <g transform="translate(515, 60) scale(2.65)">
    <!-- Popcorn Kernels -->
    <circle cx="23" cy="17" r="7.5" fill="#FDE047" stroke="#CA8A04" stroke-width="2"/>
    <circle cx="33" cy="13" r="8.5" fill="#FEF08A" stroke="#CA8A04" stroke-width="2"/>
    <circle cx="43" cy="18" r="7" fill="#FDE047" stroke="#CA8A04" stroke-width="2"/>
    <circle cx="16" cy="24" r="6" fill="#FEF08A" stroke="#CA8A04" stroke-width="2"/>
    <circle cx="27" cy="22" r="7.5" fill="#FBBF24" stroke="#CA8A04" stroke-width="2"/>
    <circle cx="38" cy="21" r="7" fill="#FDE047" stroke="#CA8A04" stroke-width="2"/>
    <circle cx="48" cy="24" r="5.5" fill="#FEF08A" stroke="#CA8A04" stroke-width="2"/>

    <!-- Popcorn Bucket Base -->
    <path d="M14 26 L19.5 56 C20 57.5 21.5 58.5 23.5 58.5 L40.5 58.5 C42.5 58.5 44 57.5 44.5 56 L50 26 Z" fill="#E11D48" stroke="#9F1239" stroke-width="2.5" stroke-linejoin="round"/>

    <!-- Vertical White Stripes -->
    <g mask="url(#carton-mask)">
      <polygon points="20,26 23.5,58.5 28.5,58.5 26.5,26" fill="#FFFFFF"/>
      <polygon points="35.5,26 35.5,58.5 40.5,58.5 42.5,26" fill="#FFFFFF"/>
    </g>

    <!-- Bucket Rim -->
    <path d="M13 26 C22 28 42 28 51 26" stroke="#9F1239" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <!-- Title -->
  <text x="600" y="340" font-family="Arial, Helvetica, sans-serif" font-size="76" font-weight="900" fill="url(#gold)" text-anchor="middle" letter-spacing="-2">Popcorn</text>

  <!-- Tagline -->
  <text x="600" y="410" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="600" fill="#E5E7EB" text-anchor="middle">Sync any video with friends, live</text>

  <!-- Pills -->
  <rect x="290" y="475" width="180" height="48" rx="24" fill="#1c1b18" stroke="#f59e0b" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="380" y="506" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="bold" fill="#FBBF24" text-anchor="middle">YouTube Sync</text>

  <rect x="500" y="475" width="200" height="48" rx="24" fill="#1c1b18" stroke="#f59e0b" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="600" y="506" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="bold" fill="#FBBF24" text-anchor="middle">Live Chat &amp; Reacts</text>

  <rect x="730" y="475" width="180" height="48" rx="24" fill="#1c1b18" stroke="#f59e0b" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="820" y="506" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="bold" fill="#FBBF24" text-anchor="middle">Screen Sharing</text>
</svg>
`;

  await sharp(Buffer.from(svgCard))
    .png({ quality: 85, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'og-image.png'));
  console.log('Created public/og-image.png');

  // 2. Generate 512x512 Popcorn Icon PNG
  const svgIcon = fs.readFileSync(path.join(publicDir, 'popcorn.svg'));
  await sharp(svgIcon)
    .resize(512, 512)
    .png({ quality: 90 })
    .toFile(path.join(publicDir, 'popcorn.png'));
  console.log('Created public/popcorn.png');

  // 3. Generate 180x180 Apple Touch Icon PNG
  await sharp(svgIcon)
    .resize(180, 180)
    .png({ quality: 90 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Created public/apple-touch-icon.png');
}

main().catch(console.error);
