import type { BotConfig } from './types';

export const W = 800, H = 500;

export const COL = [
  0x4A90D9, 0xE74C3C, 0x2ECC71, 0xF39C12, 0x9B59B6, 0x1ABC9C,
  0xE67E22, 0xEC407A, 0x8D6E63, 0x26C6DA, 0xAB47BC, 0x66BB6A
];

export const NM = [
  'Crimson Empire', 'Jade Republic', 'Golden Horde', 'Iron Dominion',
  'Azure Kingdom', 'Shadow Realm', 'Nova Federation', 'Obsidian League',
  'Emerald Coast', 'Scarlet Union', 'Frost Realm', 'Solar Dynasty'
];

export const DI = ['Easy', 'Medium', 'Hard', 'Impossible'];

export const BC: BotConfig[] = [
  { ef: 20, ep: .15, bf: 200, nf: 0,   sf: 0,   nvf: 0,   ag: .1, nk: 0, sa: 0, ec: .3, tm: 1,   mm: 1   },
  { ef: 12, ep: .20, bf: 110, nf: 450,  sf: 380,  nvf: 320, ag: .3, nk: 1, sa: 1, ec: .5, tm: 1.1, mm: 1.1 },
  { ef: 6,  ep: .26, bf: 65,  nf: 270,  sf: 210,  nvf: 210, ag: .5, nk: 1, sa: 1, ec: .6, tm: 1.4, mm: 1.4 },
  { ef: 3,  ep: .32, bf: 40,  nf: 130,  sf: 130,  nvf: 110, ag: .7, nk: 1, sa: 1, ec: .7, tm: 2,   mm: 2   }
];

export const C = {
  tr: 10,
  gB: 5, gT: .03,
  atkBase: 0.35,
  defLoss: 1.0,
  unclaimedCost: .01,
  naC: 15000, nhC: 50000,
  naR: 20, nhR: 45,
  naRo: 45, nhRo: 90,
  naSp: 2.5,
  samC: 1000, samRange: 35, samCooldown: 70,
  siloC: 6000,
  fortC: 3500, fortRange: 30, fortMult: 4.0,
  ciC: 2000, faC: 3000, poC: 2500,
  ciB: 3000, faI: 150,
  shC: 5000, shS: 1.8,
  tradeBase: 500,
  tradeDistMult: 8,
  tradeSpd: 1.2,
  tradeSpawnInterval: 350,
  mtT: .4,
  bulletSpd: 5, bulletDmg: 40, bulletRange: 70,
  tilesPerTick: 100,
};
