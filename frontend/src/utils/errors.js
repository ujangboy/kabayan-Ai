/**
 * Global error utilities — Kabayan AI
 *
 * Rules:
 *   - Never render raw exception objects, stack traces, or internal JSON.
 *   - All user-facing error messages come from this module.
 *   - Technical details stay in the browser console (dev only).
 */

// ─── HTTP status → user-friendly message ─────────────────────────────────────
const HTTP_MESSAGES = {
  400: 'Data yang dikirim tidak valid.',
  401: 'Silakan login kembali.',
  403: 'Anda tidak memiliki akses ke fitur ini.',
  404: 'Data tidak ditemukan.',
  408: 'Koneksi timeout. Silakan coba lagi.',
  422: 'Data yang dimasukkan belum valid.',
  429: 'Terlalu banyak permintaan. Silakan tunggu beberapa saat.',
  500: 'Terjadi kesalahan pada server.',
  502: 'Server tidak merespons. Coba lagi nanti.',
  503: 'Layanan sedang tidak tersedia.',
  504: 'Koneksi timeout. Silakan coba lagi.',
};

// ─── Backend error code → user-friendly message ───────────────────────────────
const CODE_MESSAGES = {
  AI_LOOP_GUARD:       'Sistem anti-spam aktif. Tunggu sekitar 1 menit.',
  AI_RATE_LIMIT:       'Kuota AI sedang mencapai batas. Coba beberapa menit lagi.',
  TIMEOUT:             'Koneksi timeout. Silakan coba lagi.',
  SERVICE_UNAVAILABLE: 'Layanan sedang tidak tersedia.',
  DB_ERROR:            'Gagal memproses data.',
  FILE_ERROR:          'Gagal memproses file.',
  VALIDATION_ERROR:    'Data yang dimasukkan belum valid.',
  PARSE_ERROR:         'Terjadi kesalahan saat memproses respons AI.',
  NOT_FOUND:           'Data tidak ditemukan.',
  UNAUTHORIZED:        'Silakan login kembali.',
  INTERNAL_ERROR:      'Terjadi kesalahan pada sistem.',
};

const NETWORK_MESSAGE = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
const FALLBACK_MESSAGE = 'Terjadi kesalahan yang tidak diketahui.';

// ─── Core extractor ───────────────────────────────────────────────────────────

/**
 * Extract a safe, user-friendly error message from any thrown value.
 *
 * Priority:
 *   1. Backend structured: { code, message } or { success: false, message }
 *   2. Backend legacy:     { detail }
 *   3. HTTP status code
 *   4. Network error (no response)
 *   5. Fallback
 *
 * @param  {unknown} error  — anything caught in a catch block
 * @returns {string}        — safe message to show the user
 */
export function extractErrorMessage(error) {
  if (!error) return FALLBACK_MESSAGE;

  // ── Axios error ──────────────────────────────────────────────────────────
  if (error.response) {
    const { status, data } = error.response;

    // Structured backend error  { success, code, message }
    if (data && typeof data === 'object') {
      if (data.code && CODE_MESSAGES[data.code]) {
        return CODE_MESSAGES[data.code];
      }
      if (data.message && typeof data.message === 'string' && data.message.length < 200) {
        return data.message;
      }
      // Legacy FastAPI { detail }
      if (data.detail && typeof data.detail === 'string' && data.detail.length < 200) {
        return _sanitizeDetail(data.detail);
      }
    }

    return HTTP_MESSAGES[status] || `Terjadi kesalahan (${status}).`;
  }

  // ── No response (network / CORS / timeout) ───────────────────────────────
  if (error.request || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
    if (error.code === 'ECONNABORTED' || (error.message || '').toLowerCase().includes('timeout')) {
      return HTTP_MESSAGES[408];
    }
    return NETWORK_MESSAGE;
  }

  // ── Plain Error object (fetch or manual throw) ───────────────────────────
  if (error instanceof Error) {
    const msg = error.message || '';
    // Only show if it looks like a clean user message, not a stack/technical string
    if (_isSafeMessage(msg)) return msg;
    return FALLBACK_MESSAGE;
  }

  // ── String ───────────────────────────────────────────────────────────────
  if (typeof error === 'string' && error.length < 200 && _isSafeMessage(error)) {
    return error;
  }

  return FALLBACK_MESSAGE;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Block messages that look like technical internals. */
function _isSafeMessage(msg) {
  if (!msg || typeof msg !== 'string') return false;
  const lower = msg.toLowerCase();
  const TECHNICAL = [
    'traceback', 'exception', 'error at line', 'stack', '.py', '.js',
    'sqlalchemy', 'sqlite3', 'json decode', 'regex', 'valueerror',
    'typeerror', 'keyerror', 'attributeerror', 'indentationerror',
    'file "', '/home/', '/usr/', 'c:\\', 'groq', 'openai',
  ];
  return !TECHNICAL.some(t => lower.includes(t));
}

/** Strip any internal details that may have leaked into the `detail` field. */
function _sanitizeDetail(detail) {
  if (!_isSafeMessage(detail)) return FALLBACK_MESSAGE;
  return detail;
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

/** True if the axios error is a network/offline error (no HTTP response). */
export function isNetworkError(error) {
  return !!error && !error.response && (!!error.request || error.code === 'ERR_NETWORK');
}

/** True if the backend returned a rate-limit response. */
export function isRateLimitError(error) {
  if (!error?.response) return false;
  const { status, data } = error.response;
  return status === 429 || data?.code === 'AI_RATE_LIMIT' || data?.code === 'AI_LOOP_GUARD';
}
