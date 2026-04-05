const STORAGE_KEY = 'dsa_revise_v2';

function getQuestions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveQuestions(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
