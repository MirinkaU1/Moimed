import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import { writePsdBuffer, initializeCanvas } from 'ag-psd';
import './prepare-clothes.mjs';

const require = createRequire(import.meta.url);
const { compose, tint, outfitIndices } = require('../exemple-web/pixels.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'assets/base');
const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'), 'utf8'));
const { width, height } = manifest;
const load = file => {
  const png = PNG.sync.read(fs.readFileSync(file));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
};
const pngWrite = (file, image) => fs.writeFileSync(file, PNG.sync.write({ ...image, data: Buffer.from(image.data) }));
const uri = file => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
const layers = [...manifest.layers].sort((a, b) => a.order - b.order).map(layer => ({ ...layer, imageData: load(path.join(base, layer.file)) }));
// Les zones sombres entre les deux parties blanches de chaque œil définissent
// la pupille. Les extrémités de la paupière restent hors de ces limites.
const eyes = layers[7].imageData;
const pupilMask = { width, height, data: new Uint8ClampedArray(width * height * 4) };
const occupied = new Uint8Array(width);
for (let i = 0; i < eyes.data.length; i += 4) if (eyes.data[i + 3] > 128) occupied[(i / 4) % width] = 1;
const eyeSpans = [];
for (let x = 0; x < width;) {
  if (!occupied[x]) { x++; continue; }
  const left = x;
  while (x < width && occupied[x]) x++;
  if (x - left > 10) eyeSpans.push([left, x - 1]);
}
for (const [left, right] of eyeSpans) {
  for (let y = 0; y < height; y++) {
    const whites = [];
    for (let x = left; x <= right; x++) {
      const i = (y * width + x) * 4;
      if (eyes.data[i + 3] > 200 && Math.min(eyes.data[i], eyes.data[i + 1], eyes.data[i + 2]) >= 180) whites.push(x);
    }
    if (whites.length < 6) continue;
    for (let x = whites[0] + 1; x < whites[whites.length - 1]; x++) {
      const i = (y * width + x) * 4;
      if (eyes.data[i + 3] <= 200 || Math.max(eyes.data[i], eyes.data[i + 1], eyes.data[i + 2]) >= 220) continue;
      const light = .2126 * eyes.data[i] + .7152 * eyes.data[i + 1] + .0722 * eyes.data[i + 2];
      const coverage = Math.max(0, Math.min(1, (245 - light) / 240));
      pupilMask.data.set([255, 255, 255, Math.round(coverage * 255)], i);
    }
  }
}
pngWrite(path.join(base, 'masques/pupilles.png'), pupilMask);
// Seul le tissu relié au corps du T-shirt est recolorable. Les fragments
// isolés de peau et de pantalon, l'encre et les bords transparents sont exclus.
const shirt = layers[6].imageData;
const shirtMask = { width, height, data: new Uint8ClampedArray(width * height * 4) };
const fabric = new Uint8Array(width * height);
for (let p = 0; p < fabric.length; p++) {
  const i = p * 4;
  fabric[p] = shirt.data[i + 3] > 200 && Math.max(shirt.data[i], shirt.data[i + 1], shirt.data[i + 2]) > 13 ? 1 : 0;
}
const queue = new Int32Array(width * height);
let largestFabric = new Int32Array(0);
for (let p = 0; p < fabric.length; p++) {
  if (fabric[p] !== 1) continue;
  let head = 0, tail = 1;
  queue[0] = p;
  fabric[p] = 2;
  while (head < tail) {
    const current = queue[head++];
    const x = current % width;
    const neighbors = [x > 0 ? current - 1 : -1, x < width - 1 ? current + 1 : -1, current - width, current + width];
    for (const next of neighbors) {
      if (next < 0 || next >= fabric.length || fabric[next] !== 1) continue;
      fabric[next] = 2;
      queue[tail++] = next;
    }
  }
  if (tail > largestFabric.length) largestFabric = queue.slice(0, tail);
}
for (const p of largestFabric) {
  const i = p * 4;
  const coverage = Math.max(0, Math.min(1, (Math.max(shirt.data[i], shirt.data[i + 1], shirt.data[i + 2]) - 13) / 16));
  shirtMask.data.set([255, 255, 255, Math.round(shirt.data[i + 3] * coverage)], i);
}
pngWrite(path.join(base, 'masques/tshirt.png'), shirtMask);
const modular = JSON.parse(fs.readFileSync(path.join(root, 'assets/modulaires/manifest.json'), 'utf8'));
const allLayers = [...layers, ...modular.layers.map(layer => ({ ...layer, x: 0, y: 0, assetRoot: 'assets/modulaires', imageData: load(path.join(root, 'assets/modulaires', layer.file)) }))];
const maskPaths = Object.fromEntries([
  ...manifest.masks.map(name => [name, path.join(base, 'masques', `${name}.png`)]),
  ...modular.masks.map(name => [name, path.join(root, 'assets/modulaires/masques', `${name}.png`)])
]);
const masks = Object.fromEntries(Object.entries(maskPaths).map(([name, file]) => [name, load(file)]));
const imagePath = layer => path.join(root, layer.assetRoot || 'assets/base', layer.file);
const hoodieIndices = outfitIndices(modular.wardrobe, 'hoodie', 'short');
const hoodieLayers = hoodieIndices.map(index => allLayers[index]);
const groups = [
  { id: 'peau', label: 'Peau', mask: 'peau', reference: 171, indices: [0, 1, 2], defaultColor: '#d99b61' },
  { id: 'pantalon', label: 'Bas', mask: 'pantalon', reference: 55, indices: [3], defaultColor: '#44413c' },
  { id: 'chaussures', label: 'Chaussures', mask: 'chaussures', reference: 225, indices: [4, 5], defaultColor: '#eee6d5' },
  { id: 'haut', label: 'Haut', mask: 'tshirt', reference: 30, indices: [6], defaultColor: '#242424' },
  { id: 'yeux', label: 'Pupilles', mask: 'pupilles', reference: 5, indices: [7], flat: true, flatInk: [5, 4, 4], defaultColor: '#080808' },
  { id: 'cheveux', label: 'Cheveux', mask: 'cheveux', reference: 30, indices: [9], defaultColor: '#28231e' }
];
const preset = { peau: '#ad754f', haut: '#435f8f', pantalon: '#303c55', cheveux: '#66422b' };
const example = layers.map((layer, index) => {
  const group = groups.find(item => item.indices.includes(index));
  return group && preset[group.id] ? tint(layer.imageData, masks[group.mask], preset[group.id], group.reference, group.flat, group.flatInk) : layer.imageData;
});
const composite = compose(layers.map(layer => layer.imageData), width, height);
const references = [
  { file: 'chemise-bleue-pantalon-beige.png', label: 'Chemise bleue · pantalon beige' },
  { file: 'pull-bordeaux-jean-peau-doree.png', label: 'Pull bordeaux · peau dorée' },
  { file: 'pull-bordeaux-jean-peau-foncee.png', label: 'Pull bordeaux · peau foncée' }
];
initializeCanvas(() => { throw new Error('Canvas non requis pour ces exports bitmap.'); }, (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }));
const toPsd = (imageData, name) => ({ name, left: 0, top: 0, blendMode: 'normal', imageData });
const document = {
  width, height, imageData: composite,
  imageResources: { resolutionInfo: { horizontalResolution: 72, horizontalResolutionUnit: 'PPI', widthUnit: 'Inches', verticalResolution: 72, verticalResolutionUnit: 'PPI', heightUnit: 'Inches' } },
  children: [
    { name: '05 - Pull à capuche et short (masqué)', hidden: true, opened: true, children: hoodieLayers.map(layer => toPsd(layer.imageData, layer.label)).reverse() },
    { name: '04 - Masques de couleur (masqué)', hidden: true, opened: false, children: Object.entries(masks).map(([name, image]) => toPsd(image, `Masque - ${name}`)) },
    { name: '03 - Tenues validées (références aplaties)', hidden: true, opened: false, children: references.map(item => toPsd(load(path.join(root, 'assets/tenues-validees', item.file)), item.label)) },
    { name: '02 - Exemple couleurs (masqué)', hidden: true, opened: false, children: layers.map((layer, i) => toPsd(example[i], layer.label)).reverse() },
    { name: '01 - Personnage assemblé - 10 calques', opened: true, children: layers.map(layer => toPsd(layer.imageData, layer.label)).reverse() }
  ]
};
fs.writeFileSync(path.join(root, 'documents/Moimed-Personnage.psd'), writePsdBuffer(document, { generateThumbnail: false, trimImageData: false, noBackground: true }));
pngWrite(path.join(root, 'exports/personnage-assemble.png'), composite);
pngWrite(path.join(root, 'exports/exemple-couleurs.png'), compose(example, width, height));
pngWrite(path.join(root, 'exports/hoodie-short.png'), compose(hoodieLayers.map(layer => layer.imageData), width, height));

