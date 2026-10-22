'use strict';
(function () {
  const data = globalThis.MOIMED_VECTOR;
  const { outfitIndices } = globalThis.MoimedPixels;
  const SVG = 'http://www.w3.org/2000/svg';
  const preview = document.querySelector('#preview');
  const status = document.querySelector('#status');
  const selections = {};
  const visible = data.layers.map(() => true);
  const inputs = new Map();
  let topId = 'tshirt', bottomId = 'pantalon';
  let referenceMode = false;

  const limit = value => Math.max(0, Math.min(255, Math.round(value)));
  const rgb = hex => hex.replace('#', '').match(/../g).map(value => parseInt(value, 16));
  const hex = color => `#${color.map(value => value.toString(16).padStart(2, '0')).join('')}`;

  function tinted(fill, target, tint) {
    const color = rgb(fill);
    if (tint.flat) return hex(color.map((value, c) => limit(value + target[c] - tint.flatInk[c])));
    const light = .2126 * color[0] + .7152 * color[1] + .0722 * color[2];
    const shade = Math.max(.12, Math.min(1.6, light / tint.reference));
    return hex(target.map(value => limit(value * shade)));
  }

  const groups = data.layers.map(layer => {
    const group = document.createElementNS(SVG, 'g');
    group.id = layer.id;
    if (layer.scale !== 1) group.setAttribute('transform', `scale(${layer.scale})`);
    group.innerHTML = layer.body;
    if (layer.tint) {
      const tint = document.createElementNS(SVG, 'g');
      tint.innerHTML = layer.tint.body;
      tint.querySelectorAll('path').forEach(path => { path.dataset.fill = path.getAttribute('fill'); });
      group.append(tint);
      group.tintPaths = [...tint.querySelectorAll('path')];
    }
    return group;
  });

  function recolor(index) {
    const tint = data.layers[index].tint;
    if (!tint) return;
    const target = selections[tint.group] && rgb(selections[tint.group]);
    groups[index].tintPaths.forEach(path => {
      path.setAttribute('fill', target ? tinted(path.dataset.fill, target, tint) : path.dataset.fill);
    });
  }

  function render() {
    const variants = data.variants[topId] || {};
    const indices = outfitIndices(data.wardrobe, topId, bottomId).map(index => variants[index] ?? index);
    preview.replaceChildren(...indices.filter(index => visible[index]).map(index => groups[index]));
    document.querySelectorAll('#layers label').forEach((label, index) => { label.hidden = !indices.includes(index); });
    document.querySelector('#layer-count').textContent = indices.length;
    if (!referenceMode) document.querySelector('#view-title').textContent = `${data.wardrobe.tops.find(item => item.id === topId).label} · ${data.wardrobe.bottoms.find(item => item.id === bottomId).label}`;
    status.textContent = `${preview.childElementCount} calques vectoriels assemblés`;
  }

  function applyColors() {
    data.layers.forEach((layer, index) => recolor(index));
    render();
  }

  function serialize() {
    const clone = preview.cloneNode(true);
    clone.setAttribute('xmlns', SVG);
    clone.removeAttribute('aria-label');
    clone.removeAttribute('id');
    return new XMLSerializer().serializeToString(clone);
  }

  function download(name, href) {
    const link = document.createElement('a');
    link.download = name; link.href = href; link.click();
  }

  function selectBase() {
    referenceMode = false;
    preview.hidden = false; document.querySelector('#reference-image').hidden = true;
    document.querySelector('#view-note').textContent = 'Les couleurs modifient les surfaces sélectionnées en conservant les contours et les nuances.';
    document.querySelectorAll('.panel input,.panel button,.panel select,.export').forEach(item => { item.disabled = false; });
    document.querySelectorAll('.reference').forEach(button => button.classList.toggle('active', button.id === 'base-view'));
    render();
  }

  for (const [id, options] of [['top-model', data.wardrobe.tops], ['bottom-model', data.wardrobe.bottoms]]) {
    const select = document.querySelector(`#${id}`);
    for (const option of options) {
      const item = document.createElement('option'); item.value = option.id; item.textContent = option.label; select.append(item);
    }
    select.addEventListener('change', () => {
      topId = document.querySelector('#top-model').value;
      bottomId = document.querySelector('#bottom-model').value;
      render();
    });
  }
  for (const group of data.groups) {
    const label = document.createElement('label'); label.className = 'color-row';
    const text = document.createElement('span'); text.textContent = group.label;
    const input = document.createElement('input'); input.type = 'color'; input.value = group.defaultColor;
    input.setAttribute('aria-label', `Couleur : ${group.label}`);
    input.addEventListener('input', () => {
      selections[group.id] = input.value;
      data.layers.forEach((layer, index) => { if (layer.tint && layer.tint.group === group.id) recolor(index); });
    });
    inputs.set(group.id, input); label.append(text, input); document.querySelector('#color-controls').append(label);
  }
  data.layers.forEach((layer, index) => {
    const label = document.createElement('label'); label.className = 'layer-row';
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = true;
    input.addEventListener('change', () => { visible[index] = input.checked; render(); });
    label.append(input, document.createTextNode(layer.label)); document.querySelector('#layers').append(label);
  });
  data.references.forEach(reference => {
    const button = document.createElement('button'); button.className = 'reference';
    const image = document.createElement('img'); image.src = reference.src; image.alt = '';
    const label = document.createElement('span'); label.textContent = reference.label;
    button.append(image, label);
    button.addEventListener('click', () => {
      referenceMode = true; preview.hidden = true;
      const target = document.querySelector('#reference-image'); target.hidden = false; target.src = reference.src;
      document.querySelector('#view-title').textContent = reference.label;
      document.querySelector('#view-note').textContent = 'Image complète validée. Les calques de cette tenue restent à préparer.';
      document.querySelectorAll('.panel input,.panel button,.panel select,.export').forEach(item => { item.disabled = true; });
      document.querySelectorAll('.reference').forEach(item => item.classList.toggle('active', item === button));
      status.textContent = 'Tenue de référence';
    });
    document.querySelector('#references').append(button);
  });
  document.querySelector('#base-view').addEventListener('click', selectBase);
  document.querySelector('#reset').addEventListener('click', () => {
    for (const key of Object.keys(selections)) delete selections[key];
    data.groups.forEach(group => { inputs.get(group.id).value = group.defaultColor; });
    topId = 'tshirt'; bottomId = 'pantalon';
    document.querySelector('#top-model').value = topId; document.querySelector('#bottom-model').value = bottomId;
    visible.fill(true); document.querySelectorAll('#layers input').forEach(input => { input.checked = true; });
    applyColors();
  });
  document.querySelector('#preset').addEventListener('click', () => {
    for (const key of Object.keys(selections)) delete selections[key];
    Object.assign(selections, data.preset);
    data.groups.forEach(group => { inputs.get(group.id).value = selections[group.id] || group.defaultColor; });
    applyColors();
  });
  document.querySelector('#export-svg').addEventListener('click', () => {
    if (referenceMode) return;
    download('moimed-personnage.svg', URL.createObjectURL(new Blob([serialize()], { type: 'image/svg+xml' })));
  });
  document.querySelector('#export').addEventListener('click', () => {
    if (referenceMode) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = data.width; canvas.height = data.height;
      canvas.getContext('2d').drawImage(image, 0, 0, data.width, data.height);
      download('moimed-personnage.png', canvas.toDataURL('image/png'));
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialize())}`;
  });
  render();
})();
