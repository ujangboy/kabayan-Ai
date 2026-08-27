"""Skema respons bersama untuk dokumentasi OpenAPI.

Handler di repo mayoritas mengembalikan JSONResponse secara langsung; oleh
karena itu response_model TIDAK mengubah serialisasi respons (Response object
dilewati), melainkan hanya memperkaya kontrak yang terlihat di /docs. Skema
ini menjaga konsistensi bentuk {status, message} dan {detail} di seluruh API.
"""
from pydantic import BaseModel


class StatusMessage(BaseModel):
    status: str
    message: str


class DetailMessage(BaseModel):
    detail: str
