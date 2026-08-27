import axios from 'axios';
import { extractErrorMessage } from '@/utils/errors';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Response interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    // Retry once on 502/503 — these happen transiently when the dev server
    // proxy hasn't warmed up yet or the backend is briefly restarting.
    const config = error.config;
    if ((status === 502 || status === 503) && !config._retried) {
      config._retried = true;
      await new Promise((res) => setTimeout(res, 800));
      try {
        return await api(config);
      } catch {
        // fall through to normal error handling below
      }
    }

    if (import.meta.env.DEV) {
      console.error('[API Error]', error);
    }
    const safeMessage = extractErrorMessage(error);
    const normalized = new Error(safeMessage);
    normalized.status   = status;
    normalized.code     = error.response?.data?.code;
    normalized.original = error;
    return Promise.reject(normalized);
  }
);

// --- MATERI ---
export const materiAPI = {
  getAll: (subjectId) => api.get('/materials', { params: subjectId ? { subject_id: subjectId } : {} }),
  upload: (data) => api.post('/materials', data),
  delete: (id) => api.post(`/materials/${id}/delete`),
  cancel: (id) => api.post(`/materials/${id}/cancel`),
  importYoutube: (data) => api.post('/materials/youtube', data),
};

// --- SUBJECT ---
export const subjectAPI = {
  create: (data) => api.post('/subjects', new URLSearchParams(data).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }),
  getAll: () => api.get('/subjects'),
  getById: (id) => api.get(`/subjects/${id}`),
  getDashboard: (id) => api.get(`/subjects/${id}/dashboard`),
  update: (id, data) => api.post(`/subjects/${id}/update`, new URLSearchParams(data).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }),
  delete: (id) => api.post(`/subjects/${id}/delete`),
};

