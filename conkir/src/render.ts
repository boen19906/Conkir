import { P, own, ter, bld, unt, bullets, missiles, exp, wav, tk } from './state';
import { W, H, C } from './constants';
import { I } from './mapgen';

export const cv = document.getElementById('c') as HTMLCanvasElement;
export const ctx = cv.getContext('2d') as CanvasRenderingContext2D;

const oC = document.createElement('canvas'); oC.width = W; oC.height = H;
const oX = oC.getContext('2d') as CanvasRenderingContext2D;

export let camX = W / 2, camY = H / 2, zm = 1.5;
let mImg: ImageData | null = null;

export function setCam(x: number, y: number) { camX = x; camY = y; }
export function setZm(z: number) { zm = z; }
export function resetRenderCache() { mImg = null; labelTk = -1; labelCache = []; }

export function rsz() { cv.width = innerWidth; cv.height = innerHeight; }

export function s2m(sx: number, sy: number) {
  return { x: ((sx - cv.width / 2) / zm + camX) | 0, y: ((sy - cv.height / 2) / zm + camY) | 0 };
}

let labelCache: Array<{ id: number; name: string; color: number; x: number; y: number; ter: number }> = [];
let labelTk = -1;

function buildLabels() {
  if (tk - labelTk < 20) return;
  labelTk = tk; labelCache = [];
  for (const p of P) {
    if (!p.alive) continue;
    let sx = 0, sy = 0, sc = 0;
    for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) if (own[I(x, y)] === p.id) { sx += x; sy += y; sc++; }
    if (sc > 0) labelCache.push({ id: p.id, name: p.name, color: p.color, x: sx / sc, y: sy / sc, ter: p.territory });
  }
}

