import axios from 'axios';
import { extractErrorMessage } from '@/utils/errors';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Response interceptor ─────────────────────────────────────────────────────
// Normalizes ALL error responses before they reach any component.
// Components always get a clean Error with a safe .message string.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log technical details to console (dev only, never shown in UI)
    if (import.meta.env.DEV) {
      console.error('[API Error]', error);
    }
    // Replace the error message with a safe user-friendly string
    const safeMessage = extractErrorMessage(error);
    const normalized = new Error(safeMessage);
    normalized.status   = error.response?.status;
    normalized.code     = error.response?.data?.code;
    normalized.original = error; // keep for programmatic checks if needed
    return Promise.reject(normalized);
  }
);

// --- CHAT ---
export const chatAPI = {
  send: (data) => fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }),
};

// --- MATERI ---
export const materiAPI = {
  getAll: () => api.get('/materials'),
  delete: (id) => api.post(`/materials/${id}/delete`),
  importYoutube: (data) => api.post('/materials/youtube', data),
};

// --- SUBJECT ---
export const subjectAPI = {
  getAll: () => api.get('/subjects'),
  getById: (id) => api.get(`/subjects/${id}`),
  delete: (id) => api.post(`/subjects/${id}/delete`),
};

// --- NOTES ---
export const notesAPI = {
  getAll: () => api.get('/notes'),
  delete: (id) => api.post(`/notes/${id}/delete`),
  clear: () => api.post('/notes/clear'),
};

// --- FLASHCARDS ---
export const flashcardAPI = {
  getAll: () => api.get('/flashcards'),
  delete: (id) => api.post(`/flashcards/${id}/delete`),
  clear: () => api.post('/flashcards/clear'),
  generate: (formData) => fetch('/api/flashcards/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(formData).toString(),
  }).then(r => r.json()),
};

// --- QUIZ ---
export const quizAPI = {
  getAll: () => api.get('/quizzes'),
  getQuestions: (id) => api.get(`/quizzes/${id}/questions`),
  generate: (formData) => fetch('/api/quizzes/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(formData).toString(),
  }).then(r => r.json()),
  saveScore: (id, score) => fetch(`/api/quizzes/${id}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ score }).toString(),
  }).then(r => r.json()),
  delete: (id) => api.delete(`/quizzes/${id}`),
  clear: () => api.post('/quizzes/clear'),
};

// --- AUDIO ---
export const audioAPI = {
  generate: (materialId) => api.post(`/materials/${materialId}/audio`),
  status: (materialId) => api.get(`/materials/${materialId}/audio`),
};

// --- EXAM ANALYZER ---
export const examAPI = {
  // Analysis
  analyze: (subjectId) => api.post(`/exam/analyze/${subjectId}`, {}, { timeout: 120000 }),

  // Blueprint
  generateBlueprint: (payload) => api.post('/exam/blueprint', payload, { timeout: 120000 }),
  getBlueprints: (subjectId) => api.get(`/exam/blueprints/${subjectId}`),

  // Question generation → creates a session (long operation, needs extra timeout)
  generateQuestions: (blueprintId) => api.post(`/exam/generate/${blueprintId}`, {}, { timeout: 300000 }),

  // Sessions
  getSession: (sessionId) => api.get(`/exam/session/${sessionId}`),
  getSessions: (subjectId) => api.get(`/exam/sessions/${subjectId}`),

  // Submit & evaluate
  submit: (sessionId, answers) => api.post(`/exam/submit/${sessionId}`, { answers }, { timeout: 120000 }),

  // Recommendation
  getRecommendation: (sessionId) => api.get(`/exam/recommendation/${sessionId}`),

  // Retry from question bank — zero AI
  retry: (blueprintId, weakTopics = []) =>
    api.post(`/exam/retry/${blueprintId}`, { weak_topics: weakTopics }, { timeout: 30000 }),

  // Lazy AI explanation for one question (cached in bank)
  getExplanation: (payload) => api.post('/exam/explain', payload, { timeout: 60000 }),

  // Question bank stats
  getBankStats: (subjectId) => api.get(`/exam/bank/stats/${subjectId}`),
};

// --- EXAM HISTORY ---
export const examHistoryAPI = {
  // Save full result when user clicks "Selesai"
  save: (payload) => api.post('/history/save', payload, { timeout: 30000 }),
  // Save retry attempt result
  retry: (historySessionId, payload) => api.post(`/history/retry/${historySessionId}`, payload, { timeout: 30000 }),
  // List all history (optional ?subject_id= filter)
  list: (subjectId) => api.get('/history/list', { params: subjectId ? { subject_id: subjectId } : {} }),
  // Full detail of one history session
  detail: (historySessionId) => api.get(`/history/detail/${historySessionId}`),
  // Save / replace study plan on a history session
  saveStudyPlan: (historySessionId, planData) => api.post(`/history/study-plan/${historySessionId}`, planData),
  // Toggle one study plan item completed
  togglePlanItem: (itemId) => api.post(`/history/plan-item/${itemId}/toggle`),
  // Delete history session
  delete: (historySessionId) => api.delete(`/history/delete/${historySessionId}`),
};

export default api;
