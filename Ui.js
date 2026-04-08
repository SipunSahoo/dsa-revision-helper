// ── STATE ──
let currentSection  = 'home';
let navHistory      = [];
let editingId       = null;
let pendingDeleteId = null;
let pendingDeleteSource = null;
let expandedAllId   = null;
let expandedUpId    = null;
let filterPattern   = '';
let filterStatus    = '';
let searchAllQuery  = '';
let searchUpQuery   = '';
let sortAll         = { field: 'createdAt', dir: 'desc' };
let sortUp          = { field: 'nextRevision', dir: 'asc' };
const selectedPatternsSet = new Set();

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const overlay = document.getElementById('intro-overlay');
    overlay.classList.add('exit');
    setTimeout(() => overlay.remove(), 550);
  }, 2000);

  // Sidebar nav
  document.querySelectorAll('.snav-item').forEach(tab => {
    tab.addEventListener('click', () => switchSection(tab.dataset.section));
  });
  // Mobile bottom nav
  document.querySelectorAll('.mnav-item').forEach(tab => {
    tab.addEventListener('click', () => switchSection(tab.dataset.section));
  });

  document.getElementById('btn-add').addEventListener('click', () => openAddForm());
  document.getElementById('mobile-add-trigger').addEventListener('click', () => openAddForm());
  document.getElementById('btn-submit').addEventListener('click', handleSubmit);

  document.getElementById('f-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSubmit();
  });

  // Pattern pills
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

  // LC# autofill
  document.getElementById('f-number').addEventListener('input', (e) => {
    if (editingId) return; // don't autofill when editing
    const q = lookupQuestion(e.target.value);
    if (q) {
      document.getElementById('f-name').value = q.name;
      if (q.difficulty) document.getElementById('f-diff').value = q.difficulty;
      const mapped = mapLeetCodeTagsToUI(q.patterns);
      selectedPatternsSet.clear();
      document.querySelectorAll('.pattern-pill').forEach(pill => {
        const isMatch = mapped.includes(pill.dataset.val);
        pill.classList.toggle('active', isMatch);
        if (isMatch) selectedPatternsSet.add(pill.dataset.val);
      });
    }
  });

  // Filters
  document.getElementById('filter-pattern').addEventListener('change', e => { filterPattern = e.target.value; renderAllQuestions(); });
  document.getElementById('filter-status').addEventListener('change', e => { filterStatus = e.target.value; renderAllQuestions(); });

  // Search
  document.getElementById('search-all').addEventListener('input', e => {
    searchAllQuery = e.target.value.trim().toLowerCase();
    renderAllQuestions();
  });
  document.getElementById('search-upcoming').addEventListener('input', e => {
    searchUpQuery = e.target.value.trim().toLowerCase();
    renderUpcoming();
  });

  // Sortable column headers
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      const table = th.dataset.table;
      if (table === 'all') {
        if (sortAll.field === field) sortAll.dir = sortAll.dir === 'asc' ? 'desc' : 'asc';
        else { sortAll.field = field; sortAll.dir = 'asc'; }
        renderAllQuestions();
      } else if (table === 'upcoming') {
        if (sortUp.field === field) sortUp.dir = sortUp.dir === 'asc' ? 'desc' : 'asc';
        else { sortUp.field = field; sortUp.dir = 'asc'; }
        renderUpcoming();
      }
    });
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('delete-confirm-overlay').classList.contains('hidden')) { cancelDelete(); return; }
      if (!document.getElementById('modal-backdrop').classList.contains('hidden')) { hideModal(); return; }
      closeForm();
    }
  });

  renderAll();
});

// ── UTILS ──
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmt(iso) { return iso ? iso.split('T')[0] : '—'; }
function formatPatterns(p) {
  if (!p || p.length === 0) return 'None';
  return Array.isArray(p) ? p.join(', ') : p;
}
function getStatusLabel(q) {
  if (q.status === 'learning') return 'Learning';
  if (q.status === 'solved')   return 'Solved';
  if (q.status === 'revising') return `Rev ${q.revisionCount}`;
  if (q.status === 'mastered') return 'Mastered';
  return q.status;
}

