let leetcodeDB = {};

async function initDatabase() {
  try {
    const res = await fetch('./leetcode-db.json');
    const data = await res.json();
    data.forEach(q => {
      leetcodeDB[q.id] = {
        name: q.title,
        difficulty: q.difficulty,
        patterns: q.patterns,
        slug: q.slug
      };
    });
    console.log(`DB loaded: ${data.length} questions ready for O(1) lookup.`);
  } catch (e) {
    console.warn('Local DB load failed. Run on a local server for auto-fill.', e);
  }
}
initDatabase();

function lookupQuestion(id) {
  const numId = parseInt(id);
  if (isNaN(numId) || !leetcodeDB[numId]) return null;
  return leetcodeDB[numId];
}

function mapLeetCodeTagsToUI(lcTags) {
  if (!lcTags || lcTags.length === 0) return [];
  const mapping = {
    'array': 'Arrays / Strings', 'string': 'Arrays / Strings', 'sorting': 'Arrays / Strings', 'matrix': 'Arrays / Strings',
    'hash table': 'HashMap / Set', 'hash function': 'HashMap / Set',
    'two pointers': 'Two Pointers', 'sliding window': 'Sliding Window', 'prefix sum': 'Prefix Sum',
    'binary search': 'Binary Search', 'linked list': 'Linked List',
    'stack': 'Stack / Queue', 'queue': 'Stack / Queue', 'monotonic stack': 'Stack / Queue',
    'tree': 'Trees / BST', 'binary tree': 'Trees / BST', 'binary search tree': 'Trees / BST', 'trie': 'Trees / BST',
    'graph': 'Graphs / DFS / BFS', 'depth-first search': 'Graphs / DFS / BFS', 'breadth-first search': 'Graphs / DFS / BFS',
    'union find': 'Graphs / DFS / BFS', 'topological sort': 'Graphs / DFS / BFS',
    'heap (priority queue)': 'Heap / PQ',
    'dynamic programming': 'Dynamic Programming', 'backtracking': 'Backtracking', 'greedy': 'Greedy',
    'math': 'Math / Bit', 'bit manipulation': 'Math / Bit', 'geometry': 'Math / Bit'
  };
  let result = new Set();
  for (let tag of lcTags) {
    const mapped = mapping[tag.toLowerCase()];
    if (mapped) result.add(mapped);
  }
  return Array.from(result);
}

function today() { return new Date().toISOString().split('T')[0]; }

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function generateSlug(name) {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function lcUrl(slug) { return `https://leetcode.com/problems/${slug}/`; }

function addQuestion({ number, name, pattern, difficulty, status, notes = '' }) {
  const questions = getQuestions();
  const numId = parseInt(number);
  const isSolved = status === 'solved';
  const dbEntry = leetcodeDB[numId];

  const q = {
    id:           crypto.randomUUID(),
    number:       numId,
    name:         name.trim(),
    slug:         dbEntry?.slug || generateSlug(name.trim()),
    pattern:      Array.isArray(pattern) ? pattern : [pattern],
    difficulty,
    status,
    notes:        notes.trim().slice(0, 600),
    attempts:     isSolved ? 1 : 0,
    lastSolved:   isSolved ? today() : null,
    lastRevised:  null,
    nextRevision: isSolved ? addDays(today(), 1) : null,
    revisionCount: 0,
    createdAt:    new Date().toISOString(),
    lastUpdated:  new Date().toISOString()
  };

  questions.push(q);
  saveQuestions(questions);
  return q;
}

function editQuestion(id, { name, pattern, difficulty, notes }) {
  const questions = getQuestions();
  const q = questions.find(q => q.id === id);
  if (!q) return null;
  const dbEntry = leetcodeDB[q.number];
  q.name        = name.trim();
  q.slug        = dbEntry?.slug || generateSlug(name.trim());
  q.pattern     = Array.isArray(pattern) ? pattern : [pattern];
  q.difficulty  = difficulty;
  q.notes       = notes.trim().slice(0, 600);
  q.lastUpdated = new Date().toISOString();
  saveQuestions(questions);
  return q;
}

function markAsSolved(id) {
  const questions = getQuestions();
  const q = questions.find(q => q.id === id);
  if (!q) return;
  q.status        = 'solved';
  q.attempts     += 1;
  q.lastSolved    = today();
  q.nextRevision  = addDays(today(), 1);
  q.revisionCount = 0;
  q.lastUpdated   = new Date().toISOString();
  saveQuestions(questions);
  return q;
}

function markRevisionDone(id) {
  const questions = getQuestions();
  const q = questions.find(q => q.id === id);
  if (!q || q.status === 'learning' || q.status === 'mastered') return;

  // Ebbinghaus-based intervals: 1, 3, 7, 14, 30 days — mastery after 5 revisions
  const intervals = [1, 3, 7, 14, 30];
  q.revisionCount += 1;
  q.lastRevised   = today();
  q.lastUpdated   = new Date().toISOString();

  if (q.revisionCount >= 5) {
    q.status       = 'mastered';
    q.nextRevision = null;
  } else {
    q.status       = 'revising';
    q.nextRevision = addDays(today(), intervals[q.revisionCount - 1] ?? 30);
  }
  saveQuestions(questions);
  return q;
}

function markAllDueToday() {
  const due = getDueToday();
  due.forEach(q => markRevisionDone(q.id));
  return due.length;
}

function updateNotes(id, notes) {
  const questions = getQuestions();
  const q = questions.find(q => q.id === id);
  if (!q) return;
  q.notes       = notes.slice(0, 600);
  q.lastUpdated = new Date().toISOString();
  saveQuestions(questions);
}

function deleteQuestion(id) {
  saveQuestions(getQuestions().filter(q => q.id !== id));
}

function getDueToday() {
  const t = today();
  return getQuestions().filter(q => q.nextRevision && q.nextRevision <= t && q.status !== 'mastered');
}

function getUpcoming() {
  return getQuestions()
    .filter(q => q.nextRevision !== null && q.status !== 'mastered')
    .sort((a, b) => a.nextRevision.localeCompare(b.nextRevision));
}

function getStats() {
  const all = getQuestions();
  return {
    total:    all.length,
    learning: all.filter(q => q.status === 'learning').length,
    revising: all.filter(q => q.status === 'solved' || q.status === 'revising').length,
    mastered: all.filter(q => q.status === 'mastered').length,
    due:      getDueToday().length
  };
}