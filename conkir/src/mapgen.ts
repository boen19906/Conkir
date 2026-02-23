import { W, H } from './constants';
import { ter, own } from './state';
import { RNG } from './rng';

export function I(x: number, y: number) { return y * W + x; }
export function B(x: number, y: number) { return x >= 0 && x < W && y >= 0 && y < H; }
export function isL(x: number, y: number) { return B(x, y) && ter[I(x, y)] > 0; }
export function isW(x: number, y: number) { return B(x, y) && ter[I(x, y)] === 0; }
export function isCo(x: number, y: number) {
  if (!isL(x, y)) return false;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]])
    if (isW(x + dx, y + dy)) return true;
  return false;
}

function vN(w: number, h: number, sc: number, r: RNG) {
  const gw = Math.ceil(w / sc) + 2;
  const g = new Float32Array((Math.ceil(h / sc) + 2) * gw);
  for (let i = 0; i < g.length; i++) g[i] = r.n();
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = x / sc, gy = y / sc, ix = gx | 0, iy = gy | 0;
    const fx = gx - ix, fy = gy - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const j = iy * gw + ix;
    o[y * w + x] = ((g[j] ?? 0) + sx * ((g[j + 1] ?? 0) - (g[j] ?? 0))) * (1 - sy)
      + ((g[j + gw] ?? 0) + sx * ((g[j + gw + 1] ?? 0) - (g[j + gw] ?? 0))) * sy;
  }
  return o;
}

function fN(w: number, h: number, r: RNG, oc = 5, bs = 60) {
  const o = new Float32Array(w * h);
  let a = 1, t = 0;
  for (let i = 0; i < oc; i++) {
    const n = vN(w, h, Math.max(bs / 2 ** i, 2), r);
    for (let j = 0; j < o.length; j++) o[j] += n[j] * a;
    t += a; a *= .5;
  }
  for (let i = 0; i < o.length; i++) o[i] /= t;
  return o;
}

export function genMap(s: number) {
  const r = new RNG(s);
  const cs = [
    { cx: .18, cy: .3, rx: .12, ry: .25, rt: .2 },
    { cx: .22, cy: .6, rx: .1, ry: .18, rt: -.1 },
    { cx: .45, cy: .28, rx: .1, ry: .15, rt: .1 },
    { cx: .47, cy: .55, rx: .12, ry: .22, rt: 0 },
    { cx: .7, cy: .3, rx: .15, ry: .2, rt: -.15 },
    { cx: .72, cy: .55, rx: .08, ry: .12, rt: .1 },
    { cx: .85, cy: .5, rx: .05, ry: .08, rt: .3 },
    { cx: .35, cy: .8, rx: .07, ry: .06, rt: 0 },
    { cx: .5, cy: .1, rx: .2, ry: .06, rt: .05 },
    { cx: .55, cy: .42, rx: .03, ry: .04, rt: 0 },
    { cx: .32, cy: .45, rx: .03, ry: .03, rt: 0 },
    { cx: .9, cy: .35, rx: .03, ry: .05, rt: .2 }
  ];
  const m = new Float32Array(W * H);
  for (const c of cs) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - c.cx * W) / (c.rx * W), dy = (y - c.cy * H) / (c.ry * H);
    const co = Math.cos(c.rt), si = Math.sin(c.rt);
    const a = dx * co - dy * si, b = dx * si + dy * co;
    const d = a * a + b * b;
    if (d < 1) { const v = (1 - d) ** 1.5, i = y * W + x; m[i] = Math.max(m[i], v); }
  }
  const n = fN(W, H, r, 5, 60), dd = fN(W, H, r, 3, 20);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, e = m[i] * .7 + n[i] * .3;
    const ed = Math.min(x, y, W - x - 1, H - y - 1), f = Math.min(ed / 30, 1), fe = e * f;
    ter[i] = fe < .38 ? 0 : fe > .78 ? 2 : dd[i] > .55 && fe > .46 ? 3 : 1;
    own[i] = ter[i] === 0 ? -2 : -1;
  }
}

export function findSp(cnt: number, s: number) {
  const r = new RNG(s + 999), p: Array<{ x: number; y: number }> = [];
  const md = Math.min(W, H) * .15, mg = 40;
  const ca: Array<{ x: number; y: number }> = [];
  for (let y = mg; y < H - mg; y += 5) for (let x = mg; x < W - mg; x += 5) if (isL(x, y)) {
    let l = 0, t = 0;
    for (let dy = -10; dy <= 10; dy += 3) for (let dx = -10; dx <= 10; dx += 3) { t++; if (isL(x + dx, y + dy)) l++; }
    if (l / t > .6) ca.push({ x, y });
  }
  for (let i = ca.length - 1; i > 0; i--) {
    const j = r.n() * i | 0;
    [ca[i], ca[j]] = [ca[j], ca[i]];
  }
  for (const c of ca) {
    if (p.length >= cnt) break;
    let ok = 1;
    for (const q of p) if (Math.hypot(c.x - q.x, c.y - q.y) < md) { ok = 0; break; }
    if (ok) p.push(c);
  }
  return p;
}
