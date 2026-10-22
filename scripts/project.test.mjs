import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import { initializeCanvas, readPsd } from 'ag-psd';

const require = createRequire(import.meta.url);
const { compose, tint } = require('../exemple-web/pixels.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/base/manifest.json'), 'utf8'));
initializeCanvas(() => { throw new Error('Canvas non requis.'); }, (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }));
const psd = readPsd(fs.readFileSync(path.join(root, 'documents/Moimed-Personnage.psd')), { useImageData: true, skipThumbnail: true });
const visibleEqual = (first, second) => {
  assert.equal(first.data.length, second.data.length);
  for (let i = 0; i < first.data.length; i += 4) {
    assert.equal(first.data[i + 3], second.data[i + 3], `alpha au pixel ${i / 4}`);
    if (first.data[i + 3]) {
      for (let c = 0; c < 3; c++) assert.equal(first.data[i + c], second.data[i + c], `canal ${c} au pixel ${i / 4}`);
    }
  }
};
const compositeEqual = (first, second) => {
  // Le composite PSD passe par une matte blanche en 8 bits ; les calques restent exacts.
  for (let i = 0; i < first.data.length; i += 4) {
    assert.equal(first.data[i + 3], second.data[i + 3]);
    const alpha = first.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) assert.ok(Math.abs((first.data[i + c] - second.data[i + c]) * alpha) <= 2, `composite au pixel ${i / 4}`);
  }
};

test('la composition respecte transparence et ordre des couches', () => {
  const back = { data: new Uint8ClampedArray([0, 0, 255, 255]) };
  const front = { data: new Uint8ClampedArray([255, 0, 0, 128]) };
  assert.deepEqual([...compose([back, front], 1, 1).data], [128, 0, 127, 255]);
  assert.deepEqual([...compose([], 1, 1).data], [0, 0, 0, 0]);
});

test('une recoloration conserve les pixels hors masque et leur alpha', () => {
  const image = { width: 2, height: 1, data: new Uint8ClampedArray([100, 100, 100, 255, 30, 40, 50, 120]) };
  const mask = { data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0]) };
  assert.deepEqual([...tint(image, mask, '#c86432', 100).data], [200, 100, 50, 255, 30, 40, 50, 120]);
});

const sourceEyes = PNG.sync.read(fs.readFileSync(path.join(root, 'assets/base/calques/40_yeux.png')));
const pupilMask = PNG.sync.read(fs.readFileSync(path.join(root, 'assets/base/masques/pupilles.png')));
const redEyes = tint(sourceEyes, pupilMask, '#ff0000', 5, true, [5, 4, 4]);
const pixelAt = (image, x, y) => [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];

test('les pupilles se recolorent entièrement, en haut et sur les deux côtés', () => {
  for (const [x, y] of [[450, 301], [460, 315], [460, 325], [545, 301], [565, 315], [560, 325]]) {
    const pixel = pixelAt(redEyes, x, y);
    assert.ok(pixel[0] >= 245 && pixel[1] < 15 && pixel[2] < 15, `pupille incomplète à ${x},${y} : ${pixel}`);
  }
});

test('les paupières, leurs extrémités et le blanc des yeux restent intacts', () => {
  for (const [x, y] of [[420, 295], [490, 295], [540, 295], [618, 303], [420, 315], [610, 315], [458, 335], [563, 335]]) {
    assert.deepEqual(pixelAt(redEyes, x, y), pixelAt(sourceEyes, x, y), `débordement à ${x},${y}`);
  }
});

test('les bords anticrénelés de la pupille conservent leur part de blanc', () => {
  const image = { width: 1, height: 1, data: new Uint8ClampedArray([125, 124, 124, 255]) };
  const mask = { data: new Uint8ClampedArray([255, 255, 255, 128]) };
  assert.deepEqual([...tint(image, mask, '#ff0000', 5, true, [5, 4, 4]).data], [250, 122, 122, 255]);
});

const sourceShirt = PNG.sync.read(fs.readFileSync(path.join(root, 'assets/base/calques/30_tshirt.png')));
const shirtMask = PNG.sync.read(fs.readFileSync(path.join(root, 'assets/base/masques/tshirt.png')));
const pinkShirt = tint(sourceShirt, shirtMask, '#ff7099', 30);

test('la recoloration du T-shirt ne touche pas les fragments du pantalon sous l’ourlet', () => {
  for (const [x, y] of [[496, 904], [500, 904], [511, 904], [520, 904]]) {
    assert.deepEqual(pixelAt(pinkShirt, x, y), pixelAt(sourceShirt, x, y), `trace sous l’ourlet à ${x},${y}`);
  }
});

