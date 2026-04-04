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
    current_parts = []

    # Find the main content area
    main_content = (
        soup.find("main")
        or soup.find("article")
        or soup.find("body")
        or soup
    )

    for element in main_content.children:
        if not hasattr(element, "name") or element.name is None:
            # NavigableString (raw text)
            text = str(element).strip()
            if text:
                current_parts.append(text)
            continue

        # Heading tags
        if element.name in ("h1", "h2", "h3", "h4", "h5", "h6"):
            # Flush previous section
            if current_parts:
                sections.append({
                    "content": "\n\n".join(current_parts),
                    "page_number": None,
                    "section_heading": current_heading,
                    "chunk_type": "text",
                    "metadata": {},
                })
                current_parts = []

            current_heading = element.get_text(strip=True)

        # Table tags
        elif element.name == "table":
            # Flush text before table
            if current_parts:
                sections.append({
                    "content": "\n\n".join(current_parts),
                    "page_number": None,
                    "section_heading": current_heading,
                    "chunk_type": "text",
                    "metadata": {},
                })
                current_parts = []

            table_md = _html_table_to_markdown(element)
            if table_md:
                sections.append({
                    "content": table_md,
                    "page_number": None,
                    "section_heading": current_heading,
                    "chunk_type": "table",
                    "metadata": {"source": "html_table"},
                })

        # Section/article tags → recurse
        elif element.name in ("section", "article", "div"):
            text = element.get_text(separator="\n", strip=True)
            if text:
                # Check for headings inside
                inner_heading = element.find(["h1", "h2", "h3", "h4", "h5", "h6"])
                if inner_heading:
                    # Flush current
                    if current_parts:
                        sections.append({
                            "content": "\n\n".join(current_parts),
                            "page_number": None,
                            "section_heading": current_heading,
                            "chunk_type": "text",
                            "metadata": {},
                        })
                        current_parts = []
                    current_heading = inner_heading.get_text(strip=True)

                current_parts.append(text)

        # Lists
        elif element.name in ("ul", "ol"):
            items = element.find_all("li")
            list_text = "\n".join(f"• {li.get_text(strip=True)}" for li in items)
            if list_text:
                current_parts.append(list_text)

        # Paragraphs and other block elements
        elif element.name in ("p", "blockquote", "pre", "code"):
            text = element.get_text(strip=True)
            if text:
                current_parts.append(text)

    # Flush remaining
    if current_parts:
        sections.append({
            "content": "\n\n".join(current_parts),
            "page_number": None,
            "section_heading": current_heading,
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
