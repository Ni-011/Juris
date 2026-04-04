"""
PDF Parser – Extracts text from PDFs using PyMuPDF with OCR fallback.

Preserves page numbers, detects headings via font-size heuristics,
and falls back to OCR for scanned pages.
"""

import fitz  # PyMuPDF
from typing import Optional
from parsers.ocr_engine import ocr_page_image


def parse_pdf(
    file_path: str,
    ocr_fallback: bool = True,
    language: str = "en",
) -> dict:
    """
    Parse a PDF file and extract structured sections.

    Returns:
        {
            "page_count": int,
            "language": str,
            "sections": [
                {
                    "content": str,
                    "page_number": int,
                    "section_heading": str | None,
                    "chunk_type": "text" | "table",
                    "metadata": {}
                }
            ]
        }
    """
    doc = fitz.open(file_path)
    sections = []
    page_count = len(doc)

    for page_num in range(page_count):
        page = doc[page_num]

        # Try text extraction first
        text = page.get_text("text").strip()

        # If the page has very little text, it might be scanned
        if len(text) < 50 and ocr_fallback:
            # Render page to image and OCR it
            try:
                pix = page.get_pixmap(dpi=300)
                img_bytes = pix.tobytes("png")
                ocr_text = ocr_page_image(img_bytes, language=language)
                if ocr_text and len(ocr_text.strip()) > 10:
                    text = ocr_text
            except Exception as e:
                print(f"[PDF Parser] OCR fallback failed for page {page_num + 1}: {e}")

        if not text.strip():
            continue

        # Try to detect heading from the first line with font analysis
        heading = _detect_heading(page)

        # Extract tables if present
        try:
            tables = page.find_tables()
            if tables and tables.tables:
                for table in tables.tables:
                    table_md = _table_to_markdown(table)
                    if table_md:
                        sections.append({
                            "content": table_md,
                            "page_number": page_num + 1,
                            "section_heading": heading,
                            "chunk_type": "table",
                            "metadata": {"source": "pdf_table"},
                        })
        except Exception:
            pass  # Table extraction is best-effort

        # Add the text content
        sections.append({
            "content": text,
            "page_number": page_num + 1,
            "section_heading": heading,
            "chunk_type": "text",
            "metadata": {},
        })

    doc.close()

    # Detect language from first ~2000 chars of content
    detected_lang = language
    try:
        from langdetect import detect
        all_text = " ".join(s["content"][:500] for s in sections[:5])
        if all_text.strip():
            detected_lang = detect(all_text)
    except Exception:
        pass

    return {
        "page_count": page_count,
        "language": detected_lang,
        "sections": sections,
    }


def _detect_heading(page) -> Optional[str]:
    """
    Detect the most prominent heading on a page by analyzing font sizes.
    Returns the text of the largest font-size block on the page (if it's
    significantly larger than the median), or None.
    """
    try:
        blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
        text_spans = []

        for block in blocks:
            if block.get("type") != 0:  # text block
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    size = span.get("size", 12)
                    if text and len(text) > 2:
                        text_spans.append((text, size))

        if not text_spans:
            return None

        # Find the largest font size
        sizes = [s[1] for s in text_spans]
        median_size = sorted(sizes)[len(sizes) // 2]
        max_size = max(sizes)

        # If the largest is significantly bigger than median, it's a heading
        if max_size > median_size * 1.2:
            heading_texts = [t for t, s in text_spans if s >= max_size * 0.95]
            if heading_texts:
                heading = " ".join(heading_texts)
                # Don't return if it's too long (not a heading)
                if len(heading) < 200:
                    return heading

    except Exception:
        pass

    return None


def _table_to_markdown(table) -> Optional[str]:
    """Convert a PyMuPDF table to a Markdown table format."""
    try:
        data = table.extract()
        if not data or len(data) < 2:
            return None

        # Build markdown table
        lines = []
        header = data[0]
        lines.append("| " + " | ".join(str(c or "").strip() for c in header) + " |")
        lines.append("| " + " | ".join("---" for _ in header) + " |")

        for row in data[1:]:
            lines.append("| " + " | ".join(str(c or "").strip() for c in row) + " |")

        md = "\n".join(lines)
        return md if len(md) > 20 else None
    except Exception:
        return None