// ── TOAST ──
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-dot"></span>${esc(msg)}`;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, 2600);
}

// ── NAVIGATION ──
function switchSection(name, addToHistory = true) {
  if (addToHistory && currentSection !== name) {
    navHistory.push(currentSection);
  }
  closeForm();
  document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.snav-item').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.mnav-item').forEach(t => t.classList.remove('active'));
  document.getElementById('section-' + name).classList.remove('hidden');
  document.querySelectorAll(`.snav-item[data-section="${name}"], .mnav-item[data-section="${name}"]`)
    .forEach(el => el.classList.add('active'));
  currentSection = name;
  updateBackButton();
  if (name === 'home')     renderAll();
  if (name === 'all')      renderAllQuestions();
  if (name === 'upcoming') renderUpcoming();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBack() {
  if (navHistory.length === 0) return;
  const prev = navHistory.pop();
  filterPattern = '';
  filterStatus  = '';
  document.getElementById('filter-pattern').value = '';
  document.getElementById('filter-status').value  = '';
  switchSection(prev, false);
}

function updateBackButton() {
  const btn = document.getElementById('btn-back');
  if (btn) btn.classList.toggle('hidden', navHistory.length === 0);
}

function navigateToFiltered(statusFilter) {
  filterStatus  = statusFilter;
  filterPattern = '';
  document.getElementById('filter-status').value  = statusFilter;
  document.getElementById('filter-pattern').value = '';
  switchSection('all');
}

// ── RENDER ALL ──
function renderAll() { renderDueToday(); renderStats(); }

// ── ADD / EDIT FORM ──
function openAddForm() {
  editingId = null;
  document.getElementById('form-title-text').textContent = 'Add Question';
  document.getElementById('form-mode-badge').style.display = 'none';
  document.getElementById('btn-submit').textContent = 'Add Question';
  document.getElementById('f-number').disabled = false;
  document.getElementById('f-status-wrap').style.display = '';
  const w = document.getElementById('add-form-wrap');
  w.classList.remove('hidden');
  document.getElementById('f-number').focus();
}

function openEditForm(id) {
  const q = getQuestions().find(q => q.id === id);
  if (!q) return;
  editingId = id;

  document.getElementById('form-title-text').textContent = 'Edit Question';
  document.getElementById('form-mode-badge').style.display = 'inline-block';
  document.getElementById('btn-submit').textContent = 'Save Changes';
  document.getElementById('f-number').disabled = true;
  document.getElementById('f-status-wrap').style.display = 'none'; // status changed via actions

  document.getElementById('f-number').value = q.number;
  document.getElementById('f-name').value   = q.name;
  document.getElementById('f-diff').value   = q.difficulty;
  document.getElementById('f-notes').value  = q.notes || '';

  selectedPatternsSet.clear();
  document.querySelectorAll('.pattern-pill').forEach(pill => {
    const active = Array.isArray(q.pattern) ? q.pattern.includes(pill.dataset.val) : q.pattern === pill.dataset.val;
    pill.classList.toggle('active', active);
    if (active) selectedPatternsSet.add(pill.dataset.val);
  });

  hideModal();
  const w = document.getElementById('add-form-wrap');
  w.classList.remove('hidden');
  document.getElementById('f-name').focus();

  // Scroll to top to show the form
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeForm() {
  document.getElementById('add-form-wrap').classList.add('hidden');
  editingId = null;
  selectedPatternsSet.clear();
  document.querySelectorAll('.pattern-pill').forEach(p => p.classList.remove('active'));
  ['f-number','f-name','f-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-diff').value   = '';
  document.getElementById('f-status').value = 'solved';
  document.getElementById('f-number').disabled = false;
  document.getElementById('f-status-wrap').style.display = '';
  clearValidationErrors();
}

// ── VALIDATION ──
function showFieldError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.add('field-error');
  const wrapper = el.closest('.fg');
  if (!wrapper) return;
  let errEl = wrapper.querySelector('.field-err-msg');
  if (!errEl) { errEl = document.createElement('div'); errEl.className = 'field-err-msg'; wrapper.appendChild(errEl); }
  errEl.textContent = msg;
  el.addEventListener('input', () => {
    el.classList.remove('field-error');
    const e = wrapper.querySelector('.field-err-msg'); if (e) e.remove();
  }, { once: true });
}
function clearValidationErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
  document.querySelectorAll('.field-err-msg').forEach(el => el.remove());
}
function validateForm() {
  clearValidationErrors();
  let ok = true;
  const number = document.getElementById('f-number').value.trim();
  const name   = document.getElementById('f-name').value.trim();
  const diff   = document.getElementById('f-diff').value;

  if (!editingId) {
    if (!number) { showFieldError('f-number', 'Required'); ok = false; }
    else if (isNaN(parseInt(number)) || parseInt(number) < 1) { showFieldError('f-number', 'Must be a positive number'); ok = false; }
    if (ok && !editingId) {
      const existing = getQuestions().find(q => q.number === parseInt(number));
      if (existing) { showFieldError('f-number', `#${number} "${existing.name}" already exists`); ok = false; }
    }
  }
  if (!name) { showFieldError('f-name', 'Required'); ok = false; }
  if (!diff) { showFieldError('f-diff', 'Select a difficulty'); ok = false; }
  return ok;
}

