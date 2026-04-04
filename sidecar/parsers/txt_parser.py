"""
Plain Text Parser – Handles .txt files with heading detection.
"""

import re


def parse_txt(file_path: str) -> dict:
    """
    Parse a plain text file.
    
    Detects headings heuristically:
    - ALL CAPS lines that are short (< 100 chars)
    - Lines starting with "Chapter", "Section", "Part" + number
    - Lines matching "1.", "1.1.", "I.", "II." numbering patterns

    Returns:
        {
            "sections": [
                {
                    "content": str,
                    "page_number": None,
                    "section_heading": str | None,
                    "chunk_type": "text",
                    "metadata": {}
                }
            ]
        }
    """
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    if not content.strip():
        return {"sections": []}

    # Split on double newlines (paragraph boundaries)
    paragraphs = re.split(r"\n\s*\n", content)
    sections = []
    current_heading = None
    current_parts = []

    heading_pattern = re.compile(
        r"^(?:"
        r"(?:CHAPTER|SECTION|PART|ARTICLE|SCHEDULE|APPENDIX)\s+[\dIVXLCDM]+\.?\s*.*"
        r"|[A-Z][A-Z\s\-–—:,]{5,98}[A-Z]\.?"
        r"|\d+\.\s+[A-Z].*"
        r"|[IVXLCDM]+\.\s+.*"
        r")$",
        re.MULTILINE,
    )

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        lines = para.split("\n")
        first_line = lines[0].strip()

        # Check if this paragraph starts with a heading-like line
        if (
            len(first_line) < 100
            and heading_pattern.match(first_line)
        ):
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

            current_heading = first_line
            # If there's more text after the heading line in this paragraph
            remaining = "\n".join(lines[1:]).strip()
            if remaining:
                current_parts.append(remaining)
        else:
            current_parts.append(para)

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
