
// ── CONSTANTS ──
const PX_PER_MIN = 1.6;
const EVENT_SIDE_GAP_PX = 4;
const START_H = 7;
const END_H = 23;
const TOTAL_MINS = (END_H - START_H) * 60;

// Renseignez ici l'URL JSON de la version Render, puis gardez /api/schedule.
// Exemple: const RENDER_SCHEDULE_URL = 'https://mon-app.onrender.com/api/schedule';
const RENDER_SCHEDULE_URL = 'https://act-planning-tool.onrender.com/api/schedule';
const READ_ONLY = typeof window !== 'undefined' && Boolean(window.READ_ONLY);

const DEFAULT_TYPES = {
  LOUANGE:      { label: 'Louange', color: '#C39BD3' },
  PREDICATION:  { label: 'Prédication', color: '#82E0AA' },
  REPAS:        { label: 'Repas', color: '#FAD7A0' },
  LOGISTIQUE:   { label: 'Logistique', color: '#AED6F1' },
  REPETITION:   { label: 'Répétition', color: '#D7BDE2' },
  REUNION:      { label: 'Réunion / Brief', color: '#D5F5E3' },
  BOOST:        { label: 'Boost', color: '#F1948A' },
  STE_CENE:     { label: 'Ste Cène', color: '#BB8FCE' },
  PRIERE:       { label: 'Prière', color: '#7FB3D3' },
  INTERCESSION: { label: 'Intercession', color: '#D6EAF8' },
  FUNDRAISING:  { label: 'Levée de fonds', color: '#F9E79F' },
  TED_PITCH:    { label: 'Pitch / TED', color: '#A9DFBF' },
  ANNONCES:     { label: 'Annonces', color: '#A9DFBF' },
  TECHNIQUE:    { label: 'Technique', color: '#D5D8DC' }
};

const SERVICE_TEAMS = [
  'Team Médias Capture',
  'Team Médias Projection',
  'Team Snacking',
  'Team Logistique',
  'Team Ménage',
  'Team Accueil',
  'Team Louange',
  'Fil Rouge',
  'Team Coordo',
  'Team MC/Infos',
  'Team Traduction',
  'Team Hospitalité',
  'Team Sécurité',
  'Team Parking',
  'Team Bible School',
  'Team Festival',
  'Team Librairie',
  'Team Communication RS',
  'Team Kids',
  'Team Bébés',
  'Team Prières',
  'Team Chauffeurs',
  'Team Son',
  'Team Boost',
  'Permanence Médicale',
  'Toute la Dream Team'
];

let schedule = null;
let hiddenTypes = new Set();
let pdfSelectionMode = false;
let pdfSelectedEventIds = new Set();

// ── TIME UTILITIES ──
function timeToY(t) {
  const [h, m] = t.split(':').map(Number);
  return ((h - START_H) * 60 + m) * PX_PER_MIN;
}
function timeToMinutes(t) {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return h * 60 + m;
}
function yToTime(y) {
  const totalMin = Math.round(y / PX_PER_MIN / 5) * 5;
  const clamped = Math.max(0, Math.min(totalMin, TOTAL_MINS - 15));
  const h = START_H + Math.floor(clamped / 60);
  const m = clamped % 60;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}
