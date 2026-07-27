import pytest
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.testclient import TestClient
from exceptions import add_exception_handlers, AppError

app = FastAPI(title="test_errors")
router = APIRouter()
add_exception_handlers(app)


@router.get("/app-error")
def trigger_app_error():
    raise AppError("something went wrong", status_code=400, detail=None)


@router.get("/app-error-with-detail")
def trigger_app_error_with_detail():
    raise AppError("validation failed", status_code=422, detail={"field": "email"})


@router.get("/value-error")
def trigger_value_error():
    raise ValueError("bad input")


@router.get("/generic-error")
def trigger_generic_error():
    raise RuntimeError("unexpected")


@router.get("/http-exception")
def trigger_http_exception():
    raise HTTPException(status_code=404, detail="not found")


app.include_router(router)
client = TestClient(app, raise_server_exceptions=False)


class TestAppErrorHandler:
    def test_app_error_returns_400(self):
        resp = client.get("/app-error")
        assert resp.status_code == 400
        data = resp.json()
        assert data["detail"] == "something went wrong"

    def test_app_error_with_detail_object(self):
        resp = client.get("/app-error-with-detail")
        assert resp.status_code == 422
        data = resp.json()
        assert data["detail"] == "validation failed"
        assert data["data"] == {"field": "email"}


class TestValueErrorHandler:
    def test_value_error_returns_400(self):
        resp = client.get("/value-error")
        assert resp.status_code == 400
        data = resp.json()
        assert "bad input" in data["detail"]


class TestGenericErrorHandler:
    def test_generic_error_returns_500(self):
        resp = client.get("/generic-error")
        assert resp.status_code == 500
        data = resp.json()
        assert data["detail"] == "Internal server error"


class TestHTTPExceptionHandler:
    def test_http_exception_returns_404(self):
        resp = client.get("/http-exception")
        assert resp.status_code == 404
        data = resp.json()
        assert data["detail"] == "not found"