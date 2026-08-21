export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function ease(x) {
  return 1 - Math.pow(1 - x, 3);
}

export function truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

export function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export function fitFontSize(c, text, maxWidth, baseSize, family, weight) {
  let size = baseSize;
  c.font = `${weight} ${size}px ${family}`;
  while (c.measureText(text).width > maxWidth && size > 30) {
    size -= 4;
    c.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

export function slugify(str) {
  return (
    (str || 'soccer-picks')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'soccer-picks'
  );
}