function handleSubmit() {
  if (!validateForm()) return;

  const name       = document.getElementById('f-name').value.trim();
  const difficulty = document.getElementById('f-diff').value;
  const notes      = document.getElementById('f-notes').value.trim();
  const patternList = Array.from(selectedPatternsSet);

  if (editingId) {
    editQuestion(editingId, { name, pattern: patternList, difficulty, notes });
    showToast(`"${name}" updated.`, 'success');
    closeForm();
    refreshAfter(currentSection);
  } else {
    const number = document.getElementById('f-number').value.trim();
    const status = document.getElementById('f-status').value;
    addQuestion({ number, name, pattern: patternList, difficulty, status, notes });
    showToast(`LC #${number} added!`, 'success');
    closeForm();
    if (currentSection === 'home')     renderAll();
    if (currentSection === 'all')      renderAllQuestions();
    if (currentSection === 'upcoming') renderUpcoming();
    renderStats();
  }
}

// ── STATS ──
function renderStats() {
  const s = getStats();
  const cards = [
    { val: s.total,    lbl: 'Total Questions', col: 'var(--tx-2)',    filter: '',         hint: 'View all →' },
    { val: s.learning, lbl: 'Learning',        col: 'var(--red)',     filter: 'learning', hint: 'View learning →' },
    { val: s.revising, lbl: 'In Revision',     col: 'var(--yellow)',  filter: 'revising', hint: 'View in revision →' },
    { val: s.mastered, lbl: 'Mastered',        col: 'var(--green)',   filter: 'mastered', hint: 'View mastered →' }
  ];
  document.getElementById('stats-row').innerHTML = cards.map(c => `
    <div class="stat-card stat-card-clickable"
         onclick="navigateToFiltered('${c.filter}')"
         role="button" tabindex="0">
      <div class="stat-val" style="color:${c.col}">${c.val}</div>
      <div class="stat-lbl">${c.lbl}</div>
      <div class="stat-nav-hint">${c.hint}</div>
    </div>
  `).join('');
}

