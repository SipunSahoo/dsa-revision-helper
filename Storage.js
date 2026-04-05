const STORAGE_KEY = 'dsa_revise_v2';

// Fetches the user's saved tracking data from the browser's hard drive
function getQuestions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// Writes the user's tracking data back to the browser's hard drive
function saveQuestions(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
