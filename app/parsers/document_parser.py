import pymupdf as fitz  # PyMuPDF (paket `fitz` lama sudah deprecated)
import docx
import os
from . import pptx_parser
from . import xlsx_parser

def extract_text(file_path: str) -> str:
    """
    Extracts text from PDF, DOCX, TXT, PPTX, XLSX, and CSV files.
    """
    ext = os.path.splitext(file_path)[1].lower()
    
    # Legacy formats check
    if ext in ['.doc', '.ppt', '.xls']:
        raise ValueError(f"Format lama {ext} tidak didukung. Silakan 'Save As' file Anda ke format modern (.docx, .pptx, .xlsx).")
        
    if ext == '.pdf':
        return extract_from_pdf(file_path)
    elif ext == '.docx':
        return extract_from_docx(file_path)
    elif ext in ['.txt', '.csv', '.md']:
        return extract_from_txt(file_path)
    elif ext == '.pptx':
        return pptx_parser.parse_pptx(file_path)
    elif ext == '.xlsx':
        return xlsx_parser.extract_text(file_path)
    else:
        raise ValueError(f"Unsupported file extension: {ext}")

def extract_from_pdf(file_path: str) -> str:
    try:
        doc = fitz.open(file_path)
        full_text = []
        for page in doc:
            blocks = page.get_text("blocks")
            for block in blocks:
                if block[6] == 0:  # text block
                    text = block[4].strip()
                    if text:
                        full_text.append(text)
        return "\n\n".join(full_text)
    except Exception as e:
        return f"Error membaca PDF: {e}"

def extract_from_docx(file_path: str) -> str:
    try:
        doc = docx.Document(file_path)
        full_text = [para.text.strip() for para in doc.paragraphs if para.text.strip()]
        return "\n\n".join(full_text)
    except Exception as e:
        return f"Error membaca DOCX: {e}"

def extract_from_txt(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception as e:
        return f"Error membaca TXT: {e}"
