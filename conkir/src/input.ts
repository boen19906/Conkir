import { P, own, ter, bld, atkRatio } from './state';
import { C, W, H } from './constants';
import { B, I, isCo, isL } from './mapgen';
import { gD, sD } from './diplomacy';
import { mkWave } from './waves';
import { navInv, needsNaval, spShip } from './naval';
import { doNuke } from './nukes';
import { buildB } from './buildings';
import { cv, s2m, zm, camX, camY, setCam, setZm } from './render';
import { hideCm, ctxEl, fmt } from './ui';
import { send, isMultiplayer } from './network';

let drag = false, downX = 0, downY = 0, dragMoved = false;
const DRAG_THRESHOLD = 5;

cv.addEventListener('mousedown', e => {
  hideCm();
  if (e.button === 0) { drag = true; downX = e.clientX; downY = e.clientY; dragMoved = false; }
  e.preventDefault();
});

cv.addEventListener('mousemove', e => {
  if (!drag) return;
  const dx = e.clientX - downX, dy = e.clientY - downY;
  if (!dragMoved && (Math.abs(dx) + Math.abs(dy)) > DRAG_THRESHOLD) { dragMoved = true; cv.classList.add('dragging'); }
  if (dragMoved) { setCam(camX - (e.clientX - downX) / zm, camY - (e.clientY - downY) / zm); downX = e.clientX; downY = e.clientY; }
});

addEventListener('mouseup', e => {
  if (drag && !dragMoved && e.button === 0) {
    const { x, y } = s2m(e.clientX, e.clientY);
    const hi = P.findIndex(p => p.hu);
    if (hi >= 0 && P[hi].alive && B(x, y)) {
      const o = own[I(x, y)];
      if (o !== hi) {
        const tr = P[hi].troops * atkRatio;
        if (tr > 5) {
          if (o >= 0 && P[o]?.alive) {
            if (gD(hi, o) !== 'peace') {
              if (isMultiplayer()) send({ type: 'action', action: { kind: 'mkWave', cx: x, cy: y, tr, targetOwner: o } });
              else mkWave(hi, x, y, tr, o);
            }
          } else if (o === -1) {
            if (isMultiplayer()) send({ type: 'action', action: { kind: 'mkWave', cx: x, cy: y, tr, targetOwner: -1 } });
            else mkWave(hi, x, y, tr, -1);
          }
        }
      }
    }
  }
  drag = false; cv.classList.remove('dragging');
});

