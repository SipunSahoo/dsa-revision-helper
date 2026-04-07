// ── STATE ──
let currentSection  = 'home';
let expandedAllId   = null;
let expandedUpId    = null;
let filterPattern   = '';
let filterStatus    = '';

// ── NEW: IN-MEMORY STATE FOR PILLS ──
// We use a Set to ensure a pattern is only selected once (O(1) time complexity)
const selectedPatternsSet = new Set();

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {

  // Intro animation exit
  setTimeout(() => {
    const overlay = document.getElementById('intro-overlay');
    if (overlay) {
      overlay.classList.add('exit');
      setTimeout(() => overlay.remove(), 550);
    }
  }, 2000);

  // Navigation
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchSection(tab.dataset.section));
  });

  // Add form bindings
  document.getElementById('btn-add').addEventListener('click', toggleForm);
  document.getElementById('btn-cancel').addEventListener('click', closeForm);
  document.getElementById('btn-submit').addEventListener('click', handleAdd);
  document.getElementById('f-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAdd();
  });

  // ==========================================
  // PATTERN PILL CLICK HANDLER
  // ==========================================
  document.querySelectorAll('.pattern-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      const val = e.target.dataset.val;
      if (selectedPatternsSet.has(val)) {
        selectedPatternsSet.delete(val);
        e.target.classList.remove('active');
      } else {
        selectedPatternsSet.add(val);
        e.target.classList.add('active');
      }
    });
  });

  // ==========================================
  // DATABASE AUTO-FILL EVENT LISTENER
  // ==========================================
  document.getElementById('f-number').addEventListener('input', (e) => {
    const currentInput = e.target.value;
    // Safety check ensuring Logic.js is loaded
    if (typeof lookupQuestion === 'function') {
      const questionData = lookupQuestion(currentInput);
      
      if (questionData) {
        document.getElementById('f-name').value = questionData.name;
        
        if (questionData.difficulty) {
          document.getElementById('f-diff').value = questionData.difficulty;
        }
        
        // Auto-Fill Multi-Select Pills
        const mappedPatterns = mapLeetCodeTagsToUI(questionData.patterns);
        
        // 1. Clear current state entirely
        selectedPatternsSet.clear();
        
        // 2. Loop through DOM elements and toggle UI + State based on mapping
        document.querySelectorAll('.pattern-pill').forEach(pill => {
          if (mappedPatterns.includes(pill.dataset.val)) {
            pill.classList.add('active');
            selectedPatternsSet.add(pill.dataset.val);
          } else {
            pill.classList.remove('active');
          }
        });
      }
    }
  });

  // Filters
  document.getElementById('filter-pattern').addEventListener('change', e => {
    filterPattern = e.target.value; renderAllQuestions();
  });
  document.getElementById('filter-status').addEventListener('change', e => {
    filterStatus = e.target.value; renderAllQuestions();
  });

  renderAll();
});

// ── UTILS ──
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmt(iso) {
  if (!iso) return '—';
  return iso.split('T')[0];
}

function formatPatterns(patternData) {
  if (!patternData || patternData.length === 0) return 'None';
  return Array.isArray(patternData) ? patternData.join(', ') : patternData;
}

function getStatusLabel(q) {
  if (q.status === 'learning') return 'Learning';
  if (q.status === 'solved') return 'Solved';
  if (q.status === 'revising') return `Rev ${q.revisionCount} Done`;
  if (q.status === 'mastered') return 'Mastered';
  return q.status;
}

// ── NAVIGATION ──
function switchSection(name) {
  closeForm();

  document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('section-' + name).classList.remove('hidden');
  document.querySelector(`.nav-tab[data-section="${name}"]`).classList.add('active');

  currentSection = name;
  if (name === 'home')     { renderDueToday(); renderStats(); }
  if (name === 'all')      renderAllQuestions();
  if (name === 'upcoming') renderUpcoming();
}

// ── RENDER ALL ──
function renderAll() {
  renderDueToday();
  renderStats();
}

// ── ADD FORM ──
function toggleForm() {
  const w = document.getElementById('add-form-wrap');
  if (w.classList.contains('hidden')) {
    w.classList.remove('hidden');
    document.getElementById('f-number').focus();
  } else {
    closeForm();
  }
}

function closeForm() {
  document.getElementById('add-form-wrap').classList.add('hidden');
  
  // Clear the internal memory and UI of the pills when closing the form
  selectedPatternsSet.clear();
  document.querySelectorAll('.pattern-pill').forEach(p => p.classList.remove('active'));
}

