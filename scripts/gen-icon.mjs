// Generates the FridgeForage app icons from one SVG mark (a fridge with a fresh
// leaf — "fresh food, less waste") in the brand green→teal gradient.
// Run: npm i -D sharp && node scripts/gen-icon.mjs
import sharp from 'sharp';

const GRAD = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#34D399"/>
  <stop offset="0.55" stop-color="#10B981"/>
  <stop offset="1" stop-color="#0D9488"/>
</linearGradient></defs>`;

function mark(scale = 1, cx = 512, cy = 512) {
  return `<g transform="translate(${cx} ${cy}) scale(${scale}) translate(-512 -516)">
    <rect x="350" y="360" width="324" height="472" rx="52" fill="#ffffff"/>
    <rect x="350" y="500" width="324" height="14" rx="7" fill="#0F766E"/>
    <rect x="388" y="406" width="18" height="72" rx="9" fill="#0F766E"/>
    <rect x="388" y="540" width="18" height="244" rx="9" fill="#0F766E"/>
    <rect x="505" y="352" width="14" height="44" rx="7" fill="#ffffff"/>
    <g transform="translate(512 296) rotate(16)">
      <path d="M0 96 C -58 62, -58 -54, 0 -100 C 58 -54, 58 62, 0 96 Z" fill="#ffffff"/>
      <path d="M0 82 L0 -82" stroke="#0F766E" stroke-width="10" stroke-linecap="round"/>
    </g>
  </g>`;
}

const svg = (bg, scale) =>
  `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${GRAD}` +
  (bg ? '<rect width="1024" height="1024" fill="url(#g)"/>' : '') +
  `${mark(scale)}</svg>`;

const gradOnly =
  `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">${GRAD}<rect width="1024" height="1024" fill="url(#g)"/></svg>`;

async function png(svgStr, out, size = 1024) {
  await sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(out);
  console.log('wrote', out);
}

const A = 'assets/images/';
await png(svg(true, 0.9), A + 'icon.png', 1024);
await png(svg(false, 0.62), A + 'android-icon-foreground.png', 1024);
await png(svg(false, 0.62), A + 'android-icon-monochrome.png', 1024);
await png(svg(false, 0.66), A + 'splash-icon.png', 1024);
await png(gradOnly, A + 'android-icon-background.png', 1024);
await png(svg(true, 0.9), A + 'favicon.png', 196);
console.log('done');