function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(str) {
  return esc(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function genId() { return 'e_' + Math.random().toString(36).slice(2,9); }

function ensureScheduleShape() {
  schedule.attendance = schedule.attendance || {};
  ['vendredi', 'samedi', 'dimanche'].forEach(key => {
    if (schedule.attendance[key] === undefined) schedule.attendance[key] = '';
  });
  schedule.types = schedule.types || {};
  Object.entries(DEFAULT_TYPES).forEach(([key, config]) => {
    if (!schedule.types[key]) schedule.types[key] = { ...config };
  });
  forEachEvent(ev => {
    if (ev.type && !schedule.types[ev.type]) {
      schedule.types[ev.type] = {
        label: ev.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        color: ev.color || '#A9DFBF'
      };
    }
  });
  (schedule.days || []).forEach(day => {
    (day.sessions || []).forEach(session => {
      session.start_time = session.start_time || '';
      session.end_time = session.end_time || '';
    });
  });
}

function forEachEvent(callback) {
  (schedule.days || []).forEach(day => {
    (day.sessions || []).forEach(session => {
      (session.events || []).forEach(ev => callback(ev, day, session));
    });
  });
}

function typeEntries() {
  return Object.entries(schedule.types || {}).sort((a, b) => {
    return (a[1].label || a[0]).localeCompare(b[1].label || b[0]);
  });
}

function typeLabel(type) {
  return (schedule.types && schedule.types[type] && schedule.types[type].label) || type || 'Type';
}

function typeColor(type) {
  return (schedule.types && schedule.types[type] && schedule.types[type].color) || '#A9DFBF';
}

function applyTypeConfigToEvents(type) {
  const color = typeColor(type);
  forEachEvent(ev => {
    if (ev.type === type) ev.color = color;
  });
}

function applyReadOnlyMode() {
  if (!READ_ONLY) return;
  document.body.classList.add('read-only');
}

// ── LOAD + RENDER ──
async function loadSchedule() {
  try {
    const r = await fetch('/api/schedule');
    schedule = await r.json();
    ensureScheduleShape();
    renderAll();
  } catch (err) {
    document.getElementById('days-row').innerHTML = '<div style="padding:24px;color:#b00020;font-weight:600">Erreur de chargement du planning. Rechargez la page ou relancez l\'outil.</div>';
    console.error(err);
  }
}

async function persistLocalSchedule() {
  const r = await fetch('/api/schedule', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(schedule)
  });
  if (!r.ok) throw new Error('Sauvegarde locale impossible');
}

function renderAll() {
  applyReadOnlyMode();
  renderTimeAxis();
  renderLegend();
  renderDays();
  updatePdfSelectionUi();
}

function renderTimeAxis() {
  const ax = document.getElementById('time-axis');
  ax.style.height = TOTAL_MINS * PX_PER_MIN + 'px';
  ax.innerHTML = '';
  for (let h = START_H; h <= END_H; h++) {
    const y = (h - START_H) * 60 * PX_PER_MIN;
    const lbl = document.createElement('div');
    lbl.className = 'hour-label';
    lbl.style.top = y + 'px';
    lbl.textContent = String(h).padStart(2,'0') + ':00';
    ax.appendChild(lbl);
  }
}

function renderLegend() {
  const leg = document.getElementById('legend');
  leg.innerHTML = READ_ONLY
    ? '<h3>Types d\'événements</h3>'
    : '<h3>Types d\'événements</h3><button class="legend-add" onclick="openTypeModal()">+ Ajouter un type</button>';
  typeEntries().forEach(([k, config]) => {
    const label = config.label || k;
    const item = document.createElement('div');
    item.className = 'legend-item' + (hiddenTypes.has(k) ? ' hidden-type' : '');
    item.dataset.type = k;
    item.innerHTML = `
      <div class="legend-dot" style="background:${config.color || '#A9DFBF'}"></div>
      <span class="legend-label">${esc(label)}</span>
      ${READ_ONLY ? '' : `<button class="legend-edit" title="Modifier ce type" onclick="event.stopPropagation(); openTypeModal('${escAttr(k)}')">&#9998;</button>`}
    `;
    item.addEventListener('click', () => {
      if (hiddenTypes.has(k)) hiddenTypes.delete(k);
      else hiddenTypes.add(k);
      renderAll();
    });
    leg.appendChild(item);
  });
}

function toggleLegend() {
  document.body.classList.toggle('legend-collapsed');
  const btn = document.getElementById('legend-toggle');
  btn.textContent = document.body.classList.contains('legend-collapsed') ? 'Types' : 'Masquer';
}

function renderDays() {
  const row = document.getElementById('days-row');
  row.innerHTML = '';
  const timelineH = TOTAL_MINS * PX_PER_MIN;

  for (const day of schedule.days) {
    const overlapLayouts = computeOverlapLayouts(day);
    const col = document.createElement('div');
    col.className = 'day-col';
    col.dataset.dayId = day.id;

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'day-header';
    hdr.innerHTML = READ_ONLY
      ? `<span>${day.name}</span>`
      : `<span>${day.name}</span><button class="add-btn" title="Ajouter un événement" onclick="openAddModal('${day.id}')">+</button>`;
    col.appendChild(hdr);

    // Events area
    const area = document.createElement('div');
    area.className = 'events-area';
    area.style.height = timelineH + 'px';
    area.dataset.dayId = day.id;

    // Half-hour lines
    for (let m = 30; m < TOTAL_MINS; m += 60) {
      const line = document.createElement('div');
      line.className = 'half-line';
      line.style.top = m * PX_PER_MIN + 'px';
      area.appendChild(line);
    }

    // Click on empty area → add event
    area.addEventListener('click', function(e) {
      if (READ_ONLY) return;
      if (pdfSelectionMode) return;
      if (e.target === area) {
        const rect = area.getBoundingClientRect();
        const y = e.clientY - rect.top + area.parentElement.parentElement.scrollTop;
        openAddModal(day.id, null, yToTime(y));
      }
    });

    // Sessions + events
    let prevSessionStart = -1;
    for (const session of day.sessions) {
      const sessionEvents = session.events || [];
      const sessionStart = session.start_time || (sessionEvents[0] && sessionEvents[0].time);
      if (!sessionStart) continue;
      const sepY = timeToY(sessionStart) - 18;
      if (sepY > prevSessionStart) {
        const sep = document.createElement('div');
        sep.className = 'session-sep';
        sep.style.top = Math.max(0, sepY) + 'px';
        const timeLabel = session.end_time ? ` ${sessionStart}-${session.end_time}` : ` ${sessionStart}`;
        sep.innerHTML = `<div class="session-sep-line"></div><div class="session-sep-label">${esc(session.name)}${esc(timeLabel)}</div><div class="session-sep-line"></div>`;
        area.appendChild(sep);
        prevSessionStart = sepY;
      }

      for (const ev of sessionEvents) {
        if (!ev.time) continue;
        const block = createEventBlock(ev, day.id, session.id, overlapLayouts[ev.id]);
        area.appendChild(block);
      }
    }

    col.appendChild(area);
    row.appendChild(col);
  }

  // Update grid wrapper height
  document.querySelector('.time-axis').style.height = timelineH + 'px';
}

function computeOverlapLayouts(day) {
  const allEvents = [];
  for (const session of day.sessions || []) {
    for (const ev of session.events || []) {
      if (!ev.time) continue;
      const start = timeToMinutes(ev.time);
      const end = start + Math.max(parseInt(ev.duration, 10) || 0, 5);
      allEvents.push({ id: ev.id, start, end });
    }
  }

  allEvents.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });

  const layoutsById = {};
  let group = [];
  let groupEnd = -Infinity;

  const flushGroup = () => {
    if (!group.length) return;

    const activeEndsByColumn = [];
    let maxColumns = 1;

    group.forEach(ev => {
      let column = 0;
      while (activeEndsByColumn[column] !== undefined && activeEndsByColumn[column] > ev.start) {
        column += 1;
      }
      ev.column = column;
      activeEndsByColumn[column] = ev.end;
      maxColumns = Math.max(maxColumns, column + 1);
    });

    group.forEach(ev => {
      layoutsById[ev.id] = { column: ev.column || 0, total: maxColumns };
    });

    group = [];
    groupEnd = -Infinity;
  };

  for (const ev of allEvents) {
    if (group.length && ev.start >= groupEnd) {
      flushGroup();
    }
    group.push(ev);
    groupEnd = Math.max(groupEnd, ev.end);
  }
  flushGroup();

  return layoutsById;
}

function createEventBlock(ev, dayId, sessionId, overlapLayout) {
  const top = timeToY(ev.time);
  const h = Math.max(ev.duration * PX_PER_MIN, 22);
  const column = overlapLayout ? overlapLayout.column : 0;
  const total = Math.max(overlapLayout ? overlapLayout.total : 1, 1);
  const leftPct = (column / total) * 100;
  const widthPct = 100 / total;
  const div = document.createElement('div');
  div.className = 'event-block' + (hiddenTypes.has(ev.type) ? ' hidden-type' : '') + (pdfSelectedEventIds.has(ev.id) ? ' pdf-selected' : '');
  div.dataset.evId = ev.id;
  div.dataset.type = ev.type;
  const bgColor = ev.color || typeColor(ev.type);
  div.style.cssText = `top:${top}px;height:${h}px;left:calc(${leftPct}% + ${EVENT_SIDE_GAP_PX}px);width:calc(${widthPct}% - ${EVENT_SIDE_GAP_PX * 2}px);background:${bgColor};z-index:${3 + column}`;
  div.style.borderLeftColor = darken(bgColor, 40);

  const teamsHtml = (ev.teams||[]).length
    ? `<div class="ev-teams">${esc((ev.teams||[]).join(', '))}</div>` : '';
  div.innerHTML = `
    <div class="ev-main-line"><span class="ev-time">${esc(ev.time)}</span><span class="ev-title">${esc(ev.title)}</span></div>
    ${teamsHtml}
    <div class="resize-handle"></div>
  `;

  div.addEventListener('click', e => {
    if (READ_ONLY) {
      openViewModal(ev, dayId, sessionId);
      return;
    }
    if (pdfSelectionMode) {
      togglePdfEventSelection(ev.id);
      return;
    }
    if (!e._resized) openEditModal(ev, dayId, sessionId);
  });

  if (READ_ONLY) return div;

  div.addEventListener('mousedown', e => {
    if (pdfSelectionMode) return;
    if (e.target.classList.contains('resize-handle') || e.button !== 0) return;
    const startY = e.clientY;
    const startTime = ev.time;
    let moved = false;
    const onMove = me => {
      const delta = me.clientY - startY;
      if (Math.abs(delta) < 4) return;
      moved = true;
      me.preventDefault();
      ev.time = yToTime(timeToY(startTime) + delta);
      div.style.top = timeToY(ev.time) + 'px';
      const timeEl = div.querySelector('.ev-time');
      if (timeEl) timeEl.textContent = ev.time;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (moved) {
        const day = schedule.days.find(d => d.id === dayId);
        const session = day ? day.sessions.find(s => s.id === sessionId) : null;
        if (session) session.events.sort((a, b) => a.time.localeCompare(b.time));
        div._resized = true;
        setTimeout(() => { if (div) delete div._resized; }, 200);
        renderDays();
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Resize
  div.querySelector('.resize-handle').addEventListener('mousedown', e => {
    if (pdfSelectionMode) return;
    e.stopPropagation(); e.preventDefault();
    const startY = e.clientY;
    const startDur = ev.duration;
    const onMove = me => {
      const delta = me.clientY - startY;
      ev.duration = Math.max(5, Math.round((startDur + delta / PX_PER_MIN) / 5) * 5);
      div.style.height = Math.max(ev.duration * PX_PER_MIN, 22) + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      e.target.parentElement._resized = true;
      setTimeout(() => { if(e.target.parentElement) delete e.target.parentElement._resized; }, 200);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  return div;
}

function darken(hex, amt) {
  let r = parseInt(hex.slice(1,3),16) - amt;
  let g = parseInt(hex.slice(3,5),16) - amt;
  let b = parseInt(hex.slice(5,7),16) - amt;
  r = Math.max(0,r); g = Math.max(0,g); b = Math.max(0,b);
  return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
}

// ── MODAL ──
let _editEv = null, _editDay = null, _editSession = null;

function buildSessionSelect(dayId, currentSession) {
  const sel = document.getElementById('f-session-sel');
  sel.innerHTML = '';
  const day = schedule.days.find(d => d.id === dayId);
  if (!day) return;
  day.sessions.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = s.name;
    if (s.id === currentSession) opt.selected = true;
    sel.appendChild(opt);
  });
}

function buildTypeSelect(currentType) {
  const sel = document.getElementById('f-type');
  sel.innerHTML = '';
  typeEntries().forEach(([key, config]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = config.label || key;
    if (key === currentType) opt.selected = true;
    sel.appendChild(opt);
  });
}

function buildColorPresets() {
  const container = document.getElementById('color-presets');
  container.innerHTML = '';
  typeEntries().forEach(([type, config]) => {
    const color = config.color || '#A9DFBF';
    const dot = document.createElement('div');
    dot.className = 'color-preset';
    dot.style.background = color;
    dot.title = config.label || type;
    dot.dataset.color = color;
    dot.addEventListener('click', () => {
      document.getElementById('f-color').value = color;
      document.querySelectorAll('.color-preset').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
    container.appendChild(dot);
  });
}

function buildTeamSelect(selectedTeams) {
  const sel = document.getElementById('f-teams');
  const selected = new Set(selectedTeams || []);
  const options = [...SERVICE_TEAMS];

  selected.forEach(team => {
    if (team && !SERVICE_TEAMS.includes(team)) options.push(team);
  });

  sel.innerHTML = '';
  options.forEach(team => {
    const opt = document.createElement('option');
    opt.value = team;
    opt.textContent = team;
    opt.selected = selected.has(team);
    sel.appendChild(opt);
  });
}

function selectedTeamsFromForm() {
  return Array.from(document.getElementById('f-teams').selectedOptions)
    .map(opt => opt.value)
    .filter(Boolean);
}

function openEditModal(ev, dayId, sessionId) {
  _editEv = ev; _editDay = dayId; _editSession = sessionId;
  buildTypeSelect(ev.type || 'ANNONCES');
  document.getElementById('modal-h2').textContent = 'Modifier l\'événement';
  document.getElementById('f-id').value = ev.id;
  document.getElementById('f-day').value = dayId;
  document.getElementById('f-time').value = ev.time;
  document.getElementById('f-duration').value = ev.duration;
  document.getElementById('f-title').value = ev.title;
  document.getElementById('f-type').value = ev.type || 'ANNONCES';
  document.getElementById('f-color').value = ev.color || typeColor(ev.type);
  buildTeamSelect(ev.teams || []);
  document.getElementById('f-details').value = ev.details || '';
  buildSessionSelect(dayId, sessionId);
  buildColorPresets();
  document.getElementById('btn-delete').style.display = 'inline-flex';
  document.getElementById('modal').classList.remove('hidden');
}

function openAddModal(dayId, sessionId, time) {
  _editEv = null; _editDay = dayId; _editSession = sessionId;
  buildTypeSelect('ANNONCES');
  document.getElementById('modal-h2').textContent = 'Ajouter un événement';
  document.getElementById('f-id').value = '';
  document.getElementById('f-day').value = dayId;
  document.getElementById('f-time').value = time || '09:00';
  document.getElementById('f-duration').value = 30;
  document.getElementById('f-title').value = '';
  document.getElementById('f-type').value = 'ANNONCES';
  document.getElementById('f-color').value = typeColor('ANNONCES');
  buildTeamSelect([]);
  document.getElementById('f-details').value = '';
  // default to first session if none given
  const day = schedule.days.find(d => d.id === dayId);
  buildSessionSelect(dayId, sessionId || (day && day.sessions[0] && day.sessions[0].id));
  buildColorPresets();
  document.getElementById('btn-delete').style.display = 'none';
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  _editEv = null;
}

function eventEndTime(ev) {
  if (!ev.time) return '';
  const total = timeToMinutes(ev.time) + (parseInt(ev.duration, 10) || 0);
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

function formatDuration(mins) {
  const duration = parseInt(mins, 10) || 0;
  if (!duration) return '';
  const h = Math.floor(duration / 60);
  const m = duration % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} h`;
  return `${h} h ${m}`;
}

function openViewModal(ev, dayId, sessionId) {
  const day = schedule.days.find(d => d.id === dayId);
  const session = day ? day.sessions.find(s => s.id === sessionId) : null;
  const teams = (ev.teams || []).filter(Boolean);
  const endTime = eventEndTime(ev);
  const timeLabel = ev.time
    ? `${esc(ev.time)}${endTime ? ` - ${esc(endTime)}` : ''}`
    : 'Horaire non renseigné';
  const durationLabel = formatDuration(ev.duration);
  const details = (ev.details || '').trim();

  document.getElementById('view-title').textContent = ev.title || 'Événement';
  document.getElementById('view-body').innerHTML = `
    <div class="view-meta">
      <div><span>Jour</span><strong>${esc(day ? day.name : '')}</strong></div>
      <div><span>Session</span><strong>${esc(session ? session.name : '')}</strong></div>
      <div><span>Horaire</span><strong>${timeLabel}</strong></div>
      <div><span>Durée</span><strong>${esc(durationLabel || '-')}</strong></div>
      <div><span>Type</span><strong>${esc(typeLabel(ev.type))}</strong></div>
    </div>
    ${teams.length ? `<div class="view-section"><h3>Équipes responsables</h3><p>${esc(teams.join(', '))}</p></div>` : ''}
    ${details ? `<div class="view-section"><h3>Détails / Notes Running Sheet</h3><p>${esc(details)}</p></div>` : ''}
  `;
  document.getElementById('modal-view').classList.remove('hidden');
}

function closeViewModal() {
  document.getElementById('modal-view').classList.add('hidden');
}

function onTypeChange() {
  const type = document.getElementById('f-type').value;
  const color = typeColor(type);
  if (color) {
    document.getElementById('f-color').value = color;
    document.querySelectorAll('.color-preset').forEach(d => {
      d.classList.toggle('active', d.dataset.color === color);
    });
  }
}

function adjustDur(delta) {
  const inp = document.getElementById('f-duration');
  inp.value = Math.max(5, (parseInt(inp.value)||30) + delta);
}

function saveEvent() {
  const id = document.getElementById('f-id').value || genId();
  const dayId = document.getElementById('f-day').value;
  const sessionId = document.getElementById('f-session-sel').value;
  const teams = selectedTeamsFromForm();

  const ev = {
    id,
    time: document.getElementById('f-time').value,
    duration: parseInt(document.getElementById('f-duration').value) || 30,
    title: document.getElementById('f-title').value,
    type: document.getElementById('f-type').value,
    color: document.getElementById('f-color').value,
    teams,
    details: document.getElementById('f-details').value
  };

  const day = schedule.days.find(d => d.id === dayId);
  if (!day) return;

  // Remove from old session if session changed
  if (_editEv && _editSession && _editSession !== sessionId) {
    const oldSession = day.sessions.find(s => s.id === _editSession);
    if (oldSession) oldSession.events = oldSession.events.filter(e => e.id !== id);
  }

  const session = day.sessions.find(s => s.id === sessionId);
  if (!session) return;

  const idx = session.events.findIndex(e => e.id === id);
  if (idx >= 0) session.events[idx] = ev;
  else session.events.push(ev);

  // Sort by time
  session.events.sort((a, b) => a.time.localeCompare(b.time));

  closeModal();
  renderDays();
  showToast('Événement enregistré');
}

function deleteEvent() {
  if (!_editEv) return;
  if (!confirm('Supprimer cet événement ?')) return;
  const day = schedule.days.find(d => d.id === _editDay);
  if (day) {
    day.sessions.forEach(s => {
      s.events = s.events.filter(e => e.id !== _editEv.id);
    });
  }
  closeModal();
  renderDays();
  showToast('Événement supprimé');
}

// ── TYPE MODAL ──
function typeKeyFromLabel(label) {
  return String(label || 'TYPE')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'TYPE';
}

function uniqueTypeKey(baseKey) {
  let key = baseKey;
  let i = 2;
  while (schedule.types[key]) {
    key = `${baseKey}_${i}`;
    i += 1;
  }
  return key;
}

function openTypeModal(typeKey) {
  const isEdit = Boolean(typeKey);
  const config = isEdit ? schedule.types[typeKey] : null;
  document.getElementById('type-modal-h2').textContent = isEdit ? 'Modifier un type' : 'Ajouter un type';
  document.getElementById('t-original-key').value = typeKey || '';
  document.getElementById('t-label').value = config ? (config.label || typeKey) : '';
  document.getElementById('t-key').value = typeKey || '';
  document.getElementById('t-key').readOnly = isEdit;
  document.getElementById('type-key-row').style.display = isEdit ? 'none' : 'block';
  document.getElementById('t-color').value = config ? (config.color || '#A9DFBF') : '#A9DFBF';
  document.getElementById('modal-type').classList.remove('hidden');
}

function closeTypeModal() {
  document.getElementById('modal-type').classList.add('hidden');
}

function saveType() {
  const originalKey = document.getElementById('t-original-key').value;
  const label = document.getElementById('t-label').value.trim();
  const color = document.getElementById('t-color').value || '#A9DFBF';
  if (!label) {
    showToast('Donnez un nom au type');
    return;
  }

  const key = originalKey || uniqueTypeKey(typeKeyFromLabel(document.getElementById('t-key').value.trim() || label));
  schedule.types[key] = { label, color };
  applyTypeConfigToEvents(key);

  closeTypeModal();
  buildTypeSelect(document.getElementById('f-type').value);
  buildColorPresets();
  renderAll();
  showToast('Type mis à jour');
}

// ── SESSION MODAL ──
function openAddSessionModal() {
  const sel = document.getElementById('fs-day');
  sel.innerHTML = '';
  schedule.days.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id; opt.textContent = d.name;
    sel.appendChild(opt);
  });
  renderExistingSessions(sel.value);
  sel.onchange = () => {
    resetSessionForm();
    renderExistingSessions(sel.value);
  };
  resetSessionForm();
  document.getElementById('modal-session').classList.remove('hidden');
}

function renderExistingSessions(dayId) {
  const day = schedule.days.find(d => d.id === dayId);
  const container = document.getElementById('fs-existing');
  container.innerHTML = '';
  if (!day) return;
  day.sessions.forEach(s => {
    const tag = document.createElement('span');
    tag.className = 'session-tag';
    const range = s.start_time ? ` (${s.start_time}${s.end_time ? ' - ' + s.end_time : ''})` : '';
    tag.innerHTML = `
      ${esc(s.name)}${esc(range)}
      <button class="edit-tag" title="Modifier" onclick="editSession('${escAttr(dayId)}','${escAttr(s.id)}')">&#9998;</button>
      <button class="del-tag" title="Supprimer" onclick="deleteSession('${escAttr(dayId)}','${escAttr(s.id)}')">&#10005;</button>
    `;
    container.appendChild(tag);
  });
}

function resetSessionForm() {
  document.getElementById('fs-edit-id').value = '';
  document.getElementById('fs-name').value = '';
  document.getElementById('fs-start').value = '';
  document.getElementById('fs-end').value = '';
}

function editSession(dayId, sessionId) {
  const day = schedule.days.find(d => d.id === dayId);
  if (!day) return;
  const session = day.sessions.find(s => s.id === sessionId);
  if (!session) return;
  document.getElementById('fs-day').value = dayId;
  document.getElementById('fs-edit-id').value = session.id;
  document.getElementById('fs-name').value = session.name || '';
  document.getElementById('fs-start').value = session.start_time || '';
  document.getElementById('fs-end').value = session.end_time || '';
}

function saveSession() {
  const dayId = document.getElementById('fs-day').value;
  const sessionId = document.getElementById('fs-edit-id').value;
  const name = document.getElementById('fs-name').value.trim();
  if (!name) return;
  const day = schedule.days.find(d => d.id === dayId);
  if (!day) return;
  const payload = {
    name,
    start_time: document.getElementById('fs-start').value,
    end_time: document.getElementById('fs-end').value
  };

  if (sessionId) {
    const session = day.sessions.find(s => s.id === sessionId);
    if (!session) return;
    Object.assign(session, payload);
  } else {
    day.sessions.push({ id: 'sess_' + genId(), ...payload, events: [] });
  }

  day.sessions.sort((a, b) => {
    const at = a.start_time || (a.events[0] && a.events[0].time) || '99:99';
    const bt = b.start_time || (b.events[0] && b.events[0].time) || '99:99';
    return at.localeCompare(bt);
  });
  resetSessionForm();
  renderExistingSessions(dayId);
  renderDays();
  showToast('Session enregistrée');
}

function deleteSession(dayId, sessionId) {
  const day = schedule.days.find(d => d.id === dayId);
  if (!day) return;
  const sess = day.sessions.find(s => s.id === sessionId);
  if (sess && sess.events.length > 0) {
    if (!confirm(`Supprimer la session "${sess.name}" et ses ${sess.events.length} événement(s) ?`)) return;
  }
  day.sessions = day.sessions.filter(s => s.id !== sessionId);
  resetSessionForm();
  renderExistingSessions(dayId);
  renderDays();
}

function closeSessionModal() {
  document.getElementById('modal-session').classList.add('hidden');
  renderDays();
}

function openMetaModal() {
  ensureScheduleShape();
  document.getElementById('m-event').value = schedule.event || '';
  document.getElementById('m-lieu').value = schedule.lieu || '';
  document.getElementById('m-installation').value = schedule.installation_dates || '';
  document.getElementById('m-conference').value = schedule.conference_dates || '';
  document.getElementById('m-dresscode').value = schedule.dresscode || '';
  document.getElementById('m-att-vendredi').value = schedule.attendance.vendredi || '';
  document.getElementById('m-att-samedi').value = schedule.attendance.samedi || '';
  document.getElementById('m-att-dimanche').value = schedule.attendance.dimanche || '';
  document.getElementById('modal-meta').classList.remove('hidden');
}

function closeMetaModal() {
  document.getElementById('modal-meta').classList.add('hidden');
}

function saveMeta() {
  ensureScheduleShape();
  schedule.event = document.getElementById('m-event').value.trim();
  schedule.lieu = document.getElementById('m-lieu').value.trim();
  schedule.installation_dates = document.getElementById('m-installation').value.trim();
  schedule.conference_dates = document.getElementById('m-conference').value.trim();
  schedule.dresscode = document.getElementById('m-dresscode').value.trim();
  schedule.attendance.vendredi = document.getElementById('m-att-vendredi').value.trim();
  schedule.attendance.samedi = document.getElementById('m-att-samedi').value.trim();
  schedule.attendance.dimanche = document.getElementById('m-att-dimanche').value.trim();
  closeMetaModal();
  showToast('Infos générales enregistrées');
}

// ── SAVE / GENERATE ──
async function saveSchedule() {
  try {
    await persistLocalSchedule();
    showToast('&#128190; Planning sauvegardé !');
  } catch (err) {
    console.error(err);
    showToast('Erreur lors de la sauvegarde locale');
  }
}

async function syncFromOnline() {
  if (!RENDER_SCHEDULE_URL || RENDER_SCHEDULE_URL.includes('MON-URL-RENDER')) {
    showToast('Configurez RENDER_SCHEDULE_URL dans app.js');
    return;
  }

  showToast('Synchronisation depuis la version en ligne...');
  try {
    const r = await fetch(RENDER_SCHEDULE_URL, { cache: 'no-store' });
    if (!r.ok) throw new Error(`Render a répondu ${r.status}`);

    const onlineSchedule = await r.json();
    schedule = onlineSchedule;
    ensureScheduleShape();
    renderAll();

    // La sauvegarde locale rend les données synchronisées disponibles pour l'export Word
    // et les conserve si l'application est rechargée avant l'export.
    await persistLocalSchedule();
    showToast('Planning synchronisé depuis la version en ligne');
  } catch (err) {
    console.error(err);
    showToast('Erreur de synchronisation depuis la version en ligne');
  }
}

async function generateDocx() {
  showToast('&#9201; Génération du Running Sheet...');
  const r = await fetch('/api/generate-docx', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(schedule)
  });
  if (r.ok) {
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Running_Sheet_ACT_2026.docx';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    showToast('&#128196; Running Sheet téléchargé !');
  } else {
    showToast('Erreur lors de la génération');
  }
}