function handleAdd() {
  const number     = document.getElementById('f-number').value.trim();
  const name       = document.getElementById('f-name').value.trim();
  const difficulty = document.getElementById('f-diff').value;
  const status     = document.getElementById('f-status').value;
  const notes      = document.getElementById('f-notes').value.trim();
  
  // Convert our JavaScript Set back into a standard Array to save to memory
  const patternList = Array.from(selectedPatternsSet);

  // Validation
  const fields = ['f-number','f-name','f-diff']; 
  let valid = true;
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.style.borderColor = 'var(--red)';
      el.addEventListener('input', () => el.style.borderColor = '', { once: true });
      valid = false;
    }
  });
  if (!valid) return;

  // Pass array to Logic.js
  addQuestion({ number, name, pattern: patternList, difficulty, status, notes });

  // Reset form
  ['f-number','f-name','f-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-diff').value = '';
  document.getElementById('f-status').value = 'solved';
  
  closeForm();

  if (currentSection === 'home') renderAll();
  if (currentSection === 'all') renderAllQuestions();
  if (currentSection === 'upcoming') renderUpcoming();
  renderStats();
}

// ── STATS ──
function renderStats() {
  const s = getStats();
  const colors = { total: '#9898b8', learning: 'var(--red)', revising: 'var(--yellow)', mastered: 'var(--green)' };
  document.getElementById('stats-row').innerHTML = [
    { val: s.total,    lbl: 'Total Questions', col: colors.total },
    { val: s.learning, lbl: 'Learning',        col: colors.learning },
    { val: s.revising, lbl: 'In Revision',     col: colors.revising },
    { val: s.mastered, lbl: 'Mastered',        col: colors.mastered }
  ].map(c => `
    <div class="stat-card">
      <div class="stat-val" style="color:${c.col}">${c.val}</div>
      <div class="stat-lbl">${c.lbl}</div>
    </div>
  `).join('');
}

// ── DUE TODAY ──
function renderDueToday() {
  const due = getDueToday();
  const list = document.getElementById('due-list');
  document.getElementById('due-count').textContent = due.length;

  if (due.length === 0) {
    list.innerHTML = '<p class="due-empty">✓ All caught up for today — great work!</p>';
    return;
  }

  list.innerHTML = due.map((q, i) => `
    <div class="due-card" style="animation-delay:${i * 0.04}s">
      <div class="dc-num">#${q.number}</div>
      <div class="dc-name">${esc(q.name)}</div>
      <div class="dc-meta"><span class="badge badge-${q.status}">${getStatusLabel(q)}</span> · ${q.difficulty}</div>
      
      <!-- ENGINEERED HTML WRAPPER: Essential for the 0fr to 1fr CSS transition -->
      <div class="dc-notes-wrapper" id="dcn-${q.id}">
        <div class="dc-notes-inner">
          <div class="dc-notes">
            <div class="dc-section">
              <span class="dc-label">Patterns</span>
              <span style="color: var(--accent); font-family: var(--mono); font-size: 11.5px;">${esc(formatPatterns(q.pattern))}</span>
            </div>
            
            <div class="dc-section">
              <span class="dc-label">Notes</span>
              <span style="color: var(--tx);">${esc(q.notes) || '<em style="color: var(--tx-3);">No notes added.</em>'}</span>
            </div>

            <div class="detail-stats" style="margin-top: 12px; border-top: 1px dashed var(--bd); padding-top: 12px;">
              <div class="ds">Attempts: <span style="color: var(--tx);">${q.attempts}</span></div>
              <div class="ds">Last Solved: <span style="color: var(--tx);">${q.lastSolved || '—'}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="dc-actions">
        <button class="btn btn-sm btn-ghost" onclick="toggleDcNotes('${q.id}')">Details</button>
        <button class="btn btn-sm btn-success" onclick="doRevDone('${q.id}', 'home')">Mark Done</button>
        <a class="btn btn-sm btn-blue" href="${typeof lcUrl !== 'undefined' ? lcUrl(q.slug) : '#'}" target="_blank" rel="noopener">Open LC ↗</a>
      </div>
    </div>
  `).join('');
}

// Accordion toggle logic
function toggleDcNotes(id) {
  const target = document.getElementById('dcn-' + id);
  if (!target) return;

  const isOpening = !target.classList.contains('open');

  // Close all open drawers first to keep the UI strictly an accordion
  document.querySelectorAll('.dc-notes-wrapper.open').forEach(el => {
    el.classList.remove('open');
  });

  // Open the clicked one if it wasn't already open
  if (isOpening) {
    target.classList.add('open');
  }
}

// ── ALL QUESTIONS TABLE ──
function renderAllQuestions() {
  let qs = getQuestions();
  document.getElementById('total-count').textContent = qs.length;

  // Filter handles the pattern string even if q.pattern is an array now
  if (filterPattern) qs = qs.filter(q => Array.isArray(q.pattern) ? q.pattern.includes(filterPattern) : q.pattern === filterPattern);
  if (filterStatus)  qs = qs.filter(q => q.status  === filterStatus);
  qs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const tbody = document.getElementById('all-tbody');
  const empty = document.getElementById('all-empty');

  if (qs.length === 0) {
    tbody.innerHTML = ''; empty.classList.remove('hidden'); return;
  }
  empty.classList.add('hidden');
  tbody.innerHTML = qs.map(q => buildAllRow(q)).join('');
}

function buildAllRow(q) {
  const isOpen = expandedAllId === q.id;
  const canRev = q.status === 'solved' || q.status === 'revising';
  const nextDisp = q.status === 'mastered' ? '✓ mastered' : (q.nextRevision || '—');

  return `
    <tr class="q-row ${isOpen ? 'open' : ''}" onclick="toggleAllDetail('${q.id}')">
      <td class="td-num">${q.number}</td>
      <td class="td-name"><i class="exp-icon">▶</i>${esc(q.name)}</td>
      <td class="hide-sm" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${esc(formatPatterns(q.pattern))}">${esc(formatPatterns(q.pattern))}</td>
      <td class="hide-sm"><span class="diff-${q.difficulty.toLowerCase()}">${q.difficulty}</span></td>
      <td><span class="badge badge-${q.status}">${getStatusLabel(q)}</span></td>
      <td class="td-date hide-md">${fmt(q.createdAt)}</td>
      <td class="td-date hide-md">${q.lastSolved || '—'}</td>
      <td class="td-date hide-md">${nextDisp}</td>
      <td class="td-acts" onclick="event.stopPropagation()">
        <a class="btn btn-sm btn-blue" href="${typeof lcUrl !== 'undefined' ? lcUrl(q.slug) : '#'}" target="_blank" rel="noopener" title="LeetCode">LC</a>
      </td>
    </tr>
    <tr class="detail-row ${isOpen ? 'open' : ''}">
      <td colspan="9">
        <div class="detail-grid">
          <div>
            <div class="detail-notes-lbl" style="margin-bottom: 4px;">Full Patterns</div>
            <div style="font-family: var(--mono); font-size: 11.5px; color: var(--accent); margin-bottom: 12px;">
              ${esc(formatPatterns(q.pattern))}
            </div>

            <div class="detail-notes-lbl">Notes</div>
            <textarea class="detail-notes-ta" id="ni-${q.id}" maxlength="300" rows="3"
              onblur="doNotesBlur('${q.id}')"
              onclick="event.stopPropagation()">${esc(q.notes)}</textarea>
            <div class="detail-stats">
              <div class="ds">Attempts: <span>${q.attempts}</span></div>
              <div class="ds">Revisions: <span>${q.revisionCount}/4</span></div>
              <div class="ds">Last Revised: <span>${q.lastRevised || '—'}</span></div>
              <div class="ds">Next Rev: <span>${nextDisp}</span></div>
            </div>
          </div>
          <div class="detail-btns" onclick="event.stopPropagation()">
            ${q.status !== 'mastered' ? `<button class="btn btn-sm btn-success" onclick="doSolved('${q.id}', 'all')">Mark Solved</button>` : ''}
            ${canRev ? `<button class="btn btn-sm btn-yellow" onclick="doRevDone('${q.id}', 'all')">Rev Done</button>` : ''}
            <a class="btn btn-sm btn-blue" href="${typeof lcUrl !== 'undefined' ? lcUrl(q.slug) : '#'}" target="_blank" rel="noopener">Open LC ↗</a>
            <button class="btn btn-sm btn-danger" onclick="doDelete('${q.id}', 'all')">Delete</button>
          </div>
        </div>
      </td>
    </tr>`;
}

function toggleAllDetail(id) {
  expandedAllId = expandedAllId === id ? null : id;
  renderAllQuestions();
  if (expandedAllId) {
    requestAnimationFrame(() => {
      const el = document.getElementById('ni-' + id);
      if (el) el.focus();
    });
  }
}

// ── UPCOMING TABLE ──
function renderUpcoming() {
  const qs = getUpcoming();
  const tbody = document.getElementById('upcoming-tbody');
  const empty = document.getElementById('upcoming-empty');
  document.getElementById('upcoming-count').textContent = qs.length;

  if (qs.length === 0) {
    tbody.innerHTML = ''; empty.classList.remove('hidden'); return;
  }
  empty.classList.add('hidden');
  tbody.innerHTML = qs.map(q => buildUpcomingRow(q)).join('');
}