// --- NOTES ---
export const notesAPI = {
  getAll: () => api.get('/notes'),
  create: (title, content = '', subjectId = null) => {
    const data = new URLSearchParams();
    data.append('title', title);
    data.append('content', content);
    if (subjectId) data.append('subject_id', subjectId);
    return api.post('/notes', data.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },
  generate: (payload) => api.post('/notes/generate', payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 120000,
  }),
  detectContext: (history) => api.post('/notebook/detect-context', { history }),
  generateTitle: (content) => api.post('/notebook/generate-title', { content }),
  delete: (id) => api.post(`/notes/${id}/delete`),
  clear: () => api.post('/notes/clear'),
  rename: (id, title) => api.put(`/notes/${id}/rename`,
    new URLSearchParams({ title }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  ),
  togglePin: (id) => api.post(`/notes/${id}/pin`),
  updateContent: (id, content) => api.patch(`/notes/${id}/content`,
    new URLSearchParams({ content }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  ),
};

// --- FLASHCARDS ---
export const flashcardAPI = {
  getAll: () => api.get('/flashcards'),
  delete: (id) => api.post(`/flashcards/${id}/delete`),
  batchDelete: (ids) => api.post('/flashcards/batch-delete', { ids }).then(r => r.data),
  clear: () => api.post('/flashcards/clear'),
  generate: (payload) => api.post('/flashcards/generate', payload).then(r => r.data),
  review: (flashcardId, rating, responseTimeMs) => api.post('/flashcards/review', {
    flashcard_id: flashcardId,
    rating,
    response_time_ms: responseTimeMs,
  }).then(r => r.data),
  getDue: (subjectId) => api.get('/flashcards/review/due', { params: subjectId ? { subject_id: subjectId } : {} }).then(r => r.data),
  getReviews: (cardIds) => api.get('/flashcards/reviews', { params: { card_ids: cardIds.join(',') } }).then(r => r.data),
};

// --- QUIZ ---
export const quizAPI = {
  getAll: () => api.get('/quizzes'),
  getQuestions: (id) => api.get(`/quizzes/${id}/questions`),
  generate: (payload) => api.post('/quizzes/generate', payload).then(r => r.data),
  saveScore: (id, score) => api.post(`/quizzes/${id}/score`,
    new URLSearchParams({ score: String(score) }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  ).then(r => r.data),
  saveScoreDetailed: (id, score, opts = {}) => api.post(`/quizzes/${id}/score`,
    new URLSearchParams({
      score: String(score),
      ...(opts.correct != null ? { correct_count: String(opts.correct) } : {}),
      ...(opts.wrong != null ? { wrong_count: String(opts.wrong) } : {}),
      ...(opts.timeTaken != null ? { time_taken: String(opts.timeTaken) } : {}),
      ...(opts.totalQuestions != null ? { total_questions: String(opts.totalQuestions) } : {}),
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  ).then(r => r.data),
  delete: (id) => api.delete(`/quizzes/${id}`),
  clear: () => api.post('/quizzes/clear'),
};

// --- EXAM ANALYZER ---
export const examAPI = {
  analyze: (subjectId) => api.post(`/exam/analyze/${subjectId}`, {}, { timeout: 120000 }),
  generateBlueprint: (payload) => api.post('/exam/blueprint', payload, { timeout: 120000 }),
  generateQuestions: (blueprintId) => api.post(`/exam/generate/${blueprintId}`, {}, { timeout: 300000 }),
  getSessions: (subjectId) => api.get('/exam/sessions', { params: subjectId ? { subject_id: subjectId } : {} }),
  submit: (sessionId, answers) => api.post(`/exam/submit/${sessionId}`, { answers }, { timeout: 120000 }),
  getRecommendation: (sessionId) => api.get(`/exam/recommendation/${sessionId}`),
  getExplanation: (payload) => api.post('/exam/explain', payload, { timeout: 60000 }),
  getLearningProfile: (subjectId) => api.get(`/exam/learning-profile/${subjectId}`).then(r => r.data),
};

// --- UNIFIED SESSIONS ---
export const sessionsAPI = {
  list: (subjectId) => api.get('/exam/sessions', { params: subjectId ? { subject_id: subjectId } : {} }),
  detail: (sessionId) => api.get(`/exam/sessions/${sessionId}`),
  retry: (sessionId, payload) => api.post(`/exam/sessions/${sessionId}/retry`, payload || {}, { timeout: 30000 }),
  retryInplace: (sessionId, payload) => api.post(`/exam/sessions/${sessionId}/retry-inplace`, payload || {}, { timeout: 30000 }),
  fetchPracticeQuestions: (sessionId, topicFilter) =>
    api.post(`/exam/sessions/${sessionId}/practice-questions`, null, {
      params: topicFilter ? { topic_filter: topicFilter } : {},
      timeout: 15000,
    }),
  saveStudyPlan: (sessionId, planData) => api.post(`/exam/sessions/${sessionId}/study-plan`, planData),
  togglePlanItem: (itemId) => api.post(`/exam/sessions/plan-item/${itemId}/toggle`),
  submitPlanQuiz: (itemId, payload) => api.post(`/exam/sessions/plan-item/${itemId}/submit-quiz`, payload),
  submitPlanFlashcards: (itemId, payload) => api.post(`/exam/sessions/plan-item/${itemId}/submit-flashcards`, payload),
  generateSummary: (sessionId, topic) => api.post(`/exam/sessions/${sessionId}/summary`, { topic }),
  delete: (sessionId) => api.delete(`/exam/sessions/${sessionId}`),
};

// --- STUDY (Modality Router) ---
export const studyAPI = {
  // rekomendasi modalitas belajar; tier optional (null → semua tier + primary)
  route: (subjectId, tier = null, topic = null) =>
    api.post('/study/route', {
      subject_id: subjectId,
      ...(tier ? { tier } : {}),
      ...(topic ? { topic } : {}),
    }).then(r => r.data),
  // progres belajar: streak konsistensi + tren mastery (PRD US5.1)
  progress: (subjectId = null) =>
    api.get('/study/progress', { params: subjectId ? { subject_id: subjectId } : {} }).then(r => r.data),
  // metrik FSRS global: total/due/new/mastered cards + retensi/stabilitas (PRD US3.3)
  metrics: (subjectId = null) =>
    api.get('/study/metrics', { params: subjectId ? { subject_id: subjectId } : {} }).then(r => r.data),
  // rencana belajar harian (PRD US4.3)
  dailyPlan: (subjectId = null, freeMinutes = 60) =>
    api.get('/study/daily-plan', { params: { free_minutes: freeMinutes, ...(subjectId ? { subject_id: subjectId } : {}) } }).then(r => r.data),
  // knowledge graph (PRD US4.1)
  knowledgeGraph: (subjectId = null) =>
    api.get('/study/knowledge-graph', { params: subjectId ? { subject_id: subjectId } : {} }).then(r => r.data),
  // diagnostic kesiapan (PRD US4.2)
  diagnostic: (subjectId = null) =>
    api.get('/study/diagnostic', { params: subjectId ? { subject_id: subjectId } : {} }).then(r => r.data),
};

// --- TUTOR ---
export const tutorAPI = {
  // list FAQ entries (debug/admin)
  listFAQ: (mata_kuliah = null, limit = 50) =>
    api.get('/tutor/faq', { params: { ...(mata_kuliah ? { mata_kuliah } : {}), limit } }),

  // kirim rating feedback untuk satu respons tutor
  feedback: (payload) => api.post('/tutor/feedback', payload),


  // statistik pemakaian (token, pesan, sesi)
  stats: () => api.get('/tutor/stats'),
};

export default api;

// --- PROFILE (Pengaturan) ---
export const profileAPI = {
  // ambil profil: nama tampilan, foto, bahasa
  get: () => api.get('/profile'),
  // perbarui nama tampilan + bahasa
  update: (payload) => api.put('/profile', payload),
  // unggah foto profil (multipart)
  uploadPhoto: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/profile/photo', fd, { timeout: 15000 });
  },
};

// --- INFO (Tentang) ---
export const infoAPI = {
  get: () => api.get('/info'),
};

// --- DATA (Pengaturan > Data) ---
export const dataAPI = {
  // ringkasan jumlah data per kategori + storage
  overview: () => api.get('/data/overview'),
  // pemakaian Groq API per fitur + total (limit AI)
  usage: (period = '24h') => api.get('/usage', { params: { period } }),
  // backup/export ZIP
  createBackup: () => api.post('/backup/create').then((r) => r.data),
  listBackups: () => api.get('/backup/list').then((r) => r.data),
  downloadBackup: (filename) => api.get('/backup/download', { params: { filename }, responseType: 'blob' }),
};

// --- SAMPAH (Pengaturan > Data, recycle bin) ---
export const trashAPI = {
  list: () => api.get('/trash'),
  restore: (itemId) => api.post(`/trash/${itemId}/restore`),
  delete: (itemId) => api.post(`/trash/${itemId}/delete`),
  restoreMaterial: (materialId) => api.post(`/trash/materials/${materialId}/restore`),
  deleteMaterial: (materialId) => api.post(`/trash/materials/${materialId}/delete`),
  empty: () => api.post('/trash/empty'),
};
