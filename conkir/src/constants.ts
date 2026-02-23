import type { BotConfig } from './types';

export const W = 800, H = 500;

export const COL = [
  0x4A90D9, 0xE74C3C, 0x2ECC71, 0xF39C12, 0x9B59B6, 0x1ABC9C,
  0xE67E22, 0xEC407A, 0x8D6E63, 0x26C6DA, 0xAB47BC, 0x66BB6A,
  0xF44336, 0x3F51B5, 0x009688, 0xFF5722, 0x607D8B, 0x795548,
  0x8BC34A, 0xFF9800, 0x00BCD4, 0x673AB7, 0xCDDC39, 0xFFEB3B,
  0x03A9F4, 0xE91E63, 0x4CAF50, 0xFF6F00, 0x0D47A1, 0x1B5E20
];

export const NM = [
  'Crimson Empire', 'Jade Republic', 'Golden Horde', 'Iron Dominion',
  'Azure Kingdom', 'Shadow Realm', 'Nova Federation', 'Obsidian League',
  'Emerald Coast', 'Scarlet Union', 'Frost Realm', 'Solar Dynasty',
  'Steel Legion', 'Storm Reach', 'Amber Throne', 'Violet Order',
  'Onyx Pact', 'Coral Alliance', 'Tundra Pact', 'Crimson March',
  'Bronze Republic', 'Neon Dominion', 'Silver Keep', 'Ashen Dominion',
  'Marble Crown', 'Cobalt Empire', 'Verdant State', 'Phantom Realm',
  'Ember Nation', 'Glacial Front', 'Pearl Dynasty', 'Dusk Alliance',
  'Ivory Order', 'Titan League', 'Magma Empire', 'Tempest Pact',
  'Gilded Throne', 'Iron Shore', 'Night Dominion', 'Morning Realm',
  'Cedar Republic', 'Forge Alliance', 'Storm Kingdom', 'Tide Empire',
  'Highland Pact', 'Steppe Horde', 'Marsh Republic', 'Desert Crown',
  'Summit League', 'Lowland Union', 'Shore Alliance', 'Forest Kingdom',
  'Mountain Reich', 'Valley State', 'River Nation', 'Plains Empire',
  'Coastal Pact', 'Island Realm', 'Canyon Order', 'Harbor League',
];

export const DI = ['Easy', 'Medium', 'Hard', 'Impossible'];

export const BC: BotConfig[] = [
  { ef: 20, ep: .15, bf: 200, nf: 0,   sf: 0,   nvf: 0,   ag: .1,  nk: 0, sa: 0, ec: .3,  tm: 1,    mm: 1,    mr: 0.10 },
  { ef: 9,  ep: .25, bf: 80,  nf: 320,  sf: 280,  nvf: 220, ag: .45, nk: 1, sa: 1, ec: .6,  tm: 1.25, mm: 1.2,  mr: 0.12 },
  { ef: 5,  ep: .30, bf: 55,  nf: 200,  sf: 160,  nvf: 160, ag: .6,  nk: 1, sa: 1, ec: .65, tm: 1.6,  mm: 1.5,  mr: 0.18 },
  { ef: 2,  ep: .38, bf: 30,  nf: 90,   sf: 90,   nvf: 80,  ag: .8,  nk: 1, sa: 1, ec: .75, tm: 2.2,  mm: 2.2,  mr: 0.22 }
];

export const C = {
  tr: 10,
  gB: 5, gT: .03,
  atkBase: 0.18,
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