// ── DUE TODAY ──
function renderDueToday() {
  const due  = getDueToday();
  const list = document.getElementById('due-list');
  const t    = today();
  document.getElementById('due-count').textContent = due.length;

  const markAllBtn = document.getElementById('mark-all-btn');
  markAllBtn.classList.toggle('hidden', due.length === 0);

  if (due.length === 0) {
    list.innerHTML = `<p class="due-empty">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      All caught up for today — great work!
    </p>`;
    return;
  }

  list.innerHTML = due.map((q, i) => {
    const isOverdue = q.nextRevision < t;
    return `
      <div class="due-card${isOverdue ? ' overdue' : ''}" style="animation-delay:${i * 0.04}s">
        <div class="dc-num">LC #${q.number}</div>
        <div class="dc-name">${esc(q.name)}</div>
        <div class="dc-meta">
          <span class="badge badge-${q.status}">${getStatusLabel(q)}</span>
          <span class="diff-${q.difficulty.toLowerCase()}">${q.difficulty}</span>
          ${isOverdue ? `<span style="color:var(--red);font-family:var(--mono);font-size:10px;">overdue</span>` : ''}
        </div>
        <div class="dc-actions">
          <button class="btn btn-sm btn-ghost" onclick="openDetailModal('${q.id}')">Details</button>
          <button class="btn btn-sm btn-success" onclick="doRevDone('${q.id}', 'home')">Mark Done ✓</button>
          <a class="btn btn-sm btn-blue" href="${lcUrl(q.slug)}" target="_blank" rel="noopener">Open LC ↗</a>
        </div>
      </div>`;
  }).join('');
}

// ── MARK ALL DUE ──
function handleMarkAllDue() {
  const count = markAllDueToday();
  showToast(`${count} question${count !== 1 ? 's' : ''} marked as done!`, 'success');
  renderAll();
}