function openPdfExportModal() {
  pdfSelectedEventIds.clear();
  pdfSelectionMode = false;
  document.getElementById('modal-pdf-export').classList.remove('hidden');
  updatePdfSelectionUi();
  renderDays();
}

function closePdfExportModal() {
  document.getElementById('modal-pdf-export').classList.add('hidden');
}

function startPdfSelectionMode() {
  closePdfExportModal();
  pdfSelectedEventIds.clear();
  pdfSelectionMode = true;
  updatePdfSelectionUi();
  renderDays();
  showToast('Clique sur les événements à exporter, puis valide.');
}

function cancelPdfSelectionMode() {
  pdfSelectionMode = false;
  pdfSelectedEventIds.clear();
  updatePdfSelectionUi();
  renderDays();
}

function togglePdfEventSelection(eventId) {
  if (pdfSelectedEventIds.has(eventId)) pdfSelectedEventIds.delete(eventId);
  else pdfSelectedEventIds.add(eventId);
  updatePdfSelectionUi();
  renderDays();
}

function updatePdfSelectionUi() {
  document.body.classList.toggle('pdf-selection-mode', pdfSelectionMode);
  const bar = document.getElementById('pdf-selection-bar');
  if (!bar) return;
  bar.classList.toggle('hidden', !pdfSelectionMode);
  const count = document.getElementById('pdf-selection-count');
  if (count) count.textContent = `${pdfSelectedEventIds.size} événement(s) sélectionné(s)`;
}

