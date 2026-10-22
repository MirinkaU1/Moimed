import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = path.join(root, 'assets/modulaires');
const width = 1024, height = 1536;
const blank = () => ({ width, height, data: Buffer.alloc(width * height * 4) });
const save = (file, image) => fs.writeFileSync(path.join(folder, file), PNG.sync.write(image));
const read = file => PNG.sync.read(fs.readFileSync(path.join(folder, 'sources', file)));

// Retirer la faible ombre extérieure générée ; rééchantillonner les contours
// avec alpha prémultiplié pour éviter une frange sombre sur fond clair.
function fit(source, fromDestination) {
  const output = blank();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [sx, sy] = fromDestination(x, y);
    const left = Math.floor(sx), top = Math.floor(sy);
    const fx = sx - left, fy = sy - top;
    const rgba = [0, 0, 0, 0];
    for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
      const px = left + dx, py = top + dy;
      if (px < 0 || px >= source.width || py < 0 || py >= source.height) continue;
      const i = (py * source.width + px) * 4;
      const alpha = Math.max(0, Math.min(1, (source.data[i + 3] - 128) / 112));
      const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * alpha;
      for (let c = 0; c < 3; c++) rgba[c] += source.data[i + c] * weight;
      rgba[3] += weight;
    }
    if (!rgba[3]) continue;
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) output.data[i + c] = Math.round(rgba[c] / rgba[3]);
    output.data[i + 3] = Math.round(rgba[3] * 255);
  }
  return output;
}

const hoodie = fit(read('hoodie.png'), (x, y) => {
  const cuff = Math.max(0, Math.min(1, (y - 750) / 100));
  let alignedX = x;
  if (x > 540 && x < 650 && y < 500) alignedX += 10 * Math.max(0, Math.min(1, (500 - y) / 25)) * Math.min(1, (x - 540) / 15, (650 - x) / 40);
  if (x < 375) alignedX = x * (1 - cuff) + (330 + (x - 324) / 1.2) * cuff;
  if (x > 655) alignedX = x * (1 - cuff) + (700 + (x - 704) / 1.2) * cuff;
  const alignedY = x >= 375 && x <= 655 ? y - 16 * Math.max(0, Math.min(1, (y - 820) / 100)) : y;
  return [512 + (alignedX - 512) / .9, alignedY < 500 ? 435 + (alignedY - 420) * 95 / 80 : 530 + (alignedY - 500) * 420 / 400];
});
const head = PNG.sync.read(fs.readFileSync(path.join(root, 'assets/base/calques/00_peau_tete_cou.png')));
for (let y = 0; y < 453; y++) for (let x = 0; x < width; x++) {
  const i = (y * width + x) * 4;
  hoodie.data[i + 3] = Math.round(hoodie.data[i + 3] * (1 - head.data[i + 3] / 255));
}
const hands = blank();
for (const file of ['01_bras_gauche_image.png', '02_bras_droit_image.png']) {
  const arm = PNG.sync.read(fs.readFileSync(path.join(root, 'assets/base/calques', file)));
  for (let y = 898; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (arm.data[i + 3]) arm.data.copy(hands.data, i, i, i + 4);
  }
}
save('calques/mains.png', hands);
const lowerBody = fit(read('short-jambes.png'), (x, y) => {
  // Remonter la ceinture sous le haut sans déplacer les ourlets ni les jambes.
  const alignedY = y < 980 ? 980 + (y - 980) * .5 : y;
  return [512 + (x - 512) / .66, 555 + (alignedY - 880) * 778 / 520];
});
const shorts = blank(), legs = blank();
// La première ligne de peau suit les deux ourlets, même sur les contours
// latéraux où il faut chercher la colonne de peau voisine.
const firstSkin = new Int32Array(width).fill(-1);
for (let x = 0; x < width; x++) for (let y = 1080; y < 1200; y++) {
  const i = (y * width + x) * 4;
  if (lowerBody.data[i + 3] > 200 && lowerBody.data[i] - lowerBody.data[i + 2] > 40) { firstSkin[x] = y; break; }
}
for (let x = 0; x < width; x++) {
  let seam = firstSkin[x];
  for (let d = 1; seam < 0 && d < 25; d++) {
    if (x - d >= 0 && firstSkin[x - d] >= 0) seam = firstSkin[x - d];
    else if (x + d < width && firstSkin[x + d] >= 0) seam = firstSkin[x + d];
  }
  for (let y = 0; y < height; y++) {
    const i = (y * width + x) * 4;
    const target = seam >= 0 && y >= seam ? legs : shorts;
    lowerBody.data.copy(target.data, i, i, i + 4);
  }
}
function surfaceMask(image, skin = false) {
  const output = blank();
  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3] <= 240) continue;
    const rgb = [...image.data.subarray(i, i + 3)];
    if (skin ? rgb[0] - rgb[2] < 25 : Math.max(...rgb) - Math.min(...rgb) > 20) continue;
    const light = .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
    const coverage = Math.max(0, Math.min(1, (light - 18) / (skin ? 90 : 32)));
    if (coverage) output.data.set([255, 255, 255, Math.round(coverage * 255)], i);
  }
  return output;
}
for (const [name, image, skin] of [['hoodie', hoodie, false], ['short', shorts, false], ['jambes', legs, true]]) {
  save(`calques/${name}.png`, image);
  save(`masques/${name}.png`, surfaceMask(image, skin));
}
console.log('Pull à capuche, short et jambes adaptés au canevas 1024 × 1536.');
