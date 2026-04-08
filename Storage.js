const STORAGE_KEY = 'dsa_revise_v2';

function getQuestions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveQuestions(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function exportData() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    questions: getQuestions()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dsa-revise-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const questions = parsed.questions || (Array.isArray(parsed) ? parsed : null);
        if (!questions || !Array.isArray(questions)) {
          reject('Invalid backup file. Expected a DSA Revise export.');
          return;
        }
        saveQuestions(questions);
        resolve(questions.length);
      } catch {
        reject('Could not parse file. Make sure it is a valid JSON backup.');
      }
    };
    reader.onerror = () => reject('File could not be read.');
    reader.readAsText(file);
  });
}