cv.addEventListener('contextmenu', e => {
  e.preventDefault(); hideCm();
  const { x, y } = s2m(e.clientX, e.clientY);
  const hi = P.findIndex(p => p.hu);
  if (hi < 0 || !P[hi]?.alive || !B(x, y)) return;
  const o = own[I(x, y)];
  let html = '';
  if (o === hi) {
    const isCoastal = isCo(x, y);
    let hasCoast = false;
    if (!isCoastal) { for (let y2 = 0; y2 < H && !hasCoast; y2 += 4) for (let x2 = 0; x2 < W && !hasCoast; x2 += 4) if (own[I(x2, y2)] === hi && isCo(x2, y2)) hasCoast = true; }
    const canPort = isCoastal || hasCoast;
    const hp2 = P[hi];
    const tsc = Math.min(5, 1 + (hp2?.territory || 0) / 600);
    const bc = (base: number) => fmt(Math.round(base * tsc));
    html = `<div class="ct">⚒ Build</div>
<button data-a="city">🏙 City <span style="color:#f0c040;float:right">$${bc(C.ciC)}</span></button>
<button data-a="factory">🏭 Factory <span style="color:#f0c040;float:right">$${bc(C.faC)}</span></button>
<button data-a="port"${canPort ? '' : ' disabled'}>⚓ Port${canPort ? '' : ' (no coast)'} <span style="color:#f0c040;float:right">$${bc(C.poC)}</span></button>
<button data-a="sam">🛡 SAM <span style="color:#f0c040;float:right">$${bc(C.samC)}</span></button>
<button data-a="fort">🏰 Defense Post <span style="color:#f0c040;float:right">$${bc(C.fortC)}</span></button>
<button data-a="silo">🚀 Missile Silo <span style="color:#f0c040;float:right">$${bc(C.siloC)}</span></button>`;
  } else if (ter[I(x, y)] === 0) {
    const hasPorts = bld.some(b => b.ow === hi && b.type === 'port');
    html = `<div class="ct">🌊 Ocean</div>`;
    if (hasPorts) {
      const _wScale = Math.min(5, 1 + (P[hi]?.territory || 0) / 600);
      html += `<button data-a="warship">🚢 Deploy Warship <span style="color:#f0c040;float:right">$${fmt(Math.round(C.shC * _wScale))}</span></button>`;
    } else {
      html += `<button disabled>🚢 Warship (build a Port first)</button>`;
    }
  } else if (o >= 0 && o !== hi && P[o]?.alive) {
    const tg = P[o], dp = gD(hi, o), col = '#' + tg.color.toString(16).padStart(6, '0');
    html = `<div class="ct" style="color:${col}">${tg.name}</div>`;
    if (dp === 'peace') { html += `<button class="dn" data-a="war">⚔ Declare War</button>`; }
    else {
      html += `<button class="pc2" data-a="peace">🕊 Propose Peace</button>`;
      if (needsNaval(hi, x, y)) html += `<button data-a="naval">🚢 Naval Invasion</button>`;
      const hasSilo = bld.some(b => b.ow === hi && b.type === 'silo');
      html += `<button class="gd" data-a="nuke_a"${hasSilo ? '' : ' disabled'}>☢ A-Bomb${hasSilo ? '' : ' (need Silo)'} <span style="float:right">$${C.naC}</span></button>`;
      html += `<button class="gd" data-a="nuke_h"${hasSilo ? '' : ' disabled'}>💥 H-Bomb${hasSilo ? '' : ' (need Silo)'} <span style="float:right">$${C.nhC}</span></button>`;
    }
  } else if (o === -1 && ter[I(x, y)] > 0) {
    const naval = needsNaval(hi, x, y);
    html = `<div class="ct">Unclaimed Territory</div>`;
    if (naval) html += `<button data-a="naval">🚢 Naval Invasion</button>`;
    else html += `<button data-a="attack">⚔ Expand Here</button>`;
  } else return;

  ctxEl.innerHTML = html;
  ctxEl.style.display = 'block';
  ctxEl.style.left = Math.min(e.clientX, innerWidth - 210) + 'px';
  ctxEl.style.top = Math.min(e.clientY, innerHeight - 200) + 'px';
  ctxEl.onclick = ev => {
    const a = (ev.target as HTMLElement).closest('button')?.dataset?.a;
    if (!a) return;
    if (isMultiplayer()) {
      if (a === 'city') send({ type: 'action', action: { kind: 'buildB', btype: 'city', x, y } });
      else if (a === 'factory') send({ type: 'action', action: { kind: 'buildB', btype: 'factory', x, y } });
      else if (a === 'port') send({ type: 'action', action: { kind: 'buildB', btype: 'port', x, y } });
      else if (a === 'sam') send({ type: 'action', action: { kind: 'buildB', btype: 'sam', x, y } });
      else if (a === 'fort') send({ type: 'action', action: { kind: 'buildB', btype: 'fort', x, y } });
      else if (a === 'silo') send({ type: 'action', action: { kind: 'buildB', btype: 'silo', x, y } });
      else if (a === 'warship') send({ type: 'action', action: { kind: 'spShip', wx: x, wy: y } });
      else if (a === 'war') send({ type: 'action', action: { kind: 'sD', b: o, status: 'war' } });
      else if (a === 'peace') send({ type: 'action', action: { kind: 'sD', b: o, status: 'peace' } });
      else if (a === 'naval') send({ type: 'action', action: { kind: 'navInv', tx: x, ty: y } });
      else if (a === 'nuke_a') send({ type: 'action', action: { kind: 'doNuke', nukeType: 'a', tx: x, ty: y } });
      else if (a === 'nuke_h') send({ type: 'action', action: { kind: 'doNuke', nukeType: 'h', tx: x, ty: y } });
      else if (a === 'attack') { const tr = P[hi].troops * atkRatio; if (tr > 5) send({ type: 'action', action: { kind: 'mkWave', cx: x, cy: y, tr, targetOwner: -1 } }); }
    } else {
      if (a === 'city') buildB(hi, 'city', x, y);
      else if (a === 'factory') buildB(hi, 'factory', x, y);
      else if (a === 'port') buildB(hi, 'port', x, y);
      else if (a === 'sam') buildB(hi, 'sam', x, y);
      else if (a === 'fort') buildB(hi, 'fort', x, y);
      else if (a === 'silo') buildB(hi, 'silo', x, y);
      else if (a === 'warship') spShip(hi, x, y);
      else if (a === 'war') sD(hi, o, 'war');
      else if (a === 'peace') sD(hi, o, 'peace');
      else if (a === 'naval') navInv(hi, x, y);
      else if (a === 'nuke_a') doNuke(hi, 'a', x, y);
      else if (a === 'nuke_h') doNuke(hi, 'h', x, y);
      else if (a === 'attack') { const tr = P[hi].troops * atkRatio; if (tr > 5) mkWave(hi, x, y, tr, -1); }
    }
    hideCm();
  };
});

cv.addEventListener('wheel', e => {
  e.preventDefault();
  setZm(Math.max(.3, Math.min(6, zm * (e.deltaY < 0 ? 1.1 : .9))));
}, { passive: false });

addEventListener('keydown', e => { if (e.key === 'Escape') hideCm(); });

// Touch support
let ltx = 0, lty = 0, ltd = 0, tDrag = false;
cv.addEventListener('touchstart', e => {
  e.preventDefault(); hideCm();
  if (e.touches.length === 1) { ltx = e.touches[0].clientX; lty = e.touches[0].clientY; tDrag = false; }
  if (e.touches.length === 2) ltd = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
}, { passive: false });

cv.addEventListener('touchmove', e => {
  e.preventDefault(); tDrag = true;
  if (e.touches.length === 1) {
    setCam(camX - (e.touches[0].clientX - ltx) / zm, camY - (e.touches[0].clientY - lty) / zm);
    ltx = e.touches[0].clientX; lty = e.touches[0].clientY;
  }
  if (e.touches.length === 2) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    setZm(Math.max(.3, Math.min(6, zm * d / ltd))); ltd = d;
  }
}, { passive: false });

cv.addEventListener('touchend', e => {
  if (!tDrag && e.changedTouches.length === 1) {
    const { x, y } = s2m(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    const hi = P.findIndex(p => p.hu);
    if (hi >= 0 && P[hi].alive && B(x, y)) {
      const o = own[I(x, y)];
      if (o !== hi) {
        const tr = P[hi].troops * atkRatio;
        if (tr > 5) {
          if (o >= 0 && P[o]?.alive && gD(hi, o) !== 'peace') {
            if (isMultiplayer()) send({ type: 'action', action: { kind: 'mkWave', cx: x, cy: y, tr, targetOwner: o } });
            else mkWave(hi, x, y, tr, o);
          } else if (o === -1) {
            if (isMultiplayer()) send({ type: 'action', action: { kind: 'mkWave', cx: x, cy: y, tr, targetOwner: -1 } });
            else mkWave(hi, x, y, tr, -1);
          }
        }
      }
    }
  }
}, { passive: false });
