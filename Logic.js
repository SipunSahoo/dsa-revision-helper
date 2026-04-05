// ── LEETCODE DATABASE LAYER (O(1) Hash Map) ──
let leetcodeDB = {};

async function initDatabase() {
  try {
    const res = await fetch('./leetcode-db.json');
    const data = await res.json();
    data.forEach(q => {
      leetcodeDB[q.id] = {
        name: q.title,
        difficulty: q.difficulty,
        patterns: q.patterns
      };
    });
    console.log("Database loaded into memory! Ready for O(1) lookups.");
  } catch (e) {
    console.error("Local DB load failed. Ensure you are using a local server.", e);
  }
}
initDatabase();

function lookupQuestion(id) {
  const numId = parseInt(id);
  if (isNaN(numId) || !leetcodeDB[numId]) return null;
  return leetcodeDB[numId];
}

// Adapter Pattern: Translates LeetCode's raw tags to match your UI <select> exact strings
function mapLeetCodeTagsToUI(lcTags) {
  if (!lcTags || lcTags.length === 0) return [];
  
  const mapping = {
    "Hash Table": "HashMap / Frequency",
    "Stack": "Stack / Monotonic Stack",
    "Monotonic Stack": "Stack / Monotonic Stack",
    "Tree": "Trees",
    "Binary Tree": "Trees",
    "Graph": "Graphs",
    "Heap (Priority Queue)": "Heap / Priority Queue"
  };

  const exactMatches = [
    "Two Pointers", "Sliding Window", "Prefix Sum", 
    "Binary Search", "Linked List", "Dynamic Programming", 
    "Backtracking", "Greedy"
  ];

  // We use a Set to automatically eliminate duplicates
  let result = new Set();

  for (let tag of lcTags) {
    if (mapping[tag]) result.add(mapping[tag]);
    else if (exactMatches.includes(tag)) result.add(tag);
  }
  
  // Convert the Set back to a standard Array for UI mapping
  return Array.from(result);
}

// ── DATE HELPERS ──
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

// ── CRUD STATE MACHINE ──
function addQuestion({ number, name, pattern, difficulty, status, notes = '' }) {
  const questions = getQuestions();
  
  const isSolved = status === 'solved';

  const q = {
    id:           crypto.randomUUID(),
    number:       parseInt(number),
    name:         name.trim(),
    slug:         generateSlug(name),
    pattern:      Array.isArray(pattern) ? pattern : [pattern],
    difficulty,
    status:       status, // 'learning' or 'solved'
    notes:        notes.trim().slice(0, 300),
    
    // Engine Initialization: Only trigger timers if status is 'solved'
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

function markAsSolved(id) {
  const questions = getQuestions();
  const q = questions.find(q => q.id === id);
  if (!q) return;
  q.status       = 'solved';
  q.attempts    += 1;
  q.lastSolved   = today();
  q.nextRevision = addDays(today(), 1); 
  q.revisionCount = 0;
  q.lastUpdated  = new Date().toISOString();
  saveQuestions(questions);
  return q;
}

function markRevisionDone(id) {
  const questions = getQuestions();
  const q = questions.find(q => q.id === id);
  if (!q || q.status === 'learning' || q.status === 'mastered') return;
  
  const intervals = [1, 3, 7]; 
  q.revisionCount += 1;
  q.lastRevised   = today();
  q.lastUpdated   = new Date().toISOString();
  
  if (q.revisionCount >= 4) {
    q.status       = 'mastered';
    q.nextRevision = null; 
  } else {
    q.status       = 'revising';
    q.nextRevision = addDays(today(), intervals[q.revisionCount - 1] || 7);
  }
  saveQuestions(questions);
  return q;
}

function updateNotes(id, notes) {
  const questions = getQuestions();
  const q = questions.find(q => q.id === id);
  if (!q) return;
  q.notes       = notes.slice(0, 300);
  q.lastUpdated = new Date().toISOString();
  saveQuestions(questions);
}

function deleteQuestion(id) {
  saveQuestions(getQuestions().filter(q => q.id !== id));
}

// ── QUERIES ──
function getDueToday() {
  const t = today();
  return getQuestions().filter(
    q => q.nextRevision && q.nextRevision <= t && q.status !== 'mastered'
  );
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