function buildUpcomingRow(q) {
  const t = typeof today === 'function' ? today() : new Date().toISOString().split('T')[0];
  const isOpen = expandedUpId === q.id;
  const isOverdue = q.nextRevision < t;
  const isToday   = q.nextRevision === t;

  let rowCls  = isOpen ? 'q-row open' : 'q-row';
  let nextCls = '';
  if (isOverdue) { rowCls += ' row-overdue'; nextCls = 'next-rev-overdue'; }
  if (isToday)   { rowCls += ' row-today';   nextCls = 'next-rev-today'; }

  const canRev = q.status === 'solved' || q.status === 'revising';

  return `
    <tr class="${rowCls}" onclick="toggleUpDetail('${q.id}')">
      <td class="td-num">${q.number}</td>
      <td class="td-name"><i class="exp-icon">▶</i>${esc(q.name)}</td>
      <td class="hide-sm" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${esc(formatPatterns(q.pattern))}">${esc(formatPatterns(q.pattern))}</td>
      <td class="hide-sm"><span class="diff-${q.difficulty.toLowerCase()}">${q.difficulty}</span></td>
      <td><span class="badge badge-${q.status}">${getStatusLabel(q)}</span></td>
      <td class="td-date hide-md">${fmt(q.createdAt)}</td>
      <td class="td-date hide-md">${q.lastSolved || '—'}</td>
      <td class="td-date hide-md">${q.lastRevised || '—'}</td>
      <td class="td-date ${nextCls}">${q.nextRevision}</td>
      <td class="td-acts" onclick="event.stopPropagation()">
        ${canRev ? `<button class="btn btn-sm btn-yellow" onclick="doRevDone('${q.id}', 'upcoming')" title="Mark Revision Done">✓</button>` : ''}
      </td>
    </tr>
    <tr class="detail-row ${isOpen ? 'open' : ''}">
      <td colspan="10">
        <div class="detail-grid">
          <div>
            <div class="detail-notes-lbl" style="margin-bottom: 4px;">Full Patterns</div>
            <div style="font-family: var(--mono); font-size: 11.5px; color: var(--accent); margin-bottom: 12px;">
              ${esc(formatPatterns(q.pattern))}
            </div>

            <div class="detail-notes-lbl">Notes</div>
            <textarea class="detail-notes-ta" id="ui-${q.id}" maxlength="300" rows="3"
              onblur="doNotesBlur('${q.id}')"
              onclick="event.stopPropagation()">${esc(q.notes)}</textarea>
            <div class="detail-stats">
              <div class="ds">Attempts: <span>${q.attempts}</span></div>
              <div class="ds">Revisions done: <span>${q.revisionCount}/4</span></div>
              <div class="ds">Last Revised: <span>${q.lastRevised || '—'}</span></div>
            </div>
          </div>
          <div class="detail-btns" onclick="event.stopPropagation()">
            ${q.status !== 'mastered' ? `<button class="btn btn-sm btn-success" onclick="doSolved('${q.id}', 'upcoming')">Mark Solved</button>` : ''}
            ${canRev ? `<button class="btn btn-sm btn-yellow" onclick="doRevDone('${q.id}', 'upcoming')">Rev Done</button>` : ''}
            <a class="btn btn-sm btn-blue" href="${typeof lcUrl !== 'undefined' ? lcUrl(q.slug) : '#'}" target="_blank" rel="noopener">Open LC ↗</a>
            <button class="btn btn-sm btn-danger" onclick="doDelete('${q.id}', 'upcoming')">Delete</button>
          </div>
        </div>
      </td>
    </tr>`;
}

function toggleUpDetail(id) {
  expandedUpId = expandedUpId === id ? null : id;
  renderUpcoming();
  if (expandedUpId) {
    requestAnimationFrame(() => {
      const el = document.getElementById('ui-' + id);
      if (el) el.focus();
    });
  }
}

// ── ACTIONS ──
function doRevDone(id, source) {
  markRevisionDone(id);
  refreshAfter(source);
}

function doSolved(id, source) {
  markAsSolved(id);
  refreshAfter(source);
}

function doDelete(id, source) {
  if (!confirm('Delete this question?')) return;
  if (expandedAllId === id) expandedAllId = null;
  if (expandedUpId  === id) expandedUpId  = null;
  deleteQuestion(id);
  refreshAfter(source);
}

function doNotesBlur(id) {
  const ta = document.getElementById('ni-' + id) || document.getElementById('ui-' + id);
  if (ta) updateNotes(id, ta.value);
}

function refreshAfter(source) {
  renderStats();
  renderDueToday();
  if (source === 'all')      renderAllQuestions();
  if (source === 'upcoming') renderUpcoming();
  if (source === 'home')     { /* due cards already re-rendered above */ }
  document.getElementById('due-count').textContent = getDueToday().length;
}