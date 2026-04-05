let leetcodeDB = {};

async function initDatabase() {
  try {
    const res = await fetch('./leetcode-db.json');
    const data = await res.json();
    data.forEach(q => {
      leetcodeDB[q.id] = { name: q.title, difficulty: q.difficulty, patterns: q.patterns };
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

function mapLeetCodeTagsToUI(lcTags) {
  if (!lcTags || lcTags.length === 0) return [];
  
  // We map everything to lowercase to ensure we never miss a pattern due to formatting
  const mapping = {
    "array": "Arrays / Strings", "string": "Arrays / Strings", "sorting": "Arrays / Strings", "matrix": "Arrays / Strings",
    "hash table": "HashMap / Set", "hash function": "HashMap / Set",
    "two pointers": "Two Pointers", "sliding window": "Sliding Window", "prefix sum": "Prefix Sum",
    "binary search": "Binary Search", "linked list": "Linked List",
    "stack": "Stack / Queue", "queue": "Stack / Queue", "monotonic stack": "Stack / Queue",
    "tree": "Trees / BST", "binary tree": "Trees / BST", "binary search tree": "Trees / BST", "trie": "Trees / BST",
    "graph": "Graphs / DFS / BFS", "depth-first search": "Graphs / DFS / BFS", "breadth-first search": "Graphs / DFS / BFS", "union find": "Graphs / DFS / BFS", "topological sort": "Graphs / DFS / BFS",
    "heap (priority queue)": "Heap / PQ",
    "dynamic programming": "Dynamic Programming", "backtracking": "Backtracking", "greedy": "Greedy",
    "math": "Math / Bit", "bit manipulation": "Math / Bit", "geometry": "Math / Bit"
  };

  // Using a Set inherently removes duplicate mappings
  let result = new Set();

  for (let tag of lcTags) {
    let lowerTag = tag.toLowerCase();
    if (mapping[lowerTag]) {
      result.add(mapping[lowerTag]);
    }
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
  return name.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function lcUrl(slug) { return `https://leetcode.com/problems/${slug}/`; }

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
    status:       status, 
    notes:        notes.trim().slice(0, 300),
    
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