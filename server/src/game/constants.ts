import type { BotConfig } from './types';

export const W = 1100, H = 700;

export const COL = [
  0x4A90D9, 0xE74C3C, 0x2ECC71, 0xF39C12, 0x9B59B6, 0x1ABC9C,
  0xE67E22, 0xEC407A, 0x8D6E63, 0x26C6DA, 0xAB47BC, 0x66BB6A
];

// Returns a unique color for any player index.
// Uses hand-picked colors for the first 12, then generates via golden-ratio hue spacing.
export function playerColor(i: number): number {
  if (i < COL.length) return COL[i];
  const h = (i * 137.508) % 360;
  const s = 0.65, l = 0.52;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return ((Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255));
}

export const NM = [
  'Crimson Empire', 'Jade Republic', 'Golden Horde', 'Iron Dominion',
  'Azure Kingdom', 'Shadow Realm', 'Nova Federation', 'Obsidian League',
  'Emerald Coast', 'Scarlet Union', 'Frost Realm', 'Solar Dynasty'
];

export const DI = ['Easy', 'Medium', 'Hard', 'Impossible'];

export const BC: BotConfig[] = [
  { ef: 20, ep: .15, bf: 200, nf: 0,   sf: 0,   nvf: 0,   ag: .1, nk: 0, sa: 0, ec: .3, tm: 1,   mm: 1,   mr: 0.10 },
  { ef: 12, ep: .20, bf: 110, nf: 450,  sf: 380,  nvf: 320, ag: .3, nk: 1, sa: 1, ec: .5, tm: 1.1, mm: 1.1, mr: 0.15 },
  { ef: 6,  ep: .26, bf: 65,  nf: 270,  sf: 210,  nvf: 210, ag: .5, nk: 1, sa: 1, ec: .6, tm: 1.4, mm: 1.4, mr: 0.20 },
  { ef: 3,  ep: .32, bf: 40,  nf: 130,  sf: 130,  nvf: 110, ag: .7, nk: 1, sa: 1, ec: .7, tm: 2,   mm: 2,   mr: 0.25 }
];

export const C = {
  tr: 100,
  gB: 5, gT: .03,
  atkBase: 0.18,
  defLoss: 1.0,
  unclaimedCost: .01,
  naC: 15000, nhC: 125000,
  naR: 20, nhR: 45,
  naRo: 45, nhRo: 90,
  naSp: 2.5,
  samC: 50000, samRange: 35, samCooldown: 70,
  siloC: 6000,
  fortC: 17500, fortRange: 30, fortMult: 4.0,
  ciC: 25000, faC: 17500, poC: 25000,
  ciB: 3000, faI: 150,
  shC: 5000, shS: 1.8,
  tradeBase: 500,
  tradeDistMult: 8,
  tradeSpd: 1.2,
  tradeSpawnInterval: 350,
  mtT: .4,
  bulletSpd: 5, bulletDmg: 40, bulletRange: 70,
  tilesPerTick: 80,
};
