export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function ease(x) {
  return 1 - Math.pow(1 - x, 3);
}

export function truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

export function truncateToWidth(c, str, maxWidth) {
  if (c.measureText(str).width <= maxWidth) return str;
  let end = str.length;
  while (end > 1 && c.measureText(`${str.slice(0, end - 1)}…`).width > maxWidth) {
    end -= 1;
  }
  return `${str.slice(0, end - 1)}…`;
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

export function dateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
