const sharp = require('sharp');
const path = require('path');

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <rect x="120" y="160" width="272" height="224" rx="24" fill="white"/>
  <rect x="120" y="200" width="272" height="8" fill="#0ea5e9"/>
  <rect x="160" y="120" width="24" height="80" rx="12" fill="white"/>
  <rect x="328" y="120" width="24" height="80" rx="12" fill="white"/>
  <rect x="152" y="244" width="40" height="40" rx="8" fill="#0ea5e9"/>
  <rect x="236" y="244" width="40" height="40" rx="8" fill="#0ea5e9"/>
  <rect x="320" y="244" width="40" height="40" rx="8" fill="#0ea5e9"/>
  <rect x="152" y="308" width="40" height="40" rx="8" fill="#0ea5e9"/>
  <rect x="236" y="308" width="40" height="40" rx="8" fill="#0ea5e9"/>
</svg>`);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
Promise.all(sizes.map(s =>
  sharp(svg).resize(s, s).png().toFile('public/icons/icon-' + s + 'x' + s + '.png')
)).then(() => console.log('All icons generated')).catch(e => console.error(e));
