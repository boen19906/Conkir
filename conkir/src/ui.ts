import { P, wav, notifs, botProposals, setBotProposals, underAttack, lastAttackNotif, setUnderAttack, setLastAttackNotif, tk, addNotif } from './state';
import { DI } from './constants';
import { sD } from './diplomacy';
import { gD } from './diplomacy';

export const ctxEl = document.getElementById('ctx') as HTMLDivElement;

export function hideCm() { ctxEl.style.display = 'none'; }

export function fmt(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return (n | 0).toLocaleString();
}

export function updUI() {
  const h = P.find(p => p.hu);
  if (!h) return;
  (document.getElementById('hTr') as HTMLElement).textContent = `${fmt(h.troops)} / ${fmt(h.maxTroops)}`;
  (document.getElementById('hMo') as HTMLElement).textContent = `$${fmt(h.money)}`;
  const _tc = P.reduce((s, p) => s + (p.alive ? p.territory : 0), 0) || 1;
  (document.getElementById('hTe') as HTMLElement).textContent = `${(h.territory / _tc * 100).toFixed(1)}%`;
  (document.getElementById('hIn') as HTMLElement).textContent = `+$${h.income.toFixed(1)}`;

  const so = [...P].sort((a, b) => b.territory - a.territory);
  const hi = P.findIndex(q => q.hu);
  let html = '<h3>Players</h3>';
  for (const p of so) {
    const c = '#' + p.color.toString(16).padStart(6, '0');
    const tg = p.hu ? ' (You)' : ` [${DI[p.df]}]`;
    const cr = so[0] === p && p.alive ? ' 👑' : '';
    const dp = p.hu || hi < 0 ? '' : gD(hi, p.id) === 'peace' ? ' 🕊' : '';
    const pct = p.alive ? (p.territory / _tc * 100).toFixed(1) + '%' : '☠';
    html += `<div class="pr${p.alive ? '' : ' dead'}"><span class="pc" style="background:${c}"></span><span class="pn">${p.name}${tg}${dp}${cr}</span><span class="pt">${pct}</span></div>`;
  }
  (document.getElementById('plist') as HTMLElement).innerHTML = html;

  const mw = wav.filter(w => w.pi === hi);
  const wIncoming = wav.filter(w => w.targetOwner === hi && w.troops > 50);
  const tot = Math.round(wIncoming.reduce((s, w) => s + w.troops, 0) || 0);
  const wasUnderAttack = underAttack;
  setUnderAttack(wIncoming.length > 0);
  if (underAttack && (!wasUnderAttack || tk - lastAttackNotif >= 100)) {
    setLastAttackNotif(tk);
    addNotif(hi, `⚠ Under attack: ${fmt(tot)} troops incoming!`, '#E74C3C');
  }

  (document.getElementById('waves') as HTMLElement).innerHTML = '';
  const wc = document.getElementById('waveCounter');
  if (wc) {
    const outTot = Math.round(mw.reduce((s, w) => s + w.troops, 0));
    const inTot = Math.round(wIncoming.reduce((s, w) => s + w.troops, 0));
    let wcHtml = '';
    if (outTot > 0) wcHtml += `<div style="background:rgba(10,20,35,.88);border:1px solid #4A90D9;border-radius:5px;padding:4px 12px;font-size:12px;color:#4A90D9;margin-bottom:3px">⚔ Attacking: ${fmt(outTot)} troops</div>`;
    if (inTot > 0) wcHtml += `<div style="background:rgba(10,20,35,.88);border:1px solid #E74C3C;border-radius:5px;padding:4px 12px;font-size:12px;color:#E74C3C;margin-bottom:3px">⚠ Defending vs ${fmt(inTot)} troops</div>`;
    wc.innerHTML = wcHtml;
    const wcH = wc.offsetHeight;
    (document.getElementById('notifCont') as HTMLElement).style.bottom = (60 + wcH + 4) + 'px';
  }

  const nc = document.getElementById('notifCont');
  if (nc) {
    const hi2 = P.findIndex(q => q.hu);
    // Bot peace proposals (inline, not modal)
    let proposalHtml = '';
    for (const prop of botProposals) {
      const col = '#' + prop.color.toString(16).padStart(6, '0');
      proposalHtml += `<div data-prop-from="${prop.from}" style="background:rgba(10,20,35,.95);border:1px solid #2ECC71;border-radius:5px;padding:6px 10px;font-size:12px;color:#e0e0e0;display:flex;align-items:center;gap:6px">
        <span style="color:${col};font-weight:700">🕊 ${prop.name}</span><span style="flex:1">proposes peace</span>
        <button data-prop-accept="${prop.from}" style="background:#2ECC71;color:#fff;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:11px">Accept</button>
        <button data-prop-reject="${prop.from}" style="background:#E74C3C;color:#fff;border:none;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:11px">Decline</button>
      </div>`;
    }
    const notifHtml = notifs.slice(-4).reverse().map(n => {
      const op = Math.min(1, n.ttl / 60);
      return `<div style="background:rgba(10,20,35,.9);border:1px solid ${n.color || '#7ec8e3'};border-radius:5px;padding:5px 12px;font-size:12px;color:${n.color || '#e0e0e0'};opacity:${op.toFixed(2)}">${n.msg}</div>`;
    }).join('');
    nc.innerHTML = proposalHtml + notifHtml;
    // Wire Accept/Decline buttons
    nc.querySelectorAll<HTMLButtonElement>('button[data-prop-accept]').forEach(btn => {
      btn.onclick = () => {
        const from = parseInt(btn.dataset.propAccept!);
        sD(hi2, from, 'peace', true);
        addNotif(hi2, `🕊 Peace accepted with ${P[from]?.name}!`, '#2ECC71');
        setBotProposals(botProposals.filter(p => p.from !== from));
      };
    });
    nc.querySelectorAll<HTMLButtonElement>('button[data-prop-reject]').forEach(btn => {
      btn.onclick = () => {
        const from = parseInt(btn.dataset.propReject!);
        setBotProposals(botProposals.filter(p => p.from !== from));
      };
    });
  }
}