test('les contours noirs et pixels de bord du T-shirt restent intacts', () => {
  for (let i = 0; i < sourceShirt.data.length; i += 4) {
    if (!sourceShirt.data[i + 3]) continue;
    const ink = Math.max(sourceShirt.data[i], sourceShirt.data[i + 1], sourceShirt.data[i + 2]) <= 13;
    if (ink || sourceShirt.data[i + 3] <= 200) {
      for (let c = 0; c < 4; c++) assert.equal(pinkShirt.data[i + c], sourceShirt.data[i + c], `contour modifié au pixel ${i / 4}`);
    }
  }
});

test('la peau au col et sous les deux manches ne prend pas la couleur du T-shirt', () => {
  for (const [x, y] of [[561, 481], [559, 484], [500, 504], [328, 695], [359, 703], [372, 705], [697, 696], [663, 703], [651, 705]]) {
    assert.deepEqual(pixelAt(pinkShirt, x, y), pixelAt(sourceShirt, x, y), `débordement sur la peau à ${x},${y}`);
  }
  for (let i = 0; i < sourceShirt.data.length; i += 4) {
    if (!sourceShirt.data[i + 3] || sourceShirt.data[i] - sourceShirt.data[i + 2] <= 25) continue;
    assert.equal(shirtMask.data[i + 3], 0, `peau incluse dans le masque au pixel ${i / 4}`);
  }
});

test('le tissu principal du T-shirt reste personnalisable', () => {
  const pixel = pixelAt(pinkShirt, 512, 650);
  assert.ok(pixel[0] > 100 && pixel[0] > pixel[1], `tissu non recoloré : ${pixel}`);
});

test('le PSD contient une base visible de dix calques à la bonne position', () => {
  assert.equal(psd.width, 1024); assert.equal(psd.height, 1536);
  const base = psd.children.find(group => group.name.startsWith('01 -'));
  assert.ok(!base.hidden); assert.equal(base.children.length, 10);
  const layers = [...base.children].reverse();
  manifest.layers.forEach((layer, index) => {
    const decoded = layers[index];
    assert.equal(decoded.name, layer.label);
    assert.equal(decoded.left, 0); assert.equal(decoded.top, 0);
    assert.equal(decoded.imageData.width, 1024); assert.equal(decoded.imageData.height, 1536);
    const original = PNG.sync.read(fs.readFileSync(path.join(root, 'assets/base', layer.file)));
    visibleEqual(decoded.imageData, original);
  });
  compositeEqual(psd.imageData, compose(layers.map(layer => layer.imageData), 1024, 1536));
});

test('les masques, références et exemple de couleur sont conservés séparément', () => {
  const masks = psd.children.find(group => group.name.startsWith('04 -'));
  const references = psd.children.find(group => group.name.startsWith('03 -'));
  const example = psd.children.find(group => group.name.startsWith('02 -'));
  assert.ok(masks.hidden && references.hidden && example.hidden);
  assert.equal(masks.children.length, 7); assert.equal(references.children.length, 3); assert.equal(example.children.length, 10);
  visibleEqual(masks.children.find(layer => layer.name === 'Masque - pupilles').imageData, pupilMask);
  visibleEqual(masks.children.find(layer => layer.name === 'Masque - tshirt').imageData, shirtMask);
  for (const mask of manifest.masks) assert.ok(fs.existsSync(path.join(root, 'assets/base/masques', `${mask}.png`)));
  const expected = PNG.sync.read(fs.readFileSync(path.join(root, 'exports/exemple-couleurs.png')));
  visibleEqual(expected, compose([...example.children].reverse().map(layer => layer.imageData), 1024, 1536));
});

test('le SVG contient dix images incorporées et aucun lien de PNG externe', () => {
  const text = fs.readFileSync(path.join(root, 'documents/Moimed-Personnage.svg'), 'utf8');
  assert.equal((text.match(/<image /g) || []).length, 10);
  assert.equal((text.match(/xlink:href="data:image\/png;base64,/g) || []).length, 10);
  assert.equal((text.match(/<g /g) || []).length, 10);
});

test('l’exemple web embarque les calques pour fonctionner sans fetch local', () => {
  const source = fs.readFileSync(path.join(root, 'exemple-web/assets-data.js'), 'utf8');
  const data = JSON.parse(source.replace(/^globalThis.MOIMED_ASSETS = /, '').replace(/;\s*$/, ''));
  assert.equal(data.layers.length, 10); assert.equal(Object.keys(data.masks).length, 7);
  assert.ok(data.layers.every(layer => layer.src.startsWith('data:image/png;base64,')));
  visibleEqual(PNG.sync.read(Buffer.from(data.masks.pupilles.split(',')[1], 'base64')), pupilMask);
  visibleEqual(PNG.sync.read(Buffer.from(data.masks.tshirt.split(',')[1], 'base64')), shirtMask);
  for (const reference of data.references) assert.ok(fs.existsSync(path.resolve(root, 'exemple-web', reference.src)));
});
