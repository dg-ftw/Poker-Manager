// ── STATE ──────────────────────────────────────────
const API = '/api';
let currentPeriod = 'all';
let currentGroup = '';

// ── UTILS ──────────────────────────────────────────
function fmt(n) {
  const abs = Math.abs(Math.round(n)).toLocaleString('en-IN');
  if (n > 0) return '+₹' + abs;
  if (n < 0) return '−₹' + abs;
  return '₹0';
}
function fmtPlain(n) { return '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN'); }
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── INIT & FETCH GROUPS ────────────────────────────
async function init() {
  try {
    const res = await fetch(API + '/groups');
    if (!res.ok) throw new Error();
    const groups = await res.json();
    
    const select = document.getElementById('group-select');
    if (groups.length === 0) {
      select.innerHTML = '<option value="">No groups exist yet</option>';
      renderLeaderboard([]);
      renderRecent([]);
      return;
    }
    
    select.innerHTML = groups.map(g => `<option value="${g}">${g}</option>`).join('');
    
    // Default to the first group, or whatever was stored in local session state if available
    try {
      const liveData = localStorage.getItem('poker_live');
      if (liveData) {
        const p = JSON.parse(liveData);
        if (p.groupName && groups.includes(p.groupName)) {
          select.value = p.groupName;
        }
      }
    } catch(e) {}

    currentGroup = select.value;
    fetchLeaderboard();
  } catch (err) {
    document.getElementById('group-select').innerHTML = '<option value="">Error loading groups</option>';
  }
}

// ── FILTER ACTIONS ─────────────────────────────────
function onGroupChange() {
  currentGroup = document.getElementById('group-select').value;
  if (currentGroup) fetchLeaderboard();
}

function setPeriod(period) {
  currentPeriod = period;
  ['all','week','month','quarter'].forEach(p => {
    document.getElementById('ft-' + p).classList.toggle('active', p === period);
  });
  if (currentGroup) fetchLeaderboard();
}

// ── FETCH LEADERBOARD ──────────────────────────────
async function fetchLeaderboard() {
  const lbBody = document.getElementById('lb-body');
  lbBody.innerHTML = `<div class="empty-state"><div class="empty-msg">Loading…</div></div>`;

  try {
    const res = await fetch(`${API}/leaderboard?period=${currentPeriod}&group=${encodeURIComponent(currentGroup)}`);
    if (!res.ok) throw new Error('Failed to load');
    const data = await res.json();
    renderLeaderboard(data.players);
    renderRecent(data.recentSessions);
  } catch (err) {
    lbBody.innerHTML = `<div class="empty-state">
      <div class="empty-suits">♠ ♦</div>
      <div class="empty-msg">Could not load data</div>
      <div class="empty-hint">${err.message}</div>
    </div>`;
  }
}

// ── RENDER LEADERBOARD ─────────────────────────────
function renderLeaderboard(players) {
  const el = document.getElementById('lb-body');
  const countEl = document.getElementById('lb-count');

  if (!players || players.length === 0) {
    countEl.textContent = '—';
    el.innerHTML = `<div class="empty-state">
      <div class="empty-suits">♠ ♥ ♦ ♣</div>
      <div class="empty-msg">No sessions recorded for this group</div>
      <div class="empty-hint">Play a session and save results to see the leaderboard.</div>
    </div>`;
    return;
  }

  countEl.textContent = players.length + ' PLAYERS';
  const rankIcons = ['🥇','🥈','🥉'];
  const rankClass = ['gold','silver','bronze'];

  const rows = players.map((p, i) => {
    const profitCls = p.totalProfit > 0 ? 'up' : p.totalProfit < 0 ? 'down' : 'even';
    return `<tr class="lb-row" style="animation-delay:${i*0.04}s">
      <td><span class="rank ${rankClass[i]||''}">${i < 3 ? rankIcons[i] : i+1}</span></td>
      <td>
        <div class="lb-name">${p.name}</div>
        <div class="lb-meta">${p.sessions} session${p.sessions!==1?'s':''} · ${p.winRate}% win rate</div>
      </td>
      <td class="lb-stat">${p.wins}W / ${p.losses}L</td>
      <td class="lb-stat">${fmt(p.avgProfit)}/session</td>
      <td><div class="lb-profit ${profitCls}">${fmt(p.totalProfit)}</div></td>
    </tr>`;
  }).join('');

  el.innerHTML = `<table class="lb-table">
    <thead><tr class="lb-head">
      <th>#</th>
      <th>Player</th>
      <th>W / L</th>
      <th>Avg</th>
      <th style="text-align:right">Net Profit</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ── RENDER RECENT SESSIONS ─────────────────────────
function renderRecent(sessions) {
  const panel = document.getElementById('panel-recent');
  const el = document.getElementById('recent-body');

  if (!sessions || sessions.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';

  el.innerHTML = sessions.map((s, i) => {
    const dateStr = new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    return `<div class="session-card" style="animation-delay:${i*0.04}s">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="session-date">${dateStr}</span>
        <span class="session-meta">${s.playerCount} players · Pot ${fmtPlain(s.potTotal)}</span>
      </div>
      <div class="session-players">
        ${s.players.map(p => {
          const cls = p.profit > 0 ? 'up' : p.profit < 0 ? 'down' : 'even';
          return `<span class="session-player-chip ${cls}">${p.name} ${fmt(p.profit)}</span>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

// ── RUN ────────────────────────────────────────────
init();
