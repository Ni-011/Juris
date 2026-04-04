"""
OCR Engine – Pytesseract wrapper for scanned documents and images.
"""

import io
from typing import Optional

try:
    import pytesseract
    from PIL import Image
    HAS_OCR = True
except ImportError:
    HAS_OCR = False
    print("[OCR Engine] pytesseract or Pillow not installed. OCR disabled.")


# Tesseract language codes
LANG_MAP = {
    "en": "eng",
    "hi": "hin",
    "mr": "mar",
    "ta": "tam",
    "te": "tel",
    "bn": "ben",
    "gu": "guj",
    "kn": "kan",
    "ml": "mal",
    "pa": "pan",
}


def ocr_page_image(
    image_bytes: bytes,
    language: str = "en",
) -> Optional[str]:
    """
    Run OCR on a page image (PNG bytes).
    Returns extracted text or None if OCR is unavailable.
    """
    if not HAS_OCR:
        return None

    try:
        image = Image.open(io.BytesIO(image_bytes))
        lang = LANG_MAP.get(language, "eng")
        text = pytesseract.image_to_string(image, lang=lang)
        return text.strip() if text else None
    except Exception as e:
        print(f"[OCR Engine] Error: {e}")
        return None


def parse_image(file_path: str, language: str = "en") -> dict:
    """
    Parse an image file via OCR.

    Returns:
        {
            "sections": [{"content": str, "page_number": 1, "chunk_type": "text", ...}]
        }
    """
    if not HAS_OCR:
        return {"sections": []}

    try:
        image = Image.open(file_path)
        lang = LANG_MAP.get(language, "eng")
        text = pytesseract.image_to_string(image, lang=lang)

        if not text or not text.strip():
            return {"sections": []}

        return {
            "sections": [
                {
                    "content": text.strip(),
                    "page_number": 1,
                    "section_heading": None,
                    "chunk_type": "text",
                    "metadata": {"source": "ocr", "language": language},
                }
            ]
        }
    except Exception as e:
        print(f"[OCR Engine] Failed to parse image: {e}")
        return {"sections": []}


def ocr_pdf_pages(file_path: str, language: str = "en") -> list[dict]:
    """
    Convert PDF pages to images and OCR each page.
    Requires the 'pdf2image' library and Poppler.
    """
    try:
        from pdf2image import convert_from_path
    except ImportError:
        print("[OCR Engine] pdf2image not installed. Cannot OCR PDF pages.")
        return []

    if not HAS_OCR:
        return []

    try:
        images = convert_from_path(file_path, dpi=300)
        sections = []
        lang = LANG_MAP.get(language, "eng")

        for page_num, image in enumerate(images, start=1):
            text = pytesseract.image_to_string(image, lang=lang)

            if text and text.strip():
                sections.append({
                    "content": text.strip(),
                    "page_number": page_num,
                    "section_heading": None,
                    "chunk_type": "text",
                    "metadata": {"source": "ocr", "ocr_page": page_num},
                })

        return sections
    except Exception as e:
        print(f"[OCR Engine] PDF OCR failed: {e}")
        return []
