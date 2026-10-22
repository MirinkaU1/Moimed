import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import { writePsdBuffer, initializeCanvas } from 'ag-psd';

const require = createRequire(import.meta.url);
const { compose, tint } = require('../exemple-web/pixels.js');
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
const masks = Object.fromEntries(manifest.masks.map(name => [name, load(path.join(base, 'masques', `${name}.png`))]));
const groups = [
  { id: 'peau', label: 'Peau', mask: 'peau', reference: 171, indices: [0, 1, 2], defaultColor: '#d99b61' },
  { id: 'pantalon', label: 'Pantalon', mask: 'pantalon', reference: 55, indices: [3], defaultColor: '#44413c' },
  { id: 'chaussures', label: 'Chaussures', mask: 'chaussures', reference: 225, indices: [4, 5], defaultColor: '#eee6d5' },
  { id: 'haut', label: 'T-shirt', mask: 'tshirt', reference: 30, indices: [6], defaultColor: '#242424' },
  { id: 'yeux', label: 'Pupilles', mask: 'pupilles', reference: 1, indices: [7], flat: true, defaultColor: '#080808' },
  { id: 'cheveux', label: 'Cheveux', mask: 'cheveux', reference: 30, indices: [9], defaultColor: '#28231e' }
];
const preset = { peau: '#ad754f', haut: '#435f8f', pantalon: '#303c55', cheveux: '#66422b' };
const example = layers.map((layer, index) => {
  const group = groups.find(item => item.indices.includes(index));
  return group && preset[group.id] ? tint(layer.imageData, masks[group.mask], preset[group.id], group.reference, group.flat) : layer.imageData;
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
    { name: '04 - Masques de couleur (masqué)', hidden: true, opened: false, children: Object.entries(masks).map(([name, image]) => toPsd(image, `Masque - ${name}`)) },
    { name: '03 - Tenues validées (références aplaties)', hidden: true, opened: false, children: references.map(item => toPsd(load(path.join(root, 'assets/tenues-validees', item.file)), item.label)) },
    { name: '02 - Exemple couleurs (masqué)', hidden: true, opened: false, children: layers.map((layer, i) => toPsd(example[i], layer.label)).reverse() },
    { name: '01 - Personnage assemblé - 10 calques', opened: true, children: layers.map(layer => toPsd(layer.imageData, layer.label)).reverse() }
  ]
};
fs.writeFileSync(path.join(root, 'documents/Moimed-Personnage.psd'), writePsdBuffer(document, { generateThumbnail: false, trimImageData: false, noBackground: true }));
pngWrite(path.join(root, 'exports/personnage-assemble.png'), composite);
pngWrite(path.join(root, 'exports/exemple-couleurs.png'), compose(example, width, height));

const xml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const svgLayer = (layer, index) => `<g id="calque-${index}" inkscape:groupmode="layer" inkscape:label="${xml(layer.label)}"><title>${xml(layer.label)}</title><image x="0" y="0" width="${width}" height="${height}" xlink:href="${uri(path.join(base, layer.file))}"/></g>`;
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<title>Moimed - personnage assemblé en éléments bitmap séparés</title>
<desc>Chaque groupe contient un PNG incorporé à sa position d'origine. Les contours ne sont pas vectorisés.</desc>
${layers.map(svgLayer).join('\n')}
</svg>`;
fs.writeFileSync(path.join(root, 'documents/Moimed-Personnage.svg'), svg);
const browserData = {
  width, height, groups, preset,
  layers: layers.map(({ imageData, ...layer }) => ({ ...layer, src: uri(path.join(base, layer.file)) })),
  masks: Object.fromEntries(manifest.masks.map(name => [name, uri(path.join(base, 'masques', `${name}.png`))])),
  references: references.map(item => ({ ...item, src: `../assets/tenues-validees/${item.file}` }))
};
fs.writeFileSync(path.join(root, 'exemple-web/assets-data.js'), `globalThis.MOIMED_ASSETS = ${JSON.stringify(browserData)};\n`);
console.log('PSD à calques, SVG incorporé, PNG et données de démonstration créés.');
