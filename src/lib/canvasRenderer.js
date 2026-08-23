import { clamp, ease, truncateToWidth, roundRectPath } from './utils';
import { timeline } from './timeline';
import { getCachedCrest, splitMatchTeams } from './teamCrests';

function drawBackground(c, W, H) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0A1210');
  g.addColorStop(0.45, '#0E3B2E');
  g.addColorStop(1, '#082820');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  const glow = c.createRadialGradient(W / 2, -100, 100, W / 2, -100, 900);
  glow.addColorStop(0, 'rgba(232,178,61,0.22)');
  glow.addColorStop(1, 'rgba(232,178,61,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, W, 700);

  c.save();
  c.globalAlpha = 0.06;
  c.strokeStyle = '#F4F2E8';
  c.lineWidth = 6;
  c.beginPath();
  c.arc(W + 80, H - 100, 340, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.arc(W + 80, H - 100, 120, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}

function drawProfileAvatar(c, x, y, radius) {
  c.save();
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fillStyle = '#E8B23D';
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = '#F4F2E8';
  c.stroke();

  c.font = `${radius * 1.3}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('⚽', x - radius * 0.2, y + radius * 0.2);

  c.restore();
}

function drawHeader(c, W, project, progress) {
  const alpha = progress;
  const dy = 30 * (1 - progress);
  c.save();
  c.globalAlpha = alpha;
  c.translate(0, -dy);
  c.textAlign = 'center';

  drawProfileAvatar(c, W / 2 - 150, 257, 20);
  c.fillStyle = '#E8B23D';
  c.font = '600 30px Oswald';
  c.fillText('@SOCCER_PICKS_144', W / 2 + 20, 270);

  c.fillStyle = '#E8B23D';
  c.fillRect(W / 2 - 80, 310, 160, 6);

  c.fillStyle = 'rgba(244,242,232,0.6)';
  c.font = '500 42px Oswald';
  c.textAlign = 'center';
  c.fillText('⚽ TODAY\'S PICKS ⚽', W / 2, 400);
  c.restore();
}

function drawCardBackground(c, top, bottom, W, alpha) {
  c.save();
  c.globalAlpha = alpha;
  roundRectPath(c, 60, top, W - 120, bottom - top, 28);
  c.fillStyle = 'rgba(10,18,16,0.55)';
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = 'rgba(232,178,61,0.6)';
  c.stroke();
  c.restore();
}

// Draws "[crest] Home vs Away [crest]" at (x, baselineY), fitting inside
// maxWidth. Assumes c.font/fillStyle are already set for the team name text.
// Falls back to the raw match string when it isn't a "Home - Away" pair, or
// when neither team has a crest cached yet.
function drawMatchLine(c, match, x, baselineY, maxWidth, missed) {
  const [home, away] = splitMatchTeams(match);
  const homeCrest = home ? getCachedCrest(home) : null;
  const awayCrest = away ? getCachedCrest(away) : null;

  if (!home || !away || (!homeCrest && !awayCrest)) {
    c.fillText(truncateToWidth(c, match, maxWidth), x, baselineY);
    return;
  }

  const nameFont = c.font;
  const vsFont = '500 26px Oswald';
  const iconSize = 46;
  const iconGap = 11;
  const segGap = 14;

  c.font = vsFont;
  const vsWidth = c.measureText('vs').width;
  c.font = nameFont;

  const homeIconW = homeCrest ? iconSize + iconGap : 0;
  const awayIconW = awayCrest ? iconSize + iconGap : 0;
  const textBudget = maxWidth - homeIconW - awayIconW - vsWidth - segGap * 2;
  const homeBudget = Math.max(40, textBudget * 0.5);
  const awayBudget = Math.max(40, textBudget - homeBudget);

  const homeText = truncateToWidth(c, home, homeBudget);
  const awayText = truncateToWidth(c, away, awayBudget);
  const iconY = baselineY - iconSize + 2;

  let cursorX = x;
  if (homeCrest) {
    c.drawImage(homeCrest, cursorX, iconY, iconSize, iconSize);
    cursorX += homeIconW;
  }
  c.fillText(homeText, cursorX, baselineY);
  cursorX += c.measureText(homeText).width + segGap;

  c.save();
  c.font = vsFont;
  c.fillStyle = missed ? 'rgba(244,242,232,0.35)' : 'rgba(244,242,232,0.5)';
  c.fillText('vs', cursorX, baselineY);
  c.restore();
  cursorX += vsWidth + segGap;

  if (awayCrest) {
    c.drawImage(awayCrest, cursorX, iconY, iconSize, iconSize);
    cursorX += awayIconW;
  }
  c.fillText(awayText, cursorX, baselineY);
}

function drawPickRow(c, pick, rowY, rowH, W, progress, missed) {
  const alpha = progress;
  const offsetX = 60 * (1 - progress);
  c.save();
  c.globalAlpha = alpha;
  c.translate(offsetX, 0);

  const paddingX = 100;
  const matchY = rowY + rowH * 0.4;
  const pickY = rowY + rowH * 0.7;

  if (missed) {
    c.save();
    c.fillStyle = 'rgba(190,56,61,0.14)';
    c.fillRect(60, rowY, W - 120, rowH);
    c.fillStyle = '#BE383D';
    c.fillRect(60, rowY, 6, rowH);
    c.restore();
  }

  c.textAlign = 'left';
  c.fillStyle = missed ? 'rgba(244,242,232,0.55)' : '#F4F2E8';
  c.font = '600 40px Oswald';
  const badgeW = 150;
  const badgeX = W - 100 - badgeW;
  const matchMaxWidth = badgeX - paddingX - 10;
  drawMatchLine(c, pick.match, paddingX, matchY, matchMaxWidth, missed);

  c.fillStyle = missed ? 'rgba(232,178,61,0.5)' : '#E8B23D';
  c.font = '400 32px Oswald';
  const pickMaxWidth = badgeX - paddingX - 10;
  c.fillText(truncateToWidth(c, pick.pick, pickMaxWidth), paddingX, pickY);

  const badgeH = 64;
  const badgeY = rowY + rowH / 2 - badgeH / 2;
  c.save();
  if (missed) c.globalAlpha *= 0.4;
  roundRectPath(c, badgeX, badgeY, badgeW, badgeH, 12);
  c.fillStyle = 'rgba(232,178,61,0.12)';
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = '#E8B23D';
  c.stroke();
  c.fillStyle = '#E8B23D';
  c.font = '700 36px "Space Mono", monospace';
  c.textAlign = 'center';
  c.fillText(pick.odds.toFixed(2), badgeX + badgeW / 2, badgeY + badgeH / 2 + 13);
  c.restore();

  if (missed) {
    // Rows shrink as more picks are added (up to 8), so size the corner tag to
    // whatever gap is left above the odds badge instead of a fixed height.
    const tagH = clamp(badgeY - rowY - 6, 18, 40);
    const fontSize = Math.round(tagH * 0.5);
    const tagPadX = tagH * 0.4;
    c.font = `700 ${fontSize}px "Space Mono", monospace`;
    const tagText = 'MISS';
    const tagW = c.measureText(tagText).width + tagPadX * 2;
    const tagX = W - 100 - tagW;
    const tagY = rowY + 4;
    roundRectPath(c, tagX, tagY, tagW, tagH, tagH / 4);
    c.fillStyle = '#BE383D';
    c.fill();
    c.fillStyle = '#F4F2E8';
    c.textAlign = 'center';
    c.fillText(tagText, tagX + tagW / 2, tagY + tagH / 2 + fontSize * 0.35);
  }

  c.restore();
}

function drawPerforation(c, y, W) {
  c.save();
  c.strokeStyle = 'rgba(244,242,232,0.15)';
  c.lineWidth = 2;
  c.setLineDash([10, 10]);
  c.beginPath();
  c.moveTo(90, y);
  c.lineTo(W - 90, y);
  c.stroke();
  c.restore();

  c.save();
  c.fillStyle = '#0E3B2E';
  c.beginPath();
  c.arc(60, y, 10, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(W - 60, y, 10, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawParlay(c, y, h, W, total, progress) {
  const scale = 0.85 + 0.15 * ease(progress);
  const alpha = progress;
  const cx = W / 2;
  const cy = y + h / 2;
  c.save();
  c.globalAlpha = alpha;
  c.translate(cx, cy);
  c.scale(scale, scale);
  c.translate(-cx, -cy);

  roundRectPath(c, 100, y, W - 200, h, 18);
  c.fillStyle = 'rgba(232,178,61,0.1)';
  c.fill();
  c.strokeStyle = '#E8B23D';
  c.lineWidth = 2;
  c.stroke();

  c.textAlign = 'center';
  c.fillStyle = '#E8B23D';
  c.font = '600 28px Oswald';
  c.fillText('COMBINED ODDS · PARLAY', cx, y + 48);

  c.fillStyle = '#F4F2E8';
  c.font = '700 88px "Space Mono", monospace';
  c.shadowColor = 'rgba(232,178,61,0.6)';
  c.shadowBlur = 20;
  c.fillText(total.toFixed(2), cx, y + h - 40);
  c.shadowBlur = 0;
  c.restore();
}

function drawFooter(c, H, W, project, progress) {
  const alpha = progress;
  const dy = 20 * (1 - progress);
  c.save();
  c.globalAlpha = alpha;
  c.translate(0, dy);
  c.textAlign = 'center';
  c.fillStyle = '#E8B23D';
  c.font = '700 34px Oswald';
  c.fillText('FOLLOW FOR MORE PICKS ⚽', W / 2, H - 235);
  c.fillStyle = 'rgba(244,242,232,0.5)';
  c.font = '400 24px Oswald';
  c.fillText(project.disclaimer || '18+ · Bet responsibly', W / 2, H - 190);
  c.restore();
}

// Stamps a tilted "WINNER" seal over the top-right corner of a rendered frame.
export function drawWinnerStamp(c, W) {
  const cx = W * 0.72;
  const cy = W * 0.305;
  const r = W * 0.213;

  c.save();
  c.translate(cx, cy);
  c.rotate((-11 * Math.PI) / 180);

  c.beginPath();
  c.arc(0, 0, r + 4, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(232,178,61,0.18)';
  c.lineWidth = 8;
  c.stroke();

  c.save();
  c.shadowColor = 'rgba(0,0,0,0.35)';
  c.shadowBlur = 24;
  c.shadowOffsetY = 10;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fillStyle = 'rgba(8,40,32,0.94)';
  c.fill();
  c.restore();

  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.lineWidth = 6;
  c.strokeStyle = '#E8B23D';
  c.stroke();

  c.beginPath();
  c.arc(0, 0, r - 18, 0, Math.PI * 2);
  c.lineWidth = 2;
  c.strokeStyle = 'rgba(232,178,61,0.45)';
  c.stroke();

  const tickR = r * 0.26;
  const tickCy = -r * 0.3;
  c.beginPath();
  c.arc(0, tickCy, tickR, 0, Math.PI * 2);
  c.fillStyle = '#E8B23D';
  c.fill();

  c.beginPath();
  c.moveTo(-tickR * 0.5, tickCy);
  c.lineTo(-tickR * 0.1, tickCy + tickR * 0.42);
  c.lineTo(tickR * 0.55, tickCy - tickR * 0.42);
  c.strokeStyle = '#082820';
  c.lineWidth = tickR * 0.24;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();

  c.fillStyle = '#F4F2E8';
  c.font = `700 ${r * 0.36}px Oswald`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if ('letterSpacing' in c) c.letterSpacing = `${r * 0.02}px`;
  c.fillText('WINNER', 0, r * 0.32);
  if ('letterSpacing' in c) c.letterSpacing = '0px';

  c.restore();
}

// Draws one frame of a project's ticket video at time t (ms).
// Called repeatedly during recording, and once with a large t for a static preview.
export function renderCanvas(ctx, t, project, resultInfo = {}) {
  const W = 1080;
  const H = 1920;
  const picks = project.picks || [];
  const n = picks.length;
  const tl = timeline(n);
  const animationTime =
    t < tl.startHold
      ? tl.animationTotal
      : Math.min((t - tl.startHold) * tl.animationSpeed, tl.animationTotal);

  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, W, H);

  const introP = clamp(animationTime / tl.introDur, 0, 1);
  drawHeader(ctx, W, project, introP);

  const cardTop = 460;
  const rowH = n > 0 ? clamp(950 / n, 95, 165) : 0;
  const parlayH = 260;
  const padding = 50;
  const cardHeight = padding * 2 + n * rowH + parlayH;

  drawCardBackground(ctx, cardTop, cardTop + cardHeight, W, introP);

  picks.forEach((p, i) => {
    const startT = tl.introDur + i * tl.pickStep;
    const prog = clamp((animationTime - startT) / tl.pickAnim, 0, 1);
    const rowY = cardTop + padding + i * rowH;
    drawPickRow(ctx, p, rowY, rowH, W, prog, Boolean(resultInfo.missedPickIndexes?.includes(i)));
    if (i < n - 1) drawPerforation(ctx, rowY + rowH, W);
  });

  const parlayY = cardTop + padding + n * rowH + 20;
  const parlayProg = clamp((animationTime - tl.parlayStart) / tl.parlayAnim, 0, 1);
  const parlayTotal = picks.reduce((acc, p) => acc * p.odds, 1);
  drawParlay(ctx, parlayY, parlayH - 30, W, parlayTotal, parlayProg);

  const outroProg = clamp((animationTime - tl.outroStart) / tl.outroAnim, 0, 1);
  drawFooter(ctx, H, W, project, outroProg);
}

export const PREVIEW_T = 10000000;