const xml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const svgLayer = (layer, index) => `<g id="calque-${index}" inkscape:groupmode="layer" inkscape:label="${xml(layer.label)}"><title>${xml(layer.label)}</title><image x="0" y="0" width="${width}" height="${height}" xlink:href="${uri(imagePath(layer))}"/></g>`;
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<title>Moimed - personnage assemblé en éléments bitmap séparés</title>
<desc>Chaque groupe contient un PNG incorporé à sa position d'origine. Les contours ne sont pas vectorisés.</desc>
${layers.map(svgLayer).join('\n')}
</svg>`;
fs.writeFileSync(path.join(root, 'documents/Moimed-Personnage.svg'), svg);
fs.writeFileSync(path.join(root, 'documents/Moimed-Hoodie-Short.svg'), svg.replace(layers.map(svgLayer).join('\n'), hoodieLayers.map(svgLayer).join('\n')));
const browserData = {
  width, height, groups, preset, wardrobe: modular.wardrobe,
  layers: allLayers.map(({ imageData, ...layer }) => ({ ...layer, src: uri(imagePath(layer)) })),
  masks: Object.fromEntries(Object.entries(maskPaths).map(([name, file]) => [name, uri(file)])),
  references: references.map(item => ({ ...item, src: `../assets/tenues-validees/${item.file}` }))
};
fs.writeFileSync(path.join(root, 'exemple-web/assets-data.js'), `globalThis.MOIMED_ASSETS = ${JSON.stringify(browserData)};\n`);
console.log('PSD à calques, SVG incorporé, PNG et données de démonstration créés.');
