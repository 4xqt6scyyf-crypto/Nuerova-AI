/**
 * NEROVAI AGENT HQ — Office Simulation Runtime
 * Full rebuild. Vanilla JS. No frameworks.
 *
 * Easter eggs (preserved):
 *  1. Click any agent 5× rapidly → chaos mode
 *  2. Konami code → party mode (↑↑↓↓←→←→BA)
 *  3. Click Bugsy 3× → "Found a bug in reality"
 *  4. Type "chaos" → trigger all events
 *  5. Hover Launch for 5s → rocket launch event
 *  6. Double-click HQ header → secret admin whisper
 *  7. Shift+click any agent → debug dump
 *  8. Cash confetti rain on celebrate event
 *  9. Cash + Archi dialogue on party mode
 */

'use strict';

const API_BASE = window.location.hostname === 'localhost'
  ? ''
  : 'https://api.nerovai.com';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const AGENT_IDS = ['archi','stack','pixel','cash','bugsy','delta','launch','guard','nova'];

const SPEECH_POOLS = {
  archi:  ['This architecture is unacceptable.','3 circular deps detected.','Route audit: 12/14 mapped.','Service layer needed.','Who wrote this middleware??'],
  stack:  ['Deploy in 4m12s. Unacceptable.','99.97% uptime. Not good enough.','nixpacks v2 is cooking…','Build cache MISS. Ugh.','Health check green. 😮‍💨'],
  pixel:  ['That padding is 9px not 8px.','Spacing inconsistency: 17 issues.','These fonts are NOT rendering right.','Motion needs easing curve.','8px grid or I quit.'],
  cash:   ['12% drop at Pro CTA. Unacceptable.','LTV/CAC looking spicy. 💰','Board deck: 94% done.','Convert this free user NOW.','Revenue up. Crown stays on.'],
  bugsy:  ['Found a bug. Obviously.','Stack is hiding something.','847 test cases. Found 3 issues.','This null vs undefined is suspicious.','I see EVERYTHING.'],
  delta:  ['Anomaly at 3σ. Investigating.','Model drift detected.','P99 latency spike. Noted.','Cross-referencing 6 datasets.','Hypothesis confirmed.'],
  launch: ['T-minus 4 minutes.','Deploy pipeline nominal.','Stage 3 ignition complete.','This feature is LAUNCHING.','Houston, we have uptime.'],
  guard:  ['Perimeter secured.','Suspicious pattern flagged.','Auth log: 0 intrusions.','Rate limiter engaged.','Nothing gets past Guard.'],
  nova:   ['Processing 847 tokens/sec.','Embedding vectors: nominal.','Temperature: 0.7. Optimal.','Neural cascade complete.','I have analyzed everything.'],
};

const BREAK_ROOM_ACTIONS = [
  'grabbing coffee ☕','stress-eating 🍫','staring at wall','on phone 📱',
  'eating pizza 🍕','power nap mode 😴','venting to no one','contemplating career choices',
];

const OFFICE_EVENTS = [
  { id: 'water-balloon',    label: '💦 Water Balloon Fight!',          agents: ['bugsy','stack'],      action: waterBalloonFight },
  { id: 'coffee-spill',     label: '☕ Someone spilled the coffee!',    agents: ['stack','pixel'],      action: coffeeSpill },
  { id: 'pizza-delivery',   label: '🍕 Pizza just arrived!',           agents: null,                   action: pizzaDelivery },
  { id: 'vending-stuck',    label: '🎰 Vending machine jammed again!', agents: ['bugsy'],              action: vendingJam },
  { id: 'chair-race',       label: '🪑 Unauthorized chair race!',      agents: ['launch','stack'],     action: chairRace },
  { id: 'snack-stolen',     label: '🍫 Someone stole Cash\'s snacks!', agents: ['cash','bugsy'],       action: snackStolen },
  { id: 'fire-drill',       label: '🚨 FIRE DRILL — everyone out!',    agents: null,                   action: fireDrill },
  { id: 'prod-outage',      label: '🔴 Prod is down! All hands!',      agents: null,                   action: prodOutage },
  { id: 'standup-overran',  label: '⏱ Standup has been 47 minutes.',  agents: null,                   action: standupOverran },
  { id: 'yolo-deploy',      label: '🎲 Someone pushed to main!',       agents: ['stack','launch'],     action: yoloDeploy },
];

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

