/**
 * Global error utilities — Kabayan Pintar
 *
 * Rules:
 *   - Never render raw exception objects, stack traces, or internal JSON.
 *   - All user-facing error messages come from this module.
 *   - Technical details stay in the browser console (dev only).
 */

import i18n from '@/i18n';

// ─── HTTP status → translation key ───────────────────────────────────────────
const HTTP_MESSAGE_KEYS = {
  400: 'errors.http400',
  401: 'errors.http401',
  403: 'errors.http403',
  404: 'errors.http404',
  408: 'errors.http408',
  422: 'errors.http422',
  429: 'errors.http429',
  500: 'errors.http500',
  502: 'errors.http502',
  503: 'errors.http503',
  504: 'errors.http504',
};

// ─── Backend error code → translation key ────────────────────────────────────
const CODE_MESSAGE_KEYS = {
  AI_LOOP_GUARD:       'errors.codeAiLoopGuard',
  AI_RATE_LIMIT:       'errors.codeAiRateLimit',
  TIMEOUT:             'errors.codeTimeout',
  SERVICE_UNAVAILABLE: 'errors.codeServiceUnavailable',
  DB_ERROR:            'errors.codeDbError',
  FILE_ERROR:          'errors.codeFileError',
  VALIDATION_ERROR:    'errors.codeValidationError',
  PARSE_ERROR:         'errors.codeParseError',
  NOT_FOUND:           'errors.codeNotFound',
  UNAUTHORIZED:        'errors.codeUnauthorized',
  INTERNAL_ERROR:      'errors.codeInternalError',
};

function tr(key, options) {
  return i18n.t(key, options);
}

const NETWORK_KEY = 'errors.network';
const FALLBACK_KEY = 'errors.fallback';

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
  if (!error) return tr(FALLBACK_KEY);

  // ── Axios error ──────────────────────────────────────────────────────────
  if (error.response) {
    const { status, data } = error.response;

    // Structured backend error  { success, code, message }
    if (data && typeof data === 'object') {
      if (data.code && CODE_MESSAGE_KEYS[data.code]) {
        return tr(CODE_MESSAGE_KEYS[data.code]);
      }
      if (data.message && typeof data.message === 'string' && data.message.length < 200) {
        return data.message;
      }
      // Legacy FastAPI { detail }
      if (data.detail && typeof data.detail === 'string') {
        const detailStr = data.detail.length > 200 ? data.detail.substring(0, 200) + '...' : data.detail;
        return _sanitizeDetail(detailStr);
      }
    }

    return HTTP_MESSAGE_KEYS[status]
      ? tr(HTTP_MESSAGE_KEYS[status])
      : tr('errors.httpGeneric', { status });
  }

  // ── No response (network / CORS / timeout) ───────────────────────────────
  if (error.request || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
    if (error.code === 'ECONNABORTED' || (error.message || '').toLowerCase().includes('timeout')) {
      return tr(HTTP_MESSAGE_KEYS[408]);
    }
    return tr(NETWORK_KEY);
  }

  // ── Plain Error object (fetch or manual throw) ───────────────────────────
  if (error instanceof Error) {
    const msg = error.message || '';
    // Only show if it looks like a clean user message, not a stack/technical string
    if (_isSafeMessage(msg)) return msg;
    return tr(FALLBACK_KEY);
  }

  // ── String ───────────────────────────────────────────────────────────────
  if (typeof error === 'string' && error.length < 200 && _isSafeMessage(error)) {
    return error;
  }

  return tr(FALLBACK_KEY);
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
  if (!_isSafeMessage(detail)) return tr(FALLBACK_KEY);
  return detail;
}