function buildPdfExportSchedule(onlySelected) {
  const copy = JSON.parse(JSON.stringify(schedule));
  if (!onlySelected) return copy;

  copy.days = (copy.days || []).map(day => {
    const sessions = (day.sessions || []).map(session => ({
      ...session,
      events: (session.events || []).filter(ev => pdfSelectedEventIds.has(ev.id))
    })).filter(session => (session.events || []).length);
    return { ...day, sessions };
  }).filter(day => (day.sessions || []).length);

  return copy;
}

async function generatePlanningPdf(payloadSchedule) {
  showToast('Génération du PDF planning...');
  const r = await fetch('/api/generate-planning-pdf', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payloadSchedule || schedule)
  });
  if (r.ok) {
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Planning_ACT_2026.pdf';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    showToast('PDF planning téléchargé !');
  } else {
    showToast('Erreur lors de la génération du PDF');
  }
}

async function exportAllPlanningPdf() {
  closePdfExportModal();
  await generatePlanningPdf(buildPdfExportSchedule(false));
}

async function exportSelectedPlanningPdf() {
  if (!pdfSelectedEventIds.size) {
    showToast('Sélectionne au moins un événement');
    return;
  }
  const payload = buildPdfExportSchedule(true);
  pdfSelectionMode = false;
  pdfSelectedEventIds.clear();
  updatePdfSelectionUi();
  renderDays();
  await generatePlanningPdf(payload);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// Close modal on overlay click
document.getElementById('modal').addEventListener('click', e => {
  if (e.target === document.getElementById('modal')) closeModal();
});
document.getElementById('modal-view').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-view')) closeViewModal();
});
document.getElementById('modal-session').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-session')) closeSessionModal();
});
document.getElementById('modal-type').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-type')) closeTypeModal();
});
document.getElementById('modal-meta').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-meta')) closeMetaModal();
});
document.getElementById('modal-pdf-export').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-pdf-export')) closePdfExportModal();
});

// Start
loadSchedule();
