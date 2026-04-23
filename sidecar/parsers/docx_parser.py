"""
DOCX Parser – Extracts text from DOCX files with heading/table preservation.
Uses python-docx to walk document elements in order.
"""

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn
from typing import Optional


def parse_docx(file_path: str) -> dict:
    """
    Parse a DOCX file and extract structured sections.

    Preserves:
    - Heading hierarchy (Heading 1, 2, 3, etc.)
    - Paragraph text
    - Tables as markdown
    - Lists with bullet formatting

    Returns:
        {
            "page_count": int,
            "sections": [
                {
                    "content": str,
                    "page_number": None,
                    "section_heading": str | None,
                    "chunk_type": "text" | "table" | "heading",
                    "metadata": {}
                }
            ]
        }
    """
    doc = Document(file_path)
    sections = []
    current_heading = None
    current_text_parts = []

    # Walk through document body elements in order
    for element in doc.element.body:
        # ── Paragraph ──
        if element.tag.endswith("}p"):
            para = Paragraph(element, doc)
            text = para.text.strip()
            if not text:
                continue

            style_name = (para.style.name or "").lower() if para.style else ""

            # Check if this is a heading
            if "heading" in style_name:
                # Flush accumulated text under the previous heading
                if current_text_parts:
                    sections.append({
                        "content": "\n\n".join(current_text_parts),
                        "page_number": None,
                        "section_heading": current_heading,
                        "chunk_type": "text",
                        "metadata": {},
                    })
                    current_text_parts = []

                current_heading = text

                # Also emit the heading as its own section for indexing
                sections.append({
                    "content": text,
                    "page_number": None,
                    "section_heading": current_heading,
                    "chunk_type": "heading",
                    "metadata": {"heading_level": _get_heading_level(style_name)},
                })

            # List items
            elif "list" in style_name or _is_list_item(para):
                bullet = "• " if "bullet" in style_name else "- "
                current_text_parts.append(f"{bullet}{text}")

            # Regular paragraph
            else:
                current_text_parts.append(text)

        # ── Table ──
        elif element.tag.endswith("}tbl"):
            # Flush text before the table
            if current_text_parts:
                sections.append({
                    "content": "\n\n".join(current_text_parts),
                    "page_number": None,
                    "section_heading": current_heading,
                    "chunk_type": "text",
                    "metadata": {},
                })
                current_text_parts = []

            table = Table(element, doc)
            table_md = _table_to_markdown(table)
            if table_md:
                sections.append({
                    "content": table_md,
                    "page_number": None,
                    "section_heading": current_heading,
                    "chunk_type": "table",
                    "metadata": {"source": "docx_table"},
                })

    # Flush any remaining text
    if current_text_parts:
        sections.append({
            "content": "\n\n".join(current_text_parts),
            "page_number": None,
            "section_heading": current_heading,
            "chunk_type": "text",
            "metadata": {},
        })

    return {
        "page_count": 0,  # DOCX doesn't have reliable page info
        "sections": sections,
    }


def _get_heading_level(style_name: str) -> int:
    """Extract heading level from style name like 'heading 1'."""
    for char in style_name:
        if char.isdigit():
            return int(char)
    return 1


def _is_list_item(para) -> bool:
    """Check if a paragraph is a list item by examining its XML."""
    try:
        num_pr = para._element.find(qn("w:pPr"))
        if num_pr is not None:
            num_id = num_pr.find(qn("w:numPr"))
            return num_id is not None
    except Exception:
        pass
    return False


def _table_to_markdown(table: Table) -> Optional[str]:
    """Convert a python-docx Table to markdown format."""
    try:
        rows = []
        for row in table.rows:
            cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
            rows.append(cells)

        if len(rows) < 1:
            return None

        lines = []
        # Header
        lines.append("| " + " | ".join(rows[0]) + " |")
        lines.append("| " + " | ".join("---" for _ in rows[0]) + " |")

        # Data rows
        for row in rows[1:]:
            # Pad row if needed
            while len(row) < len(rows[0]):
                row.append("")
            lines.append("| " + " | ".join(row[: len(rows[0])]) + " |")

        md = "\n".join(lines)
        return md if len(md) > 20 else None
    except Exception:
        return None