export function render() {
  if (!mImg) mImg = oX.createImageData(W, H);
  const d = mImg.data;
  for (let i = 0; i < W * H; i++) {
    const pp = i * 4, o = own[i], t = ter[i];
    let r: number, g: number, b: number;
    if (t === 0) {
      const x = i % W, y = (i / W) | 0, v = Math.sin(x * .05 + tk * .02) * 4 + Math.sin(y * .03) * 3;
      r = 26 + v; g = 58 + v; b = 92 + v * 2;
    } else if (o >= 0 && o < P.length) {
      const c = P[o].color; r = (c >> 16) & 255; g = (c >> 8) & 255; b = c & 255;
      if (t === 2) { r = r * .7 | 0; g = g * .7 | 0; b = b * .7 | 0; }
      else if (t === 3) { r = r * .85 | 0; g = g * .9 | 0; b = b * .8 | 0; }
      const x = i % W, y = (i / W) | 0;
      if ((x > 0 && own[i - 1] !== o) || (x < W - 1 && own[i + 1] !== o) || (y > 0 && own[i - W] !== o) || (y < H - 1 && own[i + W] !== o)) {
        r = r * .6 | 0; g = g * .6 | 0; b = b * .6 | 0;
      }
    } else {
      r = t === 2 ? 107 : t === 3 ? 45 : 61;
      g = t === 2 ? 107 : t === 3 ? 74 : 92;
      b = t === 2 ? 107 : t === 3 ? 45 : 58;
    }
    d[pp] = r; d[pp + 1] = g; d[pp + 2] = b; d[pp + 3] = 255;
  }
  oX.putImageData(mImg, 0, 0);
  ctx.fillStyle = '#0d1b2a'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(cv.width / 2 - camX * zm, cv.height / 2 - camY * zm);
  ctx.scale(zm, zm);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(oC, 0, 0);
  buildLabels();
  for (const lb of labelCache) {
    if (lb.ter < 40) continue;
    const fs = Math.max(5, Math.min(16, lb.ter / 90));
    ctx.font = `bold ${fs}px Rajdhani,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillText(lb.name, lb.x + 1, lb.y + 1);
    ctx.fillStyle = '#' + lb.color.toString(16).padStart(6, '0');
    ctx.fillText(lb.name, lb.x, lb.y);
  }
  for (const b of bld) {
    const pc = P[b.ow]?.color || 0xAAAAAA;
    const c = '#' + pc.toString(16).padStart(6, '0');
    const cl = '#ffffff';
    ctx.lineWidth = 1.5;
    if (b.type === 'city') {
      ctx.fillStyle = c; ctx.strokeStyle = cl;
      ctx.fillRect(b.x - 3, b.y - 3, 6, 6); ctx.strokeRect(b.x - 3, b.y - 3, 6, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
    } else if (b.type === 'factory') {
      ctx.fillStyle = c; ctx.strokeStyle = cl;
      ctx.beginPath(); ctx.moveTo(b.x, b.y - 4); ctx.lineTo(b.x + 4, b.y + 3); ctx.lineTo(b.x - 4, b.y + 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (b.type === 'port') {
      ctx.fillStyle = c; ctx.strokeStyle = cl;
      ctx.beginPath(); ctx.moveTo(b.x, b.y - 4); ctx.lineTo(b.x + 4, b.y); ctx.lineTo(b.x, b.y + 4); ctx.lineTo(b.x - 4, b.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (b.type === 'silo') {
      ctx.fillStyle = c; ctx.strokeStyle = cl;
      ctx.beginPath(); ctx.moveTo(b.x, b.y - 5); ctx.lineTo(b.x + 4, b.y + 4); ctx.lineTo(b.x - 4, b.y + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = cl; ctx.beginPath(); ctx.arc(b.x, b.y - 5, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'fort') {
      ctx.fillStyle = c; ctx.strokeStyle = cl; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x - 4, b.y + 4); ctx.lineTo(b.x - 4, b.y - 1);
      ctx.lineTo(b.x - 2, b.y - 1); ctx.lineTo(b.x - 2, b.y - 4);
      ctx.lineTo(b.x, b.y - 4); ctx.lineTo(b.x, b.y - 1);
      ctx.lineTo(b.x + 2, b.y - 1); ctx.lineTo(b.x + 2, b.y - 4);
      ctx.lineTo(b.x + 4, b.y - 4); ctx.lineTo(b.x + 4, b.y + 4);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (zm > 1.0) { ctx.strokeStyle = c + '66'; ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(b.x, b.y, C.fortRange, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    } else {
      ctx.strokeStyle = c; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x - 5, b.y); ctx.lineTo(b.x + 5, b.y); ctx.moveTo(b.x, b.y - 5); ctx.lineTo(b.x, b.y + 5); ctx.stroke();
      if ((b.samCd || 0) > 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    }
  }
  for (const u of unt) {
    if (u.ty === 'tr') continue;
    const c = '#' + (P[u.ow]?.color || 0xFFFFFF).toString(16).padStart(6, '0');
    if (u.ty === 't') {
      ctx.fillStyle = c; ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(u.x, u.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = c; ctx.strokeStyle = '#fff'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.moveTo(u.x, u.y - 4); ctx.lineTo(u.x + 4, u.y + 3); ctx.lineTo(u.x - 4, u.y + 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  ctx.fillStyle = '#FFD700';
  for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 1.5, 0, Math.PI * 2); ctx.fill(); }
  for (const u of unt) {
    if (u.ty !== 'tr') continue;
    const pc = '#' + (P[u.ow]?.color || 0xFFFFFF).toString(16).padStart(6, '0');
    const outline = u.safe ? 'rgba(255,255,255,0.5)' : '#FFD700';
    ctx.fillStyle = pc; ctx.strokeStyle = outline; ctx.lineWidth = u.safe ? 0.5 : 1.2;
    ctx.beginPath(); ctx.moveTo(u.x, u.y - 3); ctx.lineTo(u.x + 3, u.y); ctx.lineTo(u.x, u.y + 3); ctx.lineTo(u.x - 3, u.y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  for (const m of missiles) {
    const mc = m.type === 'h' ? '#FF4500' : '#FFA500';
    ctx.fillStyle = mc; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const tdx = m.x - m.tx, tdy = m.y - m.ty, td = Math.hypot(tdx, tdy) || 1;
    ctx.strokeStyle = mc + '99'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + tdx / td * 10, m.y + tdy / td * 10); ctx.stroke();
  }
  if (zm > 1.2) {
    for (const b of bld) {
      if (b.type !== 'sam') continue;
      const hi = P.findIndex(p => p.hu);
      if (b.ow !== hi) continue;
      ctx.strokeStyle = 'rgba(244,67,54,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(b.x, b.y, C.samRange, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  for (const e of exp) {
    const p = e.f / e.mx, cr = e.rad * Math.min(p * 3, 1), a = 1 - p;
    ctx.globalAlpha = a * .3; ctx.fillStyle = '#FF4500'; ctx.beginPath(); ctx.arc(e.x, e.y, cr, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = a * .6; ctx.fillStyle = '#FF0'; ctx.beginPath(); ctx.arc(e.x, e.y, cr * .5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = a * .8; ctx.fillStyle = '#FFF'; ctx.beginPath(); ctx.arc(e.x, e.y, cr * .2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // draw wave indicator
  for (const w of wav) {
    if (!P[w.pi]?.alive) continue;
  }
  ctx.restore();
}
