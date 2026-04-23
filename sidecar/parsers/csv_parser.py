"""
CSV Parser – Extracts structured rows from CSV/TSV files.
Uses pandas for robust parsing.
"""

import pandas as pd
import io


def parse_csv(file_path: str) -> dict:
    """
    Parse a CSV file into row-group chunks.

    Each chunk contains ~20-30 rows formatted as a markdown table,
    with column headers preserved in metadata.

    Returns:
        {
            "sections": [
                {
                    "content": str (markdown table),
                    "page_number": None,
                    "section_heading": str (column summary),
                    "chunk_type": "table",
                    "metadata": {"columns": [...], "row_range": [start, end]}
                }
            ]
        }
    """
    try:
        # Try comma first, then tab, then auto-detect
        try:
            df = pd.read_csv(file_path)
        except Exception:
            df = pd.read_csv(file_path, sep="\t")

        if df.empty:
            return {"sections": []}

        columns = list(df.columns)
        sections = []
        rows_per_chunk = 25  # ~25 rows per chunk to stay within token budget

        for start_row in range(0, len(df), rows_per_chunk):
            end_row = min(start_row + rows_per_chunk, len(df))
            chunk_df = df.iloc[start_row:end_row]

            # Convert to markdown table
            md_lines = []
            md_lines.append("| " + " | ".join(str(c) for c in columns) + " |")
            md_lines.append("| " + " | ".join("---" for _ in columns) + " |")

            for _, row in chunk_df.iterrows():
                values = [str(v).replace("|", "\\|").strip() for v in row.values]
                md_lines.append("| " + " | ".join(values) + " |")

            md_table = "\n".join(md_lines)

            sections.append({
                "content": md_table,
                "page_number": None,
                "section_heading": f"Rows {start_row + 1}–{end_row} ({', '.join(columns[:5])}{'...' if len(columns) > 5 else ''})",
                "chunk_type": "table",
                "metadata": {
                    "columns": columns,
                    "row_range": [start_row, end_row],
                    "total_rows": len(df),
                    "source": "csv",
                },
            })

        return {"sections": sections}

    except Exception as e:
        print(f"[CSV Parser] Error: {e}")
        # Fallback: read as plain text
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return {
            "sections": [
                {
                    "content": content[:10000],
                    "page_number": None,
                    "section_heading": "CSV Data",
                    "chunk_type": "text",
                    "metadata": {"source": "csv_fallback"},
                }
            ]
        }
