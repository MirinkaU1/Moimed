(function (root) {
  const limit = value => Math.max(0, Math.min(255, Math.round(value)));

  function compose(images, width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (const image of images) {
      for (let i = 0; i < data.length; i += 4) {
        const sa = image.data[i + 3] / 255;
        if (!sa) continue;
        const da = data[i + 3] / 255;
        const alpha = sa + da * (1 - sa);
        for (let c = 0; c < 3; c++) data[i + c] = limit((image.data[i + c] * sa + data[i + c] * da * (1 - sa)) / alpha);
        data[i + 3] = limit(alpha * 255);
      }
    }
    return { width, height, data };
  }

  function tint(image, mask, hex, reference, flat = false, flatInk = [0, 0, 0]) {
    const color = hex.replace('#', '').match(/../g).map(value => parseInt(value, 16));
    const data = new Uint8ClampedArray(image.data);
    for (let i = 0; i < data.length; i += 4) {
      if (!data[i + 3] || !mask.data[i + 3]) continue;
      const weight = mask.data[i + 3] / 255;
      const light = .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2];
      const shade = flat ? 1 : Math.max(.12, Math.min(1.35, light / reference));
      for (let c = 0; c < 3; c++) {
        data[i + c] = flat
          ? limit(data[i + c] + (color[c] - flatInk[c]) * weight)
          : limit(data[i + c] * (1 - weight) + limit(color[c] * shade) * weight);
      }
    }
    return { width: image.width, height: image.height, data };
  }

  const api = { compose, tint };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MoimedPixels = api;
})(globalThis);