// ── SORT HELPER ──
function sortQuestions(qs, field, dir) {
  const diffOrder = { Easy: 0, Medium: 1, Hard: 2 };
  const statusOrder = { learning: 0, solved: 1, revising: 2, mastered: 3 };
  return [...qs].sort((a, b) => {
    let av = a[field], bv = b[field];
    if (field === 'difficulty') { av = diffOrder[av] ?? 0; bv = diffOrder[bv] ?? 0; }
    if (field === 'status')     { av = statusOrder[av] ?? 0; bv = statusOrder[bv] ?? 0; }
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

function updateSortArrows(tableId, sortState) {
  document.querySelectorAll(`th.sortable[data-table="${tableId}"]`).forEach(th => {
    const arrow = th.querySelector('.sort-arrow');
    const isActive = th.dataset.sort === sortState.field;
    th.classList.toggle('sort-active', isActive);
    if (arrow) arrow.textContent = isActive ? (sortState.dir === 'asc' ? ' ↑' : ' ↓') : '';
  });
}

// ── ALL QUESTIONS TABLE ──
function renderAllQuestions() {
  let qs = getQuestions();
  document.getElementById('total-count').textContent = qs.length;

  if (filterPattern) qs = qs.filter(q => Array.isArray(q.pattern) ? q.pattern.includes(filterPattern) : q.pattern === filterPattern);
  if (filterStatus)  qs = qs.filter(q => q.status === filterStatus);
  if (searchAllQuery) {
    qs = qs.filter(q =>
      q.name.toLowerCase().includes(searchAllQuery) ||
      String(q.number).includes(searchAllQuery)
    );
  }

  qs = sortQuestions(qs, sortAll.field, sortAll.dir);
  updateSortArrows('all', sortAll);

  const tbody = document.getElementById('all-tbody');
  const empty = document.getElementById('all-empty');
  if (qs.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = qs.map(q => buildAllRow(q)).join('');
}

function buildAllRow(q) {
  const isOpen   = expandedAllId === q.id;
  const canRev   = q.status === 'solved' || q.status === 'revising';
  const nextDisp = q.status === 'mastered' ? '✓ mastered' : (q.nextRevision || '—');
  return `
    <tr class="q-row ${isOpen ? 'open' : ''}" onclick="toggleAllDetail('${q.id}')">
      <td class="td-num">${q.number}</td>
      <td class="td-name"><i class="exp-icon">▶</i>${esc(q.name)}</td>
      <td class="hide-sm" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;" title="${esc(formatPatterns(q.pattern))}">${esc(formatPatterns(q.pattern))}</td>
      <td class="hide-sm"><span class="diff-${q.difficulty.toLowerCase()}">${q.difficulty}</span></td>
      <td><span class="badge badge-${q.status}">${getStatusLabel(q)}</span></td>
      <td class="td-date hide-md">${fmt(q.createdAt)}</td>
      <td class="td-date hide-md">${q.lastSolved || '—'}</td>
      <td class="td-date hide-md">${nextDisp}</td>
      <td class="td-acts" onclick="event.stopPropagation()">
        <a class="btn btn-sm btn-blue" href="${lcUrl(q.slug)}" target="_blank" rel="noopener" title="Open on LeetCode">LC</a>
      </td>
    </tr>
    <tr class="detail-row ${isOpen ? 'open' : ''}">
      <td colspan="9">
        <div class="detail-grid">
          <div>
            <div class="detail-notes-lbl" style="margin-bottom:5px;">Patterns</div>
            <div style="font-family:var(--mono);font-size:11.5px;color:var(--accent);margin-bottom:14px;">${esc(formatPatterns(q.pattern))}</div>
            <div class="detail-notes-lbl">Notes</div>
            <textarea class="detail-notes-ta" id="ni-${q.id}" maxlength="600" rows="4"
              onblur="doNotesBlurById('${q.id}','ni-${q.id}')"
              onclick="event.stopPropagation()">${esc(q.notes)}</textarea>
            <div class="detail-stats">
              <div class="ds">Attempts: <span>${q.attempts}</span></div>
              ${q.status !== 'learning' ? `<div class="ds">Revisions: <span>${q.revisionCount}/5</span></div>` : ''}
              <div class="ds">Last Revised: <span>${q.lastRevised || '—'}</span></div>
              <div class="ds">Next Rev: <span>${nextDisp}</span></div>
            </div>
          </div>
          <div class="detail-btns" onclick="event.stopPropagation()">
            ${q.status !== 'mastered' ? `<button class="btn btn-sm btn-success" onclick="doSolved('${q.id}', 'all')">Mark Solved</button>` : ''}
            ${canRev ? `<button class="btn btn-sm btn-yellow" onclick="doRevDone('${q.id}', 'all')">Rev Done ✓</button>` : ''}
            <button class="btn btn-sm btn-ghost" onclick="openEditForm('${q.id}')">Edit</button>
            <a class="btn btn-sm btn-blue" href="${lcUrl(q.slug)}" target="_blank" rel="noopener">Open LC ↗</a>
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
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
}

// ── UPCOMING TABLE ──
function renderUpcoming() {
  let qs = getUpcoming();
  const t = today();

  if (searchUpQuery) {
    qs = qs.filter(q =>
      q.name.toLowerCase().includes(searchUpQuery) ||
      String(q.number).includes(searchUpQuery)
    );
  }
  qs = sortQuestions(qs, sortUp.field, sortUp.dir);
  updateSortArrows('upcoming', sortUp);

  const tbody = document.getElementById('upcoming-tbody');
  const empty = document.getElementById('upcoming-empty');
  document.getElementById('upcoming-count').textContent = qs.length;
  if (qs.length === 0) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  tbody.innerHTML = qs.map(q => buildUpcomingRow(q, t)).join('');
}

function buildUpcomingRow(q, t) {
  const isOpen    = expandedUpId === q.id;
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
      <td class="hide-sm" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;" title="${esc(formatPatterns(q.pattern))}">${esc(formatPatterns(q.pattern))}</td>
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
            <div class="detail-notes-lbl" style="margin-bottom:5px;">Patterns</div>
            <div style="font-family:var(--mono);font-size:11.5px;color:var(--accent);margin-bottom:14px;">${esc(formatPatterns(q.pattern))}</div>
            <div class="detail-notes-lbl">Notes</div>
            <textarea class="detail-notes-ta" id="ui-${q.id}" maxlength="600" rows="4"
              onblur="doNotesBlurById('${q.id}','ui-${q.id}')"
              onclick="event.stopPropagation()">${esc(q.notes)}</textarea>
            <div class="detail-stats">
              <div class="ds">Attempts: <span>${q.attempts}</span></div>
              ${q.status !== 'learning' ? `<div class="ds">Revisions: <span>${q.revisionCount}/5</span></div>` : ''}
              <div class="ds">Last Revised: <span>${q.lastRevised || '—'}</span></div>
            </div>
          </div>
          <div class="detail-btns" onclick="event.stopPropagation()">
            ${q.status !== 'mastered' ? `<button class="btn btn-sm btn-success" onclick="doSolved('${q.id}', 'upcoming')">Mark Solved</button>` : ''}
            ${canRev ? `<button class="btn btn-sm btn-yellow" onclick="doRevDone('${q.id}', 'upcoming')">Rev Done ✓</button>` : ''}
            <button class="btn btn-sm btn-ghost" onclick="openEditForm('${q.id}')">Edit</button>
            <a class="btn btn-sm btn-blue" href="${lcUrl(q.slug)}" target="_blank" rel="noopener">Open LC ↗</a>
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
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
}

// ── DETAIL MODAL ──
function openDetailModal(id) {
  const q = getQuestions().find(q => q.id === id);
  if (!q) return;
  const canRev   = q.status === 'solved' || q.status === 'revising';
  const nextDisp = q.status === 'mastered' ? '✓ Mastered' : (q.nextRevision || '—');
  const patterns = Array.isArray(q.pattern) ? q.pattern : [q.pattern];
  const pct      = Math.min(100, Math.round((q.revisionCount / 5) * 100));

  document.getElementById('detail-modal').innerHTML = `
    <div class="modal-header">
      <div>
        <div class="modal-title-num">
          LC #${q.number}
          <span class="diff-${q.difficulty.toLowerCase()}">${q.difficulty}</span>
          <span class="badge badge-${q.status}">${getStatusLabel(q)}</span>
        </div>
        <div class="modal-title-name">${esc(q.name)}</div>
      </div>
      <button class="modal-close" onclick="hideModal()" aria-label="Close">✕</button>
    </div>
    <div class="modal-body">
      <div class="modal-section">
        <span class="modal-lbl">Patterns</span>
        <div class="modal-patterns">
          ${patterns.map(p => `<span class="modal-pattern-chip">${esc(p)}</span>`).join('')}
        </div>
      </div>
      <div class="modal-section">
        <span class="modal-lbl">Progress</span>
        <div class="modal-stats-row">
          <div class="modal-stat-box">
            <div class="modal-stat-val">${q.attempts}</div>
            <div class="modal-stat-lbl">Attempts</div>
          </div>
          <div class="modal-stat-box">
            <div class="modal-stat-val">${q.status !== 'learning' ? q.revisionCount + '/5' : '—'}</div>
            <div class="modal-stat-lbl">Revisions</div>
          </div>
          <div class="modal-stat-box">
            <div class="modal-stat-val" style="font-size:15px;padding-top:5px;">${nextDisp}</div>
            <div class="modal-stat-lbl">Next Revision</div>
          </div>
        </div>
        ${q.status !== 'learning' ? `
        <div class="mastery-progress">
          <div class="mastery-track"><div class="mastery-fill" style="width:${pct}%"></div></div>
          <div class="mastery-label">${pct}% to mastery</div>
        </div>` : ''}
        <div class="modal-meta-row" style="margin-top:10px;">
          <span>Last Solved: <span>${q.lastSolved || '—'}</span></span>
          <span>Last Revised: <span>${q.lastRevised || '—'}</span></span>
        </div>
      </div>
      <div class="modal-section">
        <span class="modal-lbl">Notes</span>
        <textarea class="modal-notes-ta" id="modal-notes-ta" maxlength="600"
          onblur="doNotesBlurById('${q.id}','modal-notes-ta')">${esc(q.notes)}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      ${q.status !== 'mastered' ? `<button class="btn btn-sm btn-success" onclick="doSolved('${q.id}', 'home'); hideModal()">Mark Solved</button>` : ''}
      ${canRev ? `<button class="btn btn-sm btn-yellow" onclick="doRevDone('${q.id}', 'home'); hideModal()">Rev Done ✓</button>` : ''}
      <button class="btn btn-sm btn-ghost" onclick="openEditForm('${q.id}')">Edit</button>
      <a class="btn btn-sm btn-blue" href="${lcUrl(q.slug)}" target="_blank" rel="noopener">Open LC ↗</a>
      <button class="btn btn-sm btn-danger" onclick="doDelete('${q.id}', 'home'); hideModal()">Delete</button>
      <button class="btn btn-sm btn-ghost" onclick="hideModal()">Close</button>
    </div>
  `;
  document.getElementById('modal-backdrop').classList.remove('hidden');
}

function hideModal() {
  const ta = document.getElementById('modal-notes-ta');
  if (ta) ta.dispatchEvent(new Event('blur'));
  document.getElementById('modal-backdrop').classList.add('hidden');
}

function handleBackdropClick(e) {
  if (e.target === document.getElementById('modal-backdrop')) hideModal();
}

// ── NOTES ──
function doNotesBlurById(id, taId) {
  const ta = document.getElementById(taId);
  if (ta) updateNotes(id, ta.value);
}

// ── CUSTOM DELETE ──
// ── CUSTOM DELETE ──
function doDelete(id, source) {
  const q = getQuestions().find(q => q.id === id);
  if (!q) return;
  pendingDeleteId     = id;
  pendingDeleteSource = source;
  document.getElementById('dcb-name-display').textContent = `LC #${q.number} — ${q.name}`;
  document.getElementById('delete-confirm-overlay').classList.remove('hidden');
}

function cancelDelete() {
  pendingDeleteId     = null;
  pendingDeleteSource = null;
  document.getElementById('delete-confirm-overlay').classList.add('hidden');
}
window.cancelDelete = cancelDelete; // Expose globally for HTML onclick

function confirmDelete() {
  if (!pendingDeleteId) return;
  const q = getQuestions().find(q => q.id === pendingDeleteId);
  if (expandedAllId === pendingDeleteId) expandedAllId = null;
  if (expandedUpId  === pendingDeleteId) expandedUpId  = null;
  deleteQuestion(pendingDeleteId);
  showToast(`${q ? `"${q.name}"` : 'Question'} deleted.`, 'info');
  const src = pendingDeleteSource;
  cancelDelete();
  refreshAfter(src);
}
window.confirmDelete = confirmDelete; // Expose globally for HTML onclick

function handleDeleteOverlayClick(e) {
  if (e.target === document.getElementById('delete-confirm-overlay')) cancelDelete();
}
window.handleDeleteOverlayClick = handleDeleteOverlayClick; // Expose globally for HTML onclick

// ── IMPORT ──
function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  importData(file)
    .then(count => {
      showToast(`Imported ${count} questions successfully!`, 'success');
      renderAll();
      if (currentSection === 'all')      renderAllQuestions();
      if (currentSection === 'upcoming') renderUpcoming();
    })
    .catch(err => showToast(String(err), 'error'));
  event.target.value = '';
}

// ── ACTIONS ──
function doRevDone(id, source) {
  const q = markRevisionDone(id);
  if (q) {
    const msg = q.status === 'mastered'
      ? `🎉 "${q.name}" mastered!`
      : `Revision ${q.revisionCount}/5 done. Next: ${q.nextRevision}`;
    showToast(msg, 'success');
  }
  refreshAfter(source);
}

function doSolved(id, source) {
  const q = markAsSolved(id);
  if (q) showToast(`"${q.name}" marked as solved!`, 'success');
  refreshAfter(source);
}

function refreshAfter(source) {
  renderStats();
  renderDueToday();
  if (source === 'all')      renderAllQuestions();
  if (source === 'upcoming') renderUpcoming();
  document.getElementById('due-count').textContent = getDueToday().length;
}