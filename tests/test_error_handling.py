"""Tests untuk unified error handling system.

Run: pytest tests/test_error_handling.py -v
     pytest tests/test_error_handling.py -v -k "unified"
"""

import pytest
from fastapi import FastAPI, APIRouter
from fastapi.testclient import TestClient
from exceptions import AppError
from services.error_handler import register_all_handlers, classify, safe_response, safe_json_response


# ── Test: classify() ────────────────────────────────────────────────

class TestClassify:
    def test_app_error_uses_own_status(self):
        status, code, msg = classify(AppError("custom", status_code=418, detail=None))
        assert status == 418
        assert code == "APP_ERROR"
        assert msg == "custom"

    def test_value_error_maps_to_422(self):
        status, code, msg = classify(ValueError("invalid input"))
        assert status == 422
        assert code == "VALIDATION_ERROR"

    def test_timeout_maps_to_408(self):
        status, code, msg = classify(TimeoutError("connection timed out"))
        assert status == 408
        assert code == "TIMEOUT"

    def test_db_error_maps_to_500(self):
        status, code, msg = classify(Exception("sqlite3.OperationalError: database is locked"))
        assert status == 500
        assert code == "DB_ERROR"

    def test_not_found_maps_to_404(self):
        status, code, msg = classify(FileNotFoundError("No such file"))
        assert status == 404
        assert code == "NOT_FOUND"

    def test_not_found_maps_via_404_pattern(self):
        status, code, msg = classify(Exception("404 Resource not found"))
        assert status == 404
        assert code == "NOT_FOUND"

    def test_fallback_for_unknown(self):
        status, code, msg = classify(Exception("some random gibberish that matches nothing"))
        assert status == 500
        assert code == "INTERNAL_ERROR"

    def test_rate_limit_maps_to_429(self):
        status, code, msg = classify(Exception("rate limit exceeded"))
        assert status == 429

    def test_unauthorized_maps_to_401(self):
        status, code, msg = classify(Exception("unauthorized access"))
        assert status == 401

    def test_parse_error_maps_to_500(self):
        status, code, msg = classify(Exception("JSON decode error"))
        assert status == 500
        assert code == "PARSE_ERROR"


# ── Test: safe_response() ──────────────────────────────────────────

class TestSafeResponse:
    def test_returns_dict_and_status(self):
        body, status = safe_response(ValueError("bad"))
        assert isinstance(body, dict)
        assert isinstance(status, int)

    def test_detail_is_never_empty(self):
        body, status = safe_response(Exception(""))
        assert "detail" in body
        assert body["detail"]

    def test_app_error_includes_code_and_data(self):
        body, status = safe_response(AppError("msg", status_code=400, detail={"field": "x"}))
        assert body["detail"] == "msg"
        assert body["code"] == "APP_ERROR"
        assert body["data"] == {"field": "x"}

    def test_app_error_no_detail_omits_data(self):
        body, status = safe_response(AppError("msg", status_code=400))
        assert "data" not in body

    def test_context_is_logged(self):
        body, status = safe_response(Exception("test"), context="test ctx")
        assert status == 500


# ── Test: register_all_handlers() via TestClient ────────────────────

app = FastAPI(title="test_unified_errors")
register_all_handlers(app)
router = APIRouter()


@router.get("/app-error")
def trigger_app_error():
    raise AppError("custom message", status_code=400, detail={"reason": "test"})


@router.get("/app-error-404")
def trigger_app_error_404():
    raise AppError("not found", status_code=404)


@router.get("/value-error")
def trigger_value_error():
    raise ValueError("value error in input field")


@router.get("/runtime-error")
def trigger_runtime_error():
    raise RuntimeError("unexpected")


@router.get("/http-exception")
def trigger_http_exception():
    from fastapi import HTTPException
    raise HTTPException(status_code=403, detail="forbidden")


@router.get("/success")
def trigger_success():
    return {"status": "ok"}


app.include_router(router)
client = TestClient(app, raise_server_exceptions=False)


class TestUnifiedAppErrorHandler:
    def test_app_error_returns_correct_status(self):
        resp = client.get("/app-error")
        assert resp.status_code == 400
        data = resp.json()
        assert data["detail"] == "custom message"
        assert data["code"] == "APP_ERROR"
        assert data["data"] == {"reason": "test"}

    def test_app_error_404(self):
        resp = client.get("/app-error-404")
        assert resp.status_code == 404
        data = resp.json()
        assert data["detail"] == "not found"


class TestUnifiedValueErrorHandler:
    def test_value_error_returns_422(self):
        resp = client.get("/value-error")
        assert resp.status_code == 422
        data = resp.json()
        assert "Data yang dimasukkan belum valid" in data["detail"]


class TestUnifiedGenericHandler:
    def test_runtime_error_returns_500(self):
        resp = client.get("/runtime-error")
        assert resp.status_code == 500
        data = resp.json()
        assert data["detail"] == "Terjadi kesalahan pada sistem. Silakan coba lagi."


class TestUnifiedHTTPExceptionHandler:
    def test_http_exception_returns_403(self):
        resp = client.get("/http-exception")
        assert resp.status_code == 403
        data = resp.json()
        assert data["detail"] == "forbidden"


class TestUnifiedSuccessPath:
    def test_success_unchanged(self):
        resp = client.get("/success")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ── Test: Backward Compatibility ────────────────────────────────────

class TestBackwardCompatibility:
    def test_old_exceptions_module_still_works(self):
        """add_exception_handlers should still work for direct importers."""
        from exceptions import add_exception_handlers
        old_app = FastAPI(title="test_old")
        add_exception_handlers(old_app)
        old_router = APIRouter()

        @old_router.get("/old-app-error")
        def old_trigger():
            raise AppError("old style", status_code=400)

        old_app.include_router(old_router)
        old_client = TestClient(old_app, raise_server_exceptions=False)
        resp = old_client.get("/old-app-error")
        assert resp.status_code == 400
        assert resp.json()["detail"] == "old style"


# ── Test: safe_json_response convenience ────────────────────────────

class TestSafeJsonResponse:
    def test_returns_json_response(self):
        from fastapi.responses import JSONResponse
        result = safe_json_response(ValueError("value error in test"))
        assert isinstance(result, JSONResponse)
        assert result.status_code == 422