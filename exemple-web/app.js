'use strict';
(async function () {
  const data = globalThis.MOIMED_ASSETS;
  const pixels = globalThis.MoimedPixels;
  const canvas = document.querySelector('#preview');
  const context = canvas.getContext('2d');
  const status = document.querySelector('#status');
  const selections = {};
  const visible = data.layers.map(() => true);
  let referenceMode = false;
  const inputs = new Map();
  const load = src => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const surface = document.createElement('canvas');
      surface.width = data.width; surface.height = data.height;
      const ctx = surface.getContext('2d'); ctx.drawImage(image, 0, 0);
      resolve(ctx.getImageData(0, 0, data.width, data.height));
    };
    image.onerror = () => reject(new Error('Un calque ne peut pas être chargé.'));
    image.src = src;
  });
  try {
    const layers = await Promise.all(data.layers.map(layer => load(layer.src)));
    const masks = Object.fromEntries(await Promise.all(Object.entries(data.masks).map(async ([name, src]) => [name, await load(src)])));
    function render() {
      const stack = [];
      layers.forEach((layer, index) => {
        if (!visible[index]) return;
        const group = data.groups.find(item => item.indices.includes(index));
        stack.push(group && selections[group.id] ? pixels.tint(layer, masks[group.mask], selections[group.id], group.reference, group.flat, group.flatInk) : layer);
      });
      const image = pixels.compose(stack, data.width, data.height);
      context.putImageData(new ImageData(image.data, data.width, data.height), 0, 0);
      status.textContent = `${visible.filter(Boolean).length} calques assemblés`;
    }
    function selectBase() {
      referenceMode = false;
      canvas.hidden = false; document.querySelector('#reference-image').hidden = true;
      document.querySelector('#view-title').textContent = 'Base à calques';
      document.querySelector('#view-note').textContent = 'Les couleurs modifient les surfaces sélectionnées en conservant les contours.';
      document.querySelector('#export').disabled = false;
      document.querySelectorAll('.panel input,.panel button').forEach(item => { item.disabled = false; });
      document.querySelectorAll('.reference').forEach(button => button.classList.toggle('active', button.id === 'base-view'));
      render();
    }
    for (const group of data.groups) {
      const label = document.createElement('label'); label.className = 'color-row';
      const text = document.createElement('span'); text.textContent = group.label;
      const input = document.createElement('input'); input.type = 'color'; input.value = group.defaultColor;
      input.setAttribute('aria-label', `Couleur : ${group.label}`);
      input.addEventListener('input', () => { selections[group.id] = input.value; render(); });
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
        referenceMode = true; canvas.hidden = true;
        const target = document.querySelector('#reference-image'); target.hidden = false; target.src = reference.src;
        document.querySelector('#view-title').textContent = reference.label;
        document.querySelector('#view-note').textContent = 'Image complète validée. Les calques de cette tenue restent à préparer.';
        document.querySelectorAll('.panel input,.panel button').forEach(item => { item.disabled = true; });
        document.querySelector('#export').disabled = true;
        document.querySelectorAll('.reference').forEach(item => item.classList.toggle('active', item === button));
        status.textContent = 'Tenue de référence';
      });
      document.querySelector('#references').append(button);
    });
    document.querySelector('#base-view').addEventListener('click', selectBase);
    document.querySelector('#reset').addEventListener('click', () => {
      for (const key of Object.keys(selections)) delete selections[key];
      data.groups.forEach(group => { inputs.get(group.id).value = group.defaultColor; });
      visible.fill(true); document.querySelectorAll('#layers input').forEach(input => { input.checked = true; });
      render();
    });
    document.querySelector('#preset').addEventListener('click', () => {
      for (const key of Object.keys(selections)) delete selections[key];
      Object.assign(selections, data.preset);
      data.groups.forEach(group => { inputs.get(group.id).value = selections[group.id] || group.defaultColor; });
      render();
    });
    document.querySelector('#export').addEventListener('click', () => {
      if (referenceMode) return;
      const link = document.createElement('a'); link.download = 'moimed-personnage.png'; link.href = canvas.toDataURL('image/png'); link.click();
    });
    render();
  } catch (error) {
    status.textContent = error.message;
    document.querySelector('#export').disabled = true;
  }
})();
