"""
HTML Parser – Extracts text from HTML files with section-aware splitting.
Uses BeautifulSoup for DOM parsing.
"""

from bs4 import BeautifulSoup
from typing import Optional


def parse_html(file_path: str) -> dict:
    """
    Parse an HTML file and extract structured sections.

    Splits on semantic elements: <article>, <section>, <h1>–<h6>.
    Tables are emitted as separate sections in markdown format.

    Returns:
        {
            "sections": [
                {
                    "content": str,
                    "page_number": None,
                    "section_heading": str | None,
                    "chunk_type": "text" | "table",
                    "metadata": {}
                }
            ]
        }
    """
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    soup = BeautifulSoup(content, "html.parser")

    # Remove script, style, nav, footer elements
    for tag in soup.find_all(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    sections = []
    current_heading = None

    # Find the main content area (default to body or entire document)
    main_content = soup.find("body") or soup

    # Convert all tables to markdown inline so they aren't lost
    for table in main_content.find_all("table"):
        md = _html_table_to_markdown(table)
        if md:
            table.replace_with(f"\n\n{md}\n\n")
        else:
            table.replace_with("")

    # Extract all remaining text safely
    text = main_content.get_text(separator="\n", strip=True)
    
    if text:
        sections.append({
            "content": text,
            "page_number": None,
            "section_heading": None,
            "chunk_type": "text",
            "metadata": {},
        })

    return {"sections": sections}


def _html_table_to_markdown(table_element) -> Optional[str]:
    """Convert a BeautifulSoup table element to markdown."""
    try:
        rows = []
        for tr in table_element.find_all("tr"):
            cells = []
            for td in tr.find_all(["td", "th"]):
                cells.append(td.get_text(strip=True).replace("|", "\\|"))
            if cells:
                rows.append(cells)

        if len(rows) < 1:
            return None

        # Normalize column count
        max_cols = max(len(r) for r in rows)
        for row in rows:
            while len(row) < max_cols:
                row.append("")

        lines = []
        lines.append("| " + " | ".join(rows[0]) + " |")
        lines.append("| " + " | ".join("---" for _ in rows[0]) + " |")

        for row in rows[1:]:
            lines.append("| " + " | ".join(row) + " |")

        md = "\n".join(lines)
        return md if len(md) > 20 else None
    except Exception:
        return None
