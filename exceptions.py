import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(self, message: str, status_code: int = 400, detail: object = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(self.message)


def add_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        logger.error(f"[{exc.status_code}] {exc.message}", exc_info=False)
        body = {"detail": exc.message}
        if exc.detail is not None and not isinstance(exc.detail, str):
            body["data"] = exc.detail
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        logger.error(f"ValueError: {exc}", exc_info=True)
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )