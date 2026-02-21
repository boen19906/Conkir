import type { GameState } from './state';

export function getConflictKey(a: number, b: number) { return a < b ? `${a}-${b}` : `${b}-${a}`; }

export function addConflict(gs: GameState, loser: number, winner: number, tiles: number) {
  const k = getConflictKey(loser, winner);
  gs.conflictIntensity.set(k, Math.min(100, (gs.conflictIntensity.get(k) || 0) + tiles * 3));
}

export function decayConflict(gs: GameState) {
  for (const [k, v] of gs.conflictIntensity) gs.conflictIntensity.set(k, Math.max(0, v - 4));
}

export function gD(gs: GameState, a: number, b: number) {
  if (a === b) return 'peace';
  const k = a < b ? `${a}-${b}` : `${b}-${a}`;
  return gs.dip.get(k) || 'neutral';
}

export function getDefenseMultiplier(gs: GameState, pi: number) {
  return (gs.betrayalDebuff.get(pi) || 0) > 0 ? 0.7 : 1.0;
}

export function proposePeace(gs: GameState, from: number, to: number) {
  if (gs.pendingPeace.some(p => p.from === from && p.to === to)) return;
  gs.pendingPeace.push({ from, to });
  const toP = gs.P[to];
  if (!toP || toP.hu) return;
  // Immediate acknowledgment so the proposing player knows the request was sent
  gs.addNotif(from, `🕊 Peace proposal sent to ${toP.name}...`, '#7ec8e3');
  const fromP = gs.P[from];
  setTimeout(() => {
    const k = getConflictKey(from, to);
    const intensity = gs.conflictIntensity.get(k) || 0;
    if (intensity > 90 && Math.random() < 0.6) {
      gs.addNotif(from, `${toP.name} refuses — too much bad blood! ⚔`, '#E74C3C');
      gs.pendingPeace = gs.pendingPeace.filter(p => !(p.from === from && p.to === to));
      return;
    }
    const sharedEnemies = gs.P.filter((_, ei) => ei !== from && ei !== to && gs.P[ei]?.alive && gD(gs, from, ei) === 'war' && gD(gs, to, ei) === 'war');
    if (sharedEnemies.length > 0 && Math.random() < 0.85) {
      const k2 = from < to ? `${from}-${to}` : `${to}-${from}`;
      gs.dip.set(k2, 'peace');
      gs.conflictIntensity.set(k, 0);
      gs.addNotif(from, `${toP.name} accepted — united against a common enemy! 🕊`, '#2ECC71');
      gs.pendingPeace = gs.pendingPeace.filter(p => !(p.from === from && p.to === to));
      return;
    }
    const toTroops = toP.troops || 1, fromTroops = fromP.troops || 1;
    const toTerr = toP.territory || 1, fromTerr = fromP.territory || 1;
    const similarlyStrong = (fromTroops / toTroops) > 0.50 || (fromTerr / toTerr) > 0.55;
    const fromAttacking = gs.wav.some(w => w.pi === from && w._pressing?.has(to));
    const theyLosing = toTerr < fromTerr * 0.7;
    const weLosing = fromTerr < toTerr * 0.5;
    let finalChance = 0.55;
    if (similarlyStrong) finalChance += 0.20;
    if (theyLosing) finalChance += 0.20;
    if (weLosing) finalChance += 0.10;
    if (fromAttacking) finalChance -= 0.12;
    finalChance -= Math.min(0.25, intensity * 0.003);
    finalChance = Math.max(0.20, Math.min(0.93, finalChance));
    if (Math.random() < finalChance) {
      const k2 = from < to ? `${from}-${to}` : `${to}-${from}`;
      gs.dip.set(k2, 'peace');
      gs.conflictIntensity.set(k, 0);
      gs.addNotif(from, `${toP.name} accepted peace! 🕊`, '#2ECC71');
    } else {
      gs.addNotif(from, `${toP.name} rejected your peace proposal ⚔`, '#E74C3C');
    }
    gs.pendingPeace = gs.pendingPeace.filter(p => !(p.from === from && p.to === to));
  }, 1200 + Math.random() * 2500);
}

export function sD(gs: GameState, a: number, b: number, s: string, skipPropose = false) {
  const k = a < b ? `${a}-${b}` : `${b}-${a}`;
  if (s === 'peace' && !skipPropose) {
    const fromHu = gs.P[a]?.hu, toHu = gs.P[b]?.hu;
    if (fromHu && !toHu) { proposePeace(gs, a, b); return; }
    if (!fromHu && toHu) { proposePeace(gs, b, a); return; }
    // hu→hu peace: intercepted in GameRoom.handleAction before reaching here
  }
  if (s === 'war' && gD(gs, a, b) === 'peace') {
    gs.betrayalDebuff.set(a, (gs.betrayalDebuff.get(a) || 0) + 1200);
    gs.addNotif(b, `${gs.P[a]?.name} betrayed the peace treaty! 🗡`, '#E74C3C');
    gs.addNotif(a, 'You broke a peace treaty! -30% defense for 2 min ⚠', '#E67E22');
  }
  gs.dip.set(k, s);
}
