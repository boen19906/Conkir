import {
  P, wav, dip, pendingPeace, conflictIntensity, betrayalDebuff, botProposals,
  setDip, setPendingPeace, setConflictIntensity, setBetrayalDebuff,
  setBotProposals, addNotif
} from './state';

export function getConflictKey(a: number, b: number) { return a < b ? `${a}-${b}` : `${b}-${a}`; }

export function addConflict(loser: number, winner: number, tiles: number) {
  const k = getConflictKey(loser, winner);
  conflictIntensity.set(k, Math.min(100, (conflictIntensity.get(k) || 0) + tiles * 3));
}

export function decayConflict() {
  for (const [k, v] of conflictIntensity) conflictIntensity.set(k, Math.max(0, v - 4));
}

export function gD(a: number, b: number) {
  if (a === b) return 'peace';
  const k = a < b ? `${a}-${b}` : `${b}-${a}`;
  return dip.get(k) || 'neutral';
}

export function getDefenseMultiplier(pi: number) {
  return (betrayalDebuff.get(pi) || 0) > 0 ? 0.7 : 1.0;
}

export function proposePeace(from: number, to: number) {
  if (pendingPeace.some(p => p.from === from && p.to === to)) return;
  pendingPeace.push({ from, to });
  const toP = P[to];
  if (!toP) return;
  // Bot→human: show inline notification proposal (not modal)
  if (toP.hu) {
    if (!botProposals.some(p => p.from === from)) {
      setBotProposals([...botProposals, { from, name: P[from]?.name || '?', color: P[from]?.color || 0, addedAt: Date.now() }]);
    }
    setPendingPeace(pendingPeace.filter(p => !(p.from === from && p.to === to)));
    return;
  }
  const fromP = P[from];
  setTimeout(() => {
    const k = getConflictKey(from, to);
    const intensity = conflictIntensity.get(k) || 0;
    if (intensity > 90 && Math.random() < 0.6) {
      addNotif(from, `${toP.name} refuses — too much bad blood! ⚔`, '#E74C3C');
      setPendingPeace(pendingPeace.filter(p => !(p.from === from && p.to === to)));
      return;
    }
    const sharedEnemies = P.filter((_, ei) => ei !== from && ei !== to && P[ei]?.alive && gD(from, ei) === 'war' && gD(to, ei) === 'war');
    if (sharedEnemies.length > 0 && Math.random() < 0.85) {
      const k2 = from < to ? `${from}-${to}` : `${to}-${from}`;
      dip.set(k2, 'peace');
      conflictIntensity.set(k, 0);
      addNotif(from, `${toP.name} accepted — united against a common enemy! 🕊`, '#2ECC71');
      setPendingPeace(pendingPeace.filter(p => !(p.from === from && p.to === to)));
      return;
    }
    const toTroops = toP.troops || 1, fromTroops = fromP.troops || 1;
    const toTerr = toP.territory || 1, fromTerr = fromP.territory || 1;
    const similarlyStrong = (fromTroops / toTroops) > 0.50 || (fromTerr / toTerr) > 0.55;
    const fromAttacking = wav.some(w => w.pi === from && w._pressing?.has(to));
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
      dip.set(k2, 'peace');
      conflictIntensity.set(k, 0);
      addNotif(from, `${toP.name} accepted peace! 🕊`, '#2ECC71');
    } else {
      addNotif(from, `${toP.name} rejected your peace proposal ⚔`, '#E74C3C');
    }
    setPendingPeace(pendingPeace.filter(p => !(p.from === from && p.to === to)));
  }, 1200 + Math.random() * 2500);
}

export function sD(a: number, b: number, s: string, skipPropose = false) {
  const k = a < b ? `${a}-${b}` : `${b}-${a}`;
  if (s === 'peace' && !skipPropose) {
    const fromHu = P[a]?.hu, toHu = P[b]?.hu;
    if (fromHu && !toHu) { proposePeace(a, b); return; }
    if (!fromHu && toHu) { proposePeace(b, a); return; }
  }
  if (s === 'war' && gD(a, b) === 'peace') {
    betrayalDebuff.set(a, (betrayalDebuff.get(a) || 0) + 1200);
    addNotif(b, `${P[a]?.name} betrayed the peace treaty! 🗡`, '#E74C3C');
    addNotif(a, 'You broke a peace treaty! -30% defense for 2 min ⚠', '#E67E22');
  }
  dip.set(k, s);
}