let agents      = {};
let feedItems   = [];
let selectedId  = null;
let activeTab   = 'overview';
let socket      = null;
let partyMode   = false;
let agentsInBreakRoom = new Set();

// Easter egg state
const clickCounts   = {};
const bugsyClicks   = { count: 0, ts: 0 };
let   konamiIdx     = 0;
let   typedBuffer   = '';
const KONAMI        = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let   launchHoverTimer = null;

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  startClock();
  connectSocket();
  loadState();
  startOfficeSimulation();
  hookEasterEggs();

  // Double-click header easter egg
  document.getElementById('hq-header').addEventListener('dblclick', () => {
    showBanner('🤫 Admin whisper: "Nova knows everything."');
  });

  // Launch hover easter egg
  const launchWs = document.querySelector('.workstation[data-id="launch"]');
  if (launchWs) {
    launchWs.addEventListener('mouseenter', () => {
      launchHoverTimer = setTimeout(() => triggerEvent(OFFICE_EVENTS[4]), 5000);
    });
    launchWs.addEventListener('mouseleave', () => {
      clearTimeout(launchHoverTimer);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════════════════════════════════════

function startClock() {
  const el = document.getElementById('hq-clock');
  const tick = () => {
    const now  = new Date();
    const hh   = String(now.getHours()).padStart(2,'0');
    const mm   = String(now.getMinutes()).padStart(2,'0');
    const ss   = String(now.getSeconds()).padStart(2,'0');
    el.textContent = `${hh}:${mm}:${ss}`;
  };
  tick();
  setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════════════════════════════════
// SOCKET
// ═══════════════════════════════════════════════════════════════════════════

function connectSocket() {
  try {
    if (typeof window.io !== 'function') {
      console.warn('[HQ] Socket.io client unavailable');
      return;
    }

    socket = window.io(API_BASE || window.location.origin, {
      transports: ['websocket', 'polling']
    });
    socket.emit('join-agent-hq');

    socket.on('agent:state', (data) => {
      if (data.agents) {
        data.agents.forEach(a => { agents[a.id] = a; });
        renderAllWorkstations();
        updateHeaderStats();
      }
      if (data.feed) {
        feedItems = data.feed;
        renderFeedTicker();
      }
      if (data.uptime !== undefined) {
        document.getElementById('stat-uptime').textContent = formatUptime(data.uptime);
      }
    });

    socket.on('agent:tick', (a) => {
      if (!a || !a.id) return;
      agents[a.id] = a;
      renderWorkstation(a.id);
      if (selectedId === a.id) renderInspectBody();
      updateHeaderStats();
    });

    socket.on('agent:speech', ({ agentId, msg }) => {
      showSpeech(agentId, msg);
    });

    socket.on('activity:new', (entry) => {
      feedItems.unshift(entry);
      if (feedItems.length > 80) feedItems.pop();
      renderFeedTicker();
    });

    socket.on('chaos:event', ({ agentId, msg }) => {
      showBanner(msg);
      shakeAgent(agentId);
    });

    socket.on('celebrate:agent', ({ agentId }) => {
      celebrateAgent(agentId);
    });

  } catch (e) {
    console.warn('[HQ] Socket unavailable, running in demo mode');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOAD STATE
// ═══════════════════════════════════════════════════════════════════════════

async function loadState() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      setAllTaskLabels('Sign in to load live agent activity.');
      return;
    }

    const res = await fetch(`${API_BASE}/api/agents/state`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      setAllTaskLabels('Unable to load live agent state.');
      return;
    }

    const data = await res.json();
    if (data.agents) {
      data.agents.forEach(a => { agents[a.id] = a; });
      renderAllWorkstations();
      updateHeaderStats();
    }
    if (data.feed) {
      feedItems = data.feed.slice(0, 60);
      renderFeedTicker();
    }
    if (data.uptime !== undefined) {
      document.getElementById('stat-uptime').textContent = formatUptime(data.uptime);
    }
  } catch (e) {
    console.warn('[HQ] State load failed:', e.message);
    setAllTaskLabels('Live agent feed unavailable.');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER — WORKSTATIONS
// ═══════════════════════════════════════════════════════════════════════════

function renderAllWorkstations() {
  AGENT_IDS.forEach(id => renderWorkstation(id));
}

function renderWorkstation(id) {
  const a = agents[id];
  if (!a) return;

  // Status dot
  const dot = document.getElementById(`dot-${id}`);
  if (dot) {
    dot.className = `status-dot ${a.status || 'idle'}`;
  }

  // Task text
  const taskEl = document.getElementById(`task-${id}`);
  if (taskEl) taskEl.textContent = a.task || '—';

  // Progress bar
  const progEl = document.getElementById(`prog-${id}`);
  if (progEl) progEl.style.width = `${a.progress || 0}%`;

  // Character animation class based on status
  const charEl = document.getElementById(`char-${id}`);
  if (charEl) {
    charEl.className = `agent-char ${getCharAnim(a.status)}`;
  }
}

function getCharAnim(status) {
  switch (status) {
    case 'working':   return 'char-anim-work';
    case 'deploying': return 'char-anim-deploy';
    case 'done':      return 'char-anim-bounce';
    case 'error':     return 'char-anim-shake';
    case 'idle':
    case 'break':     return 'char-anim-idle';
    default:          return 'char-anim-idle';
  }
}

function setAllTaskLabels(message) {
  AGENT_IDS.forEach((id) => {
    const taskEl = document.getElementById(`task-${id}`);
    if (taskEl) {
      taskEl.textContent = message;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADER STATS
// ═══════════════════════════════════════════════════════════════════════════

function updateHeaderStats() {
  const all = Object.values(agents);
  const active = all.filter(a => a.status && a.status !== 'idle' && a.status !== 'break').length;
  const tasks  = all.filter(a => a.task && a.status === 'working').length;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-tasks').textContent  = tasks;
}

// ═══════════════════════════════════════════════════════════════════════════
// FEED TICKER
// ═══════════════════════════════════════════════════════════════════════════

function renderFeedTicker() {
  const track = document.getElementById('feed-track');
  if (!track) return;

  const items = feedItems.slice(0, 20);
  if (items.length === 0) return;

  // Build items twice (for seamless loop)
  const html = [...items, ...items].map(item => {
    const agent = agents[item.from] || { name: item.from || 'System' };
    const msg   = item.msg || item.message || '';
    return `
      <span class="feed-item">
        <span class="feed-agent-tag">${esc(agent.name)}</span>
        <span class="feed-dot-sep"></span>
        <span>${esc(msg)}</span>
      </span>`;
  }).join('');

  track.innerHTML = html;

  // Reset animation
  track.style.animation = 'none';
  void track.offsetWidth;
  track.style.animation = '';
}

// ═══════════════════════════════════════════════════════════════════════════
// SPEECH BUBBLES
// ═══════════════════════════════════════════════════════════════════════════

function showSpeech(agentId, msg) {
  const sb = document.getElementById(`sb-${agentId}`);
  if (!sb) return;
  if (agentsInBreakRoom.has(agentId)) return;

  sb.textContent = msg || (SPEECH_POOLS[agentId] || ['…'])[Math.floor(Math.random() * (SPEECH_POOLS[agentId]?.length || 1))];
  sb.classList.add('show');
  clearTimeout(sb._timer);
  sb._timer = setTimeout(() => sb.classList.remove('show'), 4000);
}

function randomSpeech(agentId) {
  const pool = SPEECH_POOLS[agentId];
  if (!pool) return;
  const msg = pool[Math.floor(Math.random() * pool.length)];
  showSpeech(agentId, msg);
}

// ═══════════════════════════════════════════════════════════════════════════
// INSPECTION PANEL
// ═══════════════════════════════════════════════════════════════════════════

function openInspect(agentId, e) {
  if (e && e.shiftKey) {
    // Easter egg: shift-click = debug dump
    const a = agents[agentId] || {};
    showToast(`🔍 ${agentId}: status=${a.status} progress=${a.progress} morale=${a.morale}`);
    return;
  }

  // Easter egg: rapid clicks
  const now = Date.now();
  if (!clickCounts[agentId]) clickCounts[agentId] = { n: 0, ts: 0 };
  const cc = clickCounts[agentId];
  if (now - cc.ts < 500) cc.n++;
  else { cc.n = 1; }
  cc.ts = now;
  if (cc.n >= 5) { cc.n = 0; triggerChaosMode(); return; }

  // Bugsy easter egg
  if (agentId === 'bugsy') {
    if (now - bugsyClicks.ts > 1500) bugsyClicks.count = 0;
    bugsyClicks.count++;
    bugsyClicks.ts = now;
    if (bugsyClicks.count >= 3) {
      bugsyClicks.count = 0;
      showSpeech('bugsy', '🐛 Found a bug in REALITY');
      showBanner('🐛 Bugsy found a bug in reality');
      return;
    }
  }

  selectedId = agentId;
  activeTab  = 'overview';

  // Mark selected
  document.querySelectorAll('.workstation').forEach(el => el.classList.remove('selected'));
  const ws = document.querySelector(`.workstation[data-id="${agentId}"]`);
  if (ws) ws.classList.add('selected');

  // Populate avatar
  const avatarBox = document.getElementById('inspect-avatar');
  const src = document.getElementById(`char-${agentId}`);
  if (avatarBox && src) {
    avatarBox.innerHTML = '';
    const clone = src.closest('.agent-char-wrap') ? src.closest('.agent-char-wrap').cloneNode(true) : src.cloneNode(true);
    clone.style.transform = 'scale(1.1)';
    clone.style.transformOrigin = 'bottom center';
    avatarBox.appendChild(clone);
  }

  const a = agents[agentId] || {};
  document.getElementById('inspect-name').textContent        = a.name || agentId;
  document.getElementById('inspect-role').textContent        = a.role || '—';
  document.getElementById('inspect-personality').textContent = a.personality || '';

  renderInspectBody();
  updateInspectTabs();

  document.getElementById('inspect-panel').classList.add('open');
  document.getElementById('inspect-overlay').classList.add('open');
}

function closeInspect() {
  selectedId = null;
  document.getElementById('inspect-panel').classList.remove('open');
  document.getElementById('inspect-overlay').classList.remove('open');
  document.querySelectorAll('.workstation').forEach(el => el.classList.remove('selected'));
}

function switchTab(tab) {
  activeTab = tab;
  updateInspectTabs();
  renderInspectBody();
}

function updateInspectTabs() {
  document.querySelectorAll('.itab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick') === `switchTab('${activeTab}')`);
  });
}

function renderInspectBody() {
  const body = document.getElementById('inspect-body');
  if (!selectedId || !body) return;

  const a = agents[selectedId] || {};

  if (activeTab === 'overview') {
    const morale     = a.morale ?? 80;
    const moraleColor = morale > 70 ? 'var(--green)' : morale > 40 ? 'var(--yellow)' : 'var(--red)';

    body.innerHTML = `
      <div class="isect">
        <div class="isect-title">Current Task</div>
        <div class="task-box">
          <div class="task-box-text">${esc(a.task || 'No active task')}</div>
          <div class="progress-row">
            <div class="progress-track"><div class="progress-fill" style="width:${a.progress||0}%"></div></div>
            <div class="progress-pct">${a.progress||0}%</div>
          </div>
        </div>
      </div>

      <div class="isect">
        <div class="isect-title">Metrics</div>
        <div class="stat-row">
          <div class="stat-box">
            <div class="stat-box-val">${a.metric?.value ?? '—'}${a.metric?.unit ?? ''}</div>
            <div class="stat-box-lbl">${a.metric?.label ?? 'Score'}</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-val">${a.streak ?? 0}d</div>
            <div class="stat-box-lbl">Streak</div>
          </div>
        </div>
        <div class="stat-row">
          <div class="stat-box">
            <div class="stat-box-val" style="color:${moraleColor}">${morale}%</div>
            <div class="stat-box-lbl">Morale</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-val">${a.status ?? 'idle'}</div>
            <div class="stat-box-lbl">Status</div>
          </div>
        </div>
        <div class="morale-row" style="margin-top:4px">
          <span style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;min-width:44px">Morale</span>
          <div class="morale-track">
            <div class="morale-fill" style="width:${morale}%;background:${moraleColor}"></div>
          </div>
        </div>
      </div>

      <div class="isect">
        <div class="isect-title">Active Files</div>
        <div class="files-wrap">
          ${(a.files || []).map(f => `
            <div class="file-row">
              <div class="file-dot"></div>
              ${esc(f)}
            </div>`).join('')}
        </div>
      </div>

      ${a.next_action ? `
      <div class="isect">
        <div class="isect-title">Next Action</div>
        <div class="task-box">
          <div class="task-box-text" style="font-size:12px;color:var(--text-secondary)">${esc(a.next_action)}</div>
        </div>
      </div>` : ''}
    `;
  }

  if (activeTab === 'logs') {
    const logs = (a.logs || []).slice().reverse().slice(0, 30);
    body.innerHTML = `
      <div class="isect">
        <div class="isect-title">${logs.length} Log Entries</div>
        <div class="log-list">
          ${logs.map((l, i) => `
            <div class="log-row ${i < 2 ? 'fresh' : ''}">
              <div class="log-time">${relTime(l.ts)}</div>
              <div class="log-text">${esc(l.msg)}</div>
            </div>`).join('')}
        </div>
      </div>
    `;
  }

  if (activeTab === 'actions') {
    body.innerHTML = `
      <div class="isect">
        <div class="isect-title">Admin Actions</div>
        <div class="admin-actions">
          <button class="admin-btn cta" onclick="pokeAgent('${selectedId}','poke')">👋 Poke Agent</button>
          <button class="admin-btn cta" onclick="pokeAgent('${selectedId}','celebrate')">🎉 Celebrate</button>
          <button class="admin-btn danger" onclick="pokeAgent('${selectedId}','chaos')">🔴 Trigger Chaos</button>
        </div>
      </div>
      <div class="isect" style="margin-top:8px">
        <div class="isect-title">Manual Speech</div>
        <div class="admin-actions">
          <button class="admin-btn" onclick="randomSpeech('${selectedId}')">💬 Random Quote</button>
          <button class="admin-btn" onclick="sendToBreakRoom('${selectedId}')">☕ Send to Break Room</button>
          <button class="admin-btn" onclick="returnFromBreakRoom('${selectedId}')">🏠 Return to Desk</button>
        </div>
      </div>
    `;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API POKE
// ═══════════════════════════════════════════════════════════════════════════

async function pokeAgent(id, type) {
  try {
    const token = localStorage.getItem('token');
    if (!token) { showToast('⚠ Not authenticated'); return; }

    const res = await fetch(`${API_BASE}/api/agents/${id}/poke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || '⚠ Poke failed');
      return;
    }

    showToast(data.message || `${id} poked (${type})`);
  } catch (e) {
    showToast('⚠ Poke failed');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BREAK ROOM
// ═══════════════════════════════════════════════════════════════════════════

function sendToBreakRoom(agentId) {
  if (agentsInBreakRoom.has(agentId)) return;
  agentsInBreakRoom.add(agentId);

  const wrap = document.getElementById(`charwrap-${agentId}`);
  if (wrap) wrap.classList.add('away');

  const agent  = agents[agentId] || { name: agentId };
  const action = BREAK_ROOM_ACTIONS[Math.floor(Math.random() * BREAK_ROOM_ACTIONS.length)];
  const src    = document.getElementById(`char-${agentId}`);

  const card = document.createElement('div');
  card.className = 'br-visitor-card';
  card.id = `brv-${agentId}`;
  card.title = `Click to send back to desk`;
  card.onclick = () => returnFromBreakRoom(agentId);

  if (src) {
    const mini = document.createElement('div');
    mini.className = 'char-mini-wrap';
    const miniChar = src.cloneNode(true);
    miniChar.style.animation = 'charIdle 2.5s ease-in-out infinite';
    mini.appendChild(miniChar);
    card.appendChild(mini);
  }

  const nameEl = document.createElement('div');
  nameEl.className = 'br-visitor-name';
  nameEl.textContent = agent.name || agentId;

  const actEl = document.createElement('div');
  actEl.className = 'br-visitor-action';
  actEl.textContent = action;

  card.appendChild(nameEl);
  card.appendChild(actEl);
  document.getElementById('br-visitors').appendChild(card);

  showSpeech(agentId, `BRB — ${action.split(' ')[0].replace(/[^a-zA-Z]/g,'') || 'break'} time`);
  showToast(`${agent.name || agentId} headed to break room`);
}

function returnFromBreakRoom(agentId) {
  if (!agentsInBreakRoom.has(agentId)) return;
  agentsInBreakRoom.delete(agentId);

  const wrap = document.getElementById(`charwrap-${agentId}`);
  if (wrap) wrap.classList.remove('away');

  const card = document.getElementById(`brv-${agentId}`);
  if (card) card.remove();

  const agent = agents[agentId] || { name: agentId };
  showSpeech(agentId, 'Back to work 💪');
  showToast(`${agent.name || agentId} is back at their desk`);
}

// ═══════════════════════════════════════════════════════════════════════════
// BREAK ROOM INTERACTIONS
// ═══════════════════════════════════════════════════════════════════════════

function triggerCoffee() {
  const station = document.getElementById('br-coffee');
  if (station) station.classList.add('brewing');
  showBanner('☕ Coffee brewing — queue forming fast');
  showToast('☕ BREW-O-MATIC activated');
  setTimeout(() => { if (station) station.classList.remove('brewing'); }, 4000);

  // Random agent goes for coffee
  const id = AGENT_IDS[Math.floor(Math.random() * AGENT_IDS.length)];
  setTimeout(() => sendToBreakRoom(id), 800);
  setTimeout(() => returnFromBreakRoom(id), 6000);
}

function triggerVending() {
  showBanner('🎰 Vending machine jammed. Again.');
  showToast('🍫 Snack Station: JAM ERROR E-07');

  const id = 'bugsy';
  sendToBreakRoom(id);
  showSpeech(id, 'This machine is BROKEN. Filing bug #448.');
  setTimeout(() => returnFromBreakRoom(id), 6000);
}

function triggerPizza() {
  showBanner('🍕 Pizza just arrived! Queue forming at break room.');
  ['archi','pixel','cash','nova'].forEach((id, i) => {
    setTimeout(() => sendToBreakRoom(id), i * 600);
    setTimeout(() => returnFromBreakRoom(id), 8000 + i * 400);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// OFFICE SIMULATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function startOfficeSimulation() {
  // Random speech every 8-15s per agent
  AGENT_IDS.forEach((id, i) => {
    const delay = 3000 + i * 1200;
    setTimeout(() => scheduleAgentSpeech(id), delay);
  });

  // Random office events every 90-180s
  scheduleNextEvent();
}

function scheduleAgentSpeech(agentId) {
  if (!agentsInBreakRoom.has(agentId)) {
    randomSpeech(agentId);
  }
  const nextIn = 8000 + Math.random() * 14000;
  setTimeout(() => scheduleAgentSpeech(agentId), nextIn);
}

function scheduleNextEvent() {
  const delay = 90000 + Math.random() * 90000; // 90–180s
  setTimeout(() => {
    const event = OFFICE_EVENTS[Math.floor(Math.random() * OFFICE_EVENTS.length)];
    triggerEvent(event);
    scheduleNextEvent();
  }, delay);
}

function triggerEvent(event) {
  showBanner(event.label);
  if (event.agents) {
    event.agents.forEach((id, i) => {
      setTimeout(() => sendToBreakRoom(id), i * 500);
      setTimeout(() => returnFromBreakRoom(id), 7000 + i * 500);
    });
  }
  if (typeof event.action === 'function') {
    event.action(event);
  }
}

// ── Event Actions ────────────────────────────────────────────────────────────

function waterBalloonFight({ agents: ids }) {
  showSpeech('bugsy', '💦 You asked for this, Stack!');
  showSpeech('stack', '💦 BUGSY I WILL RESTART YOU');
  shakeAgent('bugsy');
  shakeAgent('stack');
}

function coffeeSpill() {
  showSpeech('stack', '☕ WHO LEFT THIS HERE');
  showSpeech('pixel', '😭 NOT on the keyboard!');
  shakeAgent('stack');
}

function pizzaDelivery() {
  triggerPizza();
}

function vendingJam() {
  showSpeech('bugsy', '🎰 Bug #448: Machine. Still. Jammed.');
}

function chairRace() {
  showSpeech('launch', '🪑 T-minus 3… 2… 1…');
  showSpeech('stack', '🪑 I AM THE FASTEST');
  celebrateAgent('launch');
}

function snackStolen() {
  showSpeech('cash', '😤 WHO TOOK MY CHIPS');
  showSpeech('bugsy', '👀 I saw nothing. Nothing I say.');
  shakeAgent('cash');
}

function fireDrill() {
  AGENT_IDS.forEach((id, i) => {
    setTimeout(() => sendToBreakRoom(id), i * 200);
    setTimeout(() => returnFromBreakRoom(id), 10000 + i * 200);
  });
  showSpeech('guard', '🚨 This is not a drill. Or is it.');
}

function prodOutage() {
  shakeAgent('stack');
  shakeAgent('archi');
  showSpeech('stack', '🔴 PROD IS DOWN. I AM DYING.');
  showSpeech('archi', '🔴 I TOLD YOU about that middleware!');
  showSpeech('guard', '🔴 Initiating incident response.');
}

function standupOverran() {
  AGENT_IDS.slice(0, 5).forEach(id => {
    showSpeech(id, '⏱ …can we please wrap up?');
  });
}

function yoloDeploy() {
  showSpeech('stack', '🎲 It worked on my machine!');
  showSpeech('launch', '🎲 Committing directly to main 🚀');
  celebrateAgent('launch');
  shakeAgent('stack');
  showBanner('🎲 Someone pushed to main at 4:57 PM on Friday');
}

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL EFFECTS
// ═══════════════════════════════════════════════════════════════════════════

function shakeAgent(agentId) {
  const el = document.getElementById(`char-${agentId}`);
  if (!el) return;
  el.classList.add('char-anim-shake');
  setTimeout(() => el.classList.remove('char-anim-shake'), 1500);
}

function celebrateAgent(agentId) {
  const el = document.getElementById(`char-${agentId}`);
  if (!el) return;
  el.classList.add('char-anim-celebrate');
  if (agentId === 'cash') spawnConfetti();
  setTimeout(() => {
    el.classList.remove('char-anim-celebrate');
    el.classList.add(getCharAnim((agents[agentId] || {}).status));
  }, 4000);
}

function spawnConfetti() {
  const colors = ['#ffd54f','#ff6b6b','#1de9b6','#5b8dee','#bb86fc','#ffab40'];
  for (let i = 0; i < 40; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.style.cssText = `
        left: ${20 + Math.random() * 60}vw;
        top: ${Math.random() * 40}vh;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        --dur: ${1.5 + Math.random() * 2}s;
        --dy: ${300 + Math.random() * 300}px;
        --dx: ${(Math.random() - 0.5) * 200}px;
        --rot: ${360 + Math.random() * 720}deg;
        animation-delay: ${Math.random() * 0.5}s;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }, i * 60);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT BANNER + TOAST
// ═══════════════════════════════════════════════════════════════════════════

let bannerTimer = null;

function showBanner(msg) {
  const el = document.getElementById('event-banner');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.remove('show'), 5000);
}

function showToast(msg) {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast-msg';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAOS MODE (Easter egg)
// ═══════════════════════════════════════════════════════════════════════════

function triggerChaosMode() {
  showBanner('🌪 CHAOS MODE ACTIVATED');
  document.getElementById('hq-root').classList.add('party-mode');
  AGENT_IDS.forEach((id, i) => {
    setTimeout(() => {
      const el = document.getElementById(`char-${id}`);
      if (el) { el.classList.add('char-anim-spin'); }
      setTimeout(() => {
        if (el) el.classList.remove('char-anim-spin');
      }, 3000);
    }, i * 200);
  });
  spawnConfetti();
  setTimeout(() => {
    document.getElementById('hq-root').classList.remove('party-mode');
    showBanner('😮‍💨 Crisis contained. Back to work.');
  }, 8000);
}

// ═══════════════════════════════════════════════════════════════════════════
// EASTER EGGS
// ═══════════════════════════════════════════════════════════════════════════

function hookEasterEggs() {
  // Konami code
  document.addEventListener('keydown', (e) => {
    if (e.key === KONAMI[konamiIdx]) {
      konamiIdx++;
      if (konamiIdx === KONAMI.length) {
        konamiIdx = 0;
        activatePartyMode();
      }
    } else {
      konamiIdx = 0;
    }

    // Type "chaos"
    typedBuffer += e.key.toLowerCase();
    if (typedBuffer.length > 10) typedBuffer = typedBuffer.slice(-10);
    if (typedBuffer.includes('chaos')) {
      typedBuffer = '';
      OFFICE_EVENTS.forEach((evt, i) => {
        setTimeout(() => showBanner(evt.label), i * 1200);
      });
      triggerChaosMode();
    }
  });
}

function activatePartyMode() {
  if (partyMode) return;
  partyMode = true;
  document.getElementById('hq-root').classList.add('party-mode');
  showBanner('🎉 PARTY MODE: Konami code activated!');
  spawnConfetti();

  // Cash + Archi dialogue
  setTimeout(() => showSpeech('cash', '💰 BONUS FOR EVERYONE!'), 1000);
  setTimeout(() => showSpeech('archi', '😤 This violates our coding standards'), 2000);
  setTimeout(() => showSpeech('cash', '💰 I literally do not care'), 3000);
  setTimeout(() => showSpeech('archi', '…fine. Just this once.'), 4500);

  AGENT_IDS.forEach((id, i) => {
    setTimeout(() => celebrateAgent(id), i * 300);
  });

  setTimeout(() => {
    partyMode = false;
    document.getElementById('hq-root').classList.remove('party-mode');
  }, 12000);
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function relTime(ts) {
  if (!ts) return '—';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}

function formatUptime(secs) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Expose to HTML onclick attributes
window.openInspect        = openInspect;
window.closeInspect       = closeInspect;
window.switchTab          = switchTab;
window.pokeAgent          = pokeAgent;
window.randomSpeech       = randomSpeech;
window.sendToBreakRoom    = sendToBreakRoom;
window.returnFromBreakRoom= returnFromBreakRoom;
window.triggerCoffee      = triggerCoffee;
window.triggerVending     = triggerVending;
window.triggerPizza       = triggerPizza;
window.showToast          = showToast;
window.showBanner         = showBanner;
