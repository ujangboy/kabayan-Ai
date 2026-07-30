# Error Handling Migration Guide — Kabayan AI

## Current State (Before)

Two systems exist side-by-side:

### System A: exceptions.py (root level)
- `AppError` class with `status_code`, `message`, `detail`
- `add_exception_handlers(app)` — registers handlers for `AppError`, `ValueError`, `StarletteHTTPException`, `Exception`
- Imported in `main.py` via `from exceptions import add_exception_handlers`

### System B: services/error_handler.py
- `safe_json_response()` — pattern-matches exception text to safe user messages
- `classify()` / `safe_response()` — classify + build response body
- `_PATTERNS` map — 10 error categories (rate limit, timeout, db, file, etc.)
- Used in `main.py` as a catch-all `@app.exception_handler(Exception)` that overrides System A's generic handler

### Router Audit (Before Migration)

| Router | Error Pattern | Issues |
|---|---|---|
| `chat.py` | `try/except` → `return JSONResponse(...)` | Raw `str(e)` leaked to frontend |
| `dashboard.py` | `try/except` → `return JSONResponse(...)` | Raw `str(e)` leaked |
| `exam_analyzer.py` | `try/except ValueError` → 400, `Exception` → 500 | Mostly consistent, some mixed |
| `flashcards.py` | `try/except` → `return JSONResponse(...)` | Raw `str(e)` leaked |
| `materials.py` | `try` with direct `JSONResponse` errors | Mixed response format |
| `notes.py` | `try/except` → `return JSONResponse(...)` | Raw `str(e)` leaked |
| `quizzes.py` | `try/except` → `return JSONResponse(...)` | Inline error messages |
| `subjects.py` | `try/except` → `return JSONResponse(...)` | Raw `str(e)` leaked |
| `youtube.py` | `try/except` → `return JSONResponse(...)` | Raw `str(e)` leaked |
| `settings.py` | `try/except` → `return JSONResponse(...)` | Raw `str(e)` leaked |

**None** of the routers used `AppError` or `safe_json_response`.

---

## What Changed

### 1. services/error_handler.py — Unified handler

**Before**: Pattern matching only; didn't know about AppError.

**After**: 
- Imports `AppError` from `exceptions.py`
- `classify()` checks `isinstance(exc, AppError)` first — uses its own `status_code` and `message`
- Falls through to pattern matching for unknown exceptions
- `register_all_handlers(app)` — registers ALL four handlers in one call:
  - `AppError` → uses its status/message directly
  - `ValueError` → pattern-matched to 422
  - `StarletteHTTPException` → standard FastAPI behavior
  - `Exception` → pattern-matched catch-all

### 2. main.py — Single registration point

**Before**:
```python
from exceptions import add_exception_handlers
...
add_exception_handlers(app)

@app.exception_handler(Exception)  # overrides add_exception_handlers' generic handler
async def global_exception_handler(request, exc):
    from services.error_handler import safe_json_response
    return safe_json_response(exc, ...)
```

**After**:
```python
from services.error_handler import register_all_handlers
...
register_all_handlers(app)  # single call, no duplicates
```

### 3. Pilot Routers (chat.py, exam_analyzer.py) — AppError migration

**Before** (chat.py):
```python
try:
    ...
except ValueError as e:
    return JSONResponse(status_code=400, content={"detail": str(e)})
except Exception as e:
    return JSONResponse(status_code=500, content={"detail": str(e)})
```

**After** (chat.py):
```python
try:
    ...
except ValueError as e:
    raise AppError(str(e), status_code=400)
except Exception as e:
    raise AppError(str(e), status_code=500)
```

---

## How to Migrate a Router

### Step 1: Add import
```python
from exceptions import AppError
```

### Step 2: Replace JSONResponse errors with raise AppError

**Old pattern**:
```python
try:
    result = do_something()
    return JSONResponse(result)
except ValueError as e:
    return JSONResponse(status_code=400, content={"detail": str(e)})
except Exception as e:
    return JSONResponse(status_code=500, content={"detail": str(e)})
```

**New pattern**:
```python
try:
    result = do_something()
    return JSONResponse(result)
except ValueError as e:
    raise AppError(str(e), status_code=400)
except Exception as e:
    raise AppError(str(e), status_code=500)
```

### Step 3: Remove unused imports
```python
# Remove if no longer needed:
from fastapi.responses import JSONResponse  # keep if used for success responses
```

### Step 4: Run validation
```bash
pytest tests/test_error_handling.py -v
```

---

## Error Response Format (Guaranteed)

All errors from the unified system follow this format:

**AppError (business logic error):**
```json
{
  "detail": "Human-readable message",
  "code": "APP_ERROR",
  "data": { ... }  // optional, only if AppError.detail is set
}
```

**Pattern-matched error (unknown/3rd party):**
```json
{
  "detail": "Safe user-friendly message in Indonesian"
}
```

**HTTPException (FastAPI standard):**
```json
{
  "detail": "Original detail message"
}
```

---

## Testing Checklist

| Test | What to verify |
|---|---|
| `test_app_error_returns_correct_status` | AppException → correct status + message |
| `test_value_error_returns_422` | ValueError → 422 with safe message |
| `test_runtime_error_returns_500` | Unknown error → 500 with fallback message |
| `test_http_exception_returns_403` | HTTPException → status + detail preserved |
| `test_backward_compatibility` | Old `add_exception_handlers()` still works |
| Migrated router endpoints | All endpoint error paths raise AppError |

---

## Timeline

| Phase | What | When |
|---|---|---|
| 1 | Unify handler + fix main.py | Done |
| 2 | Pilot: chat.py, exam_analyzer.py | Done |
| 3 | dashboard.py, flashcards.py, notes.py | Next |
| 4 | quizzes.py, subjects.py, youtube.py | Next |
| 5 | materials.py, settings.py | Final |

Each phase: migrate router → run `pytest` → commit.