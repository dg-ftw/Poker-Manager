// ── CONSTANTS ──────────────────────────────────────
const COLORS = ['#c0392b','#2980b9','#27ae60','#8e44ad','#e67e22','#16a085','#e91e63','#f39c12','#1abc9c','#d35400'];
const API = '/api';

// ── STATE ──────────────────────────────────────────
let session = { groupName: '', buyinUnit: 500, players: [] }; // { name, buyins, color }

// ── LOCAL PERSISTENCE (survives refresh) ───────────
function saveLocal() { localStorage.setItem('poker_live', JSON.stringify(session)); }
function loadLocal() {
  try {
    const d = localStorage.getItem('poker_live');
    if (d) session = JSON.parse(d);
  } catch(e) {}
}
function clearLocal() { localStorage.removeItem('poker_live'); }

// ── UTILS ──────────────────────────────────────────
function fmt(n) {
  const abs = Math.abs(Math.round(n)).toLocaleString('en-IN');
  if (n > 0) return '+₹' + abs;
  if (n < 0) return '−₹' + abs;
  return '₹0';
}
function fmtPlain(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
function initials(name) { return name.trim().split(/\s+/).map(w=>w[0]).join('').substring(0,2).toUpperCase(); }
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── FETCH GROUPS ───────────────────────────────────
async function fetchGroups() {
  try {
    const res = await fetch(API + '/groups');
    if (!res.ok) return;
    const groups = await res.json();
    const list = document.getElementById('groups-list');
    list.innerHTML = groups.map(g => `<option value="${g}">`).join('');
  } catch (err) {}
}

// ── SETUP ──────────────────────────────────────────
function onGroupChange() {
  const v = document.getElementById('inp-group').value.trim();
  session.groupName = v;
  saveLocal();
}

function onUnitChange() {
  const v = parseInt(document.getElementById('inp-unit').value);
  if (v > 0) { session.buyinUnit = v; saveLocal(); render(); }
}

function addPlayer() {
  const groupInp = document.getElementById('inp-group');
  if (!session.groupName) {
    toast('Please enter a Group Name first!');
    groupInp.focus();
    return;
  }

  const inp = document.getElementById('inp-name');
  const name = inp.value.trim();
  if (!name) { inp.focus(); return; }
  if (session.players.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    toast('Player already at the table!'); return;
  }
  session.players.push({
    name,
    buyins: 0,
    color: COLORS[session.players.length % COLORS.length]
  });
  inp.value = '';
  inp.focus();
  saveLocal();
  render();
  toast('🃏 ' + name + ' joined');
}

function removePlayer(i) {
  const name = session.players[i].name;
  session.players.splice(i, 1);
  saveLocal();
  render();
  toast(name + ' removed');
}

function adjustBuyin(i, delta) {
  const p = session.players[i];
  const next = p.buyins + delta;
  if (next < 0) return;
  p.buyins = next;
  saveLocal();
  render();
}

// ── RENDER ─────────────────────────────────────────
function render() {
  document.getElementById('inp-group').value = session.groupName || '';
  document.getElementById('inp-unit').value = session.buyinUnit;
  const list = document.getElementById('players-list');
  const endBtn = document.getElementById('btn-end');

  if (session.players.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-suits">♠ ♥ ♦ ♣</div>
      <div class="empty-msg">No players yet</div>
      <div class="empty-hint">Add players above to start the session.</div>
    </div>`;
    endBtn.style.display = 'none';
    document.getElementById('pot-total').textContent = 'Pot: ₹0';
    return;
  }

  const potTotal = session.players.reduce((s, p) => s + p.buyins, 0) * session.buyinUnit;
  document.getElementById('pot-total').textContent = 'Pot: ' + fmtPlain(potTotal);

  const hasAnyBuyins = session.players.some(p => p.buyins > 0);
  endBtn.style.display = hasAnyBuyins ? 'flex' : 'none';

  list.innerHTML = session.players.map((p, i) => {
    const amt = p.buyins * session.buyinUnit;
    return `<div class="player-card" style="animation-delay:${i*0.05}s">
      <div class="avatar" style="background:${p.color}20;color:${p.color};border-color:${p.color}40;">${initials(p.name)}</div>
      <div class="player-info">
        <div class="player-name">${p.name}</div>
        <div class="player-amount">${amt > 0 ? fmtPlain(amt) : 'No buy-in yet'}</div>
      </div>
      <div class="counter-group">
        <button class="btn-counter btn-minus" onclick="adjustBuyin(${i},-1)" ${p.buyins===0?'disabled':''}>−</button>
        <span class="buyin-count">${p.buyins}</span>
        <button class="btn-counter" onclick="adjustBuyin(${i},1)">+</button>
      </div>
      <button class="btn-remove" onclick="removePlayer(${i})" title="Remove">✕</button>
    </div>`;
  }).join('');
}

// ── END SESSION ────────────────────────────────────
function openEndSession() {
  const activePlayers = session.players.filter(p => p.buyins > 0);
  if (activePlayers.length === 0) { toast('No active buy-ins to settle!'); return; }

  const body = document.getElementById('settlement-body');
  const totalUnits = activePlayers.reduce((s, p) => s + p.buyins, 0);

  body.innerHTML = `
    <div class="settle-section-title">Enter Final Chip Counts (in units)</div>
    ${activePlayers.map((p, i) => `
      <div class="settle-player-row">
        <div class="avatar" style="background:${p.color}20;color:${p.color};border-color:${p.color}40;width:32px;height:32px;font-size:12px;">${initials(p.name)}</div>
        <div class="settle-name">${p.name}</div>
        <div class="settle-bought">bought: ${p.buyins}</div>
        <input type="number" class="settle-input" id="chips-${i}" data-idx="${i}" min="0" value="" placeholder="0" oninput="onChipsChange()" />
      </div>
    `).join('')}
    <div id="settle-validation" class="settle-validation invalid">
      Total must equal ${totalUnits} units
    </div>
    <div id="settle-results" style="display:none;"></div>
  `;

  document.getElementById('settlement-footer').style.display = 'none';
  document.getElementById('modal-session').classList.add('open');
}

function onChipsChange() {
  const activePlayers = session.players.filter(p => p.buyins > 0);
  const totalUnits = activePlayers.reduce((s, p) => s + p.buyins, 0);

  let chipSum = 0;
  let allFilled = true;
  const chips = [];

  activePlayers.forEach((p, i) => {
    const inp = document.getElementById('chips-' + i);
    const val = parseInt(inp.value);
    if (isNaN(val) || inp.value === '') { allFilled = false; chips.push(0); }
    else { chips.push(val); chipSum += val; }
  });

  const validEl = document.getElementById('settle-validation');
  const resultsEl = document.getElementById('settle-results');
  const footerEl = document.getElementById('settlement-footer');

  if (!allFilled || chipSum !== totalUnits) {
    validEl.className = 'settle-validation invalid';
    validEl.textContent = `Total: ${chipSum} / ${totalUnits} units ${chipSum === totalUnits ? '✓' : '✗'}`;
    resultsEl.style.display = 'none';
    footerEl.style.display = 'none';
    return;
  }

  validEl.className = 'settle-validation valid';
  validEl.textContent = `Total: ${chipSum} / ${totalUnits} units ✓`;

  // Calculate P&L
  const results = activePlayers.map((p, i) => ({
    name: p.name,
    buyins: p.buyins,
    finalChips: chips[i],
    net: chips[i] - p.buyins,
    profit: (chips[i] - p.buyins) * session.buyinUnit,
    color: p.color
  }));

  // Settlement (greedy)
  const settlements = computeSettlements(results, session.buyinUnit);

  resultsEl.style.display = 'block';
  resultsEl.innerHTML = `
    <div class="settle-section-title">Results</div>
    ${results.map(r => {
      const cls = r.profit > 0 ? 'up' : r.profit < 0 ? 'down' : 'even';
      return `<div class="result-row">
        <span>${r.name}</span>
        <span class="result-profit ${cls}">${fmt(r.profit)}</span>
      </div>`;
    }).join('')}
    ${settlements.length > 0 ? `
      <div class="settle-section-title">Settlements</div>
      ${settlements.map(s => `
        <div class="transfer-row">
          <strong>${s.from}</strong>
          <span class="transfer-arrow">→</span>
          <span>${s.to}</span>
          <span class="transfer-amount">${fmtPlain(s.amount)}</span>
        </div>
      `).join('')}
    ` : '<div style="color:var(--text3);font-size:12px;text-align:center;margin-top:16px;">Everyone broke even!</div>'}
  `;

  footerEl.style.display = 'flex';
}

function computeSettlements(results, unit) {
  const debtors = [];
  const creditors = [];

  results.forEach(r => {
    const amt = r.net * unit;
    if (amt < 0) debtors.push({ name: r.name, amount: Math.abs(amt) });
    else if (amt > 0) creditors.push({ name: r.name, amount: amt });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let di = 0, ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const transfer = Math.min(debtors[di].amount, creditors[ci].amount);
    settlements.push({ from: debtors[di].name, to: creditors[ci].name, amount: transfer });
    debtors[di].amount -= transfer;
    creditors[ci].amount -= transfer;
    if (debtors[di].amount === 0) di++;
    if (creditors[ci].amount === 0) ci++;
  }

  return settlements;
}

// ── SAVE SESSION TO DB ─────────────────────────────
async function saveSession() {
  const activePlayers = session.players.filter(p => p.buyins > 0);
  const chips = [];

  activePlayers.forEach((p, i) => {
    const val = parseInt(document.getElementById('chips-' + i).value);
    chips.push(val);
  });

  const players = activePlayers.map((p, i) => ({
    name: p.name,
    buyins: p.buyins,
    finalChips: chips[i],
    net: chips[i] - p.buyins
  }));

  const settlements = computeSettlements(
    players.map(p => ({ ...p, color: '' })),
    session.buyinUnit
  );

  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const res = await fetch(API + '/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        group: session.groupName, 
        buyinUnit: session.buyinUnit, 
        players, 
        settlements 
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }

    // Clear live session players but KEEP groupName and buyinUnit
    session.players = [];
    saveLocal();
    closeModal();
    render();
    toast('✓ Session saved! Check the leaderboard.');
  } catch (err) {
    toast('Error: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Save & Close ♦';
  }
}

// ── MODAL ──────────────────────────────────────────
function closeModal() {
  document.getElementById('modal-session').classList.remove('open');
}
document.getElementById('modal-session').addEventListener('click', e => {
  if (e.target.id === 'modal-session') closeModal();
});

// ── INIT ───────────────────────────────────────────
loadLocal();
fetchGroups();
render();
