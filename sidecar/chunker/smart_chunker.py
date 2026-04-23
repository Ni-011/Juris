"""
Smart Chunker – Type-aware document chunking engine.

Handles:
- Text chunks with sentence-level splitting and overlap
- Table chunks as atomic units (no overlap)
- Heading chunks as standalone
- Merging under-sized chunks
- Splitting over-sized chunks at sentence boundaries
"""

import re
import tiktoken

# Use cl100k_base tokenizer (same as GPT-4/embedding models)
_enc = tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    """Count tokens using the cl100k_base encoding."""
    return len(_enc.encode(text))


def smart_chunk(
    sections: list[dict],
    target_tokens: int = 500,
    min_tokens: int = 300,
    max_tokens: int = 800,
    overlap_tokens: int = 100,
) -> list[dict]:
    """
    Smart chunker that respects document structure.

    Args:
        sections: List of parsed sections from the parser.
            Each section has: content, page_number, section_heading, chunk_type, metadata
        target_tokens: Ideal chunk size in tokens
        min_tokens: Minimum chunk size (below this, merge with neighbors)
        max_tokens: Maximum chunk size (above this, split at sentence boundaries)
        overlap_tokens: Number of overlap tokens between consecutive text chunks

    Returns:
        List of chunk dicts ready for embedding.
    """
    if not sections:
        return []

    chunks = []

    for section in sections:
        chunk_type = section.get("chunk_type", "text")
        content = section.get("content", "").strip()

        if not content:
            continue

        # ── Tables: Emit as-is (atomic, no overlap) ──
        if chunk_type == "table":
            tokens = count_tokens(content)
            if tokens <= max_tokens:
                chunks.append({
                    "content": content,
                    "token_count": tokens,
                    "page_number": section.get("page_number"),
                    "section_heading": section.get("section_heading"),
                    "chunk_type": "table",
                    "metadata": section.get("metadata", {}),
                })
            else:
                # Table is too large — split by rows
                table_chunks = _split_large_table(content, max_tokens)
                for tc in table_chunks:
                    chunks.append({
                        "content": tc,
                        "token_count": count_tokens(tc),
                        "page_number": section.get("page_number"),
                        "section_heading": section.get("section_heading"),
                        "chunk_type": "table",
                        "metadata": section.get("metadata", {}),
                    })
            continue

        # ── Headings: Emit as standalone tiny chunks ──
        if chunk_type == "heading":
            tokens = count_tokens(content)
            chunks.append({
                "content": content,
                "token_count": tokens,
                "page_number": section.get("page_number"),
                "section_heading": section.get("section_heading"),
                "chunk_type": "heading",
                "metadata": section.get("metadata", {}),
            })
            continue

        # ── Text: Split with overlap ──
        text_chunks = _chunk_text(
            content,
            target_tokens=target_tokens,
            min_tokens=min_tokens,
            max_tokens=max_tokens,
            overlap_tokens=overlap_tokens,
        )

        for tc in text_chunks:
            chunks.append({
                "content": tc["content"],
                "token_count": tc["token_count"],
                "page_number": section.get("page_number"),
                "section_heading": section.get("section_heading"),
                "chunk_type": "text",
                "metadata": section.get("metadata", {}),
            })

    # ── Post-processing: Merge under-sized chunks ──
    original_chunk_count = len(chunks)
    chunks = _merge_small_chunks(chunks, min_tokens, max_tokens)
    
    print(f"[Smart Chunker] Collapsed {original_chunk_count} raw chunks into {len(chunks)} final chunks")
    for i, c in enumerate(chunks):
        print(f"  -> Chunk {i+1} ({c['chunk_type']}): {c.get('token_count', 0)} tokens")

    return chunks


def _chunk_text(
    text: str,
    target_tokens: int,
    min_tokens: int,
    max_tokens: int,
    overlap_tokens: int,
) -> list[dict]:
    """
    Split text into chunks at sentence boundaries with overlap.
    """
    # Split into sentences
    sentences = _split_sentences(text)

    if not sentences:
        return []

    chunks = []
    current_sentences = []
    current_tokens = 0

    for sentence in sentences:
        sentence_tokens = count_tokens(sentence)

        # If a single sentence exceeds max_tokens, force-split it
        if sentence_tokens > max_tokens:
            # Flush current
            if current_sentences:
                chunk_text = " ".join(current_sentences)
                chunks.append({
                    "content": chunk_text,
                    "token_count": count_tokens(chunk_text),
                })
                current_sentences = []
                current_tokens = 0

            # Split the long sentence by words
            word_chunks = _split_by_words(sentence, max_tokens)
            for wc in word_chunks:
                chunks.append({
                    "content": wc,
                    "token_count": count_tokens(wc),
                })
            continue

        # Would adding this sentence exceed max_tokens?
        if current_tokens + sentence_tokens > max_tokens and current_sentences:
            # Emit current chunk
            chunk_text = " ".join(current_sentences)
            chunks.append({
                "content": chunk_text,
                "token_count": count_tokens(chunk_text),
            })

            # Calculate overlap: take the last N tokens worth of sentences
            overlap_sentences = _get_overlap(current_sentences, overlap_tokens)
            current_sentences = overlap_sentences
            current_tokens = sum(count_tokens(s) for s in current_sentences)

        current_sentences.append(sentence)
        current_tokens += sentence_tokens

    # Flush remaining
    if current_sentences:
        chunk_text = " ".join(current_sentences)
        chunks.append({
            "content": chunk_text,
            "token_count": count_tokens(chunk_text),
        })

    return chunks


def _split_sentences(text: str) -> list[str]:
    """
    Split text into sentences. Handles:
    - Standard periods, question marks, exclamation marks
    - Abbreviations (Mr., Mrs., Dr., etc.) — avoids splitting on these
    - Section numbers (Section 302., Art. 21.) — doesn't split
    """
    # First, normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()

    # Split on sentence-ending punctuation followed by space + uppercase letter or end of string
    raw_parts = re.split(
        r"(?<=[.!?])\s+(?=[A-Z\(\[\"])|(?<=[.!?])\s*$",
        text,
    )

    sentences = [s.strip() for s in raw_parts if s and s.strip()]
    return sentences


def _split_by_words(text: str, max_tokens: int) -> list[str]:
    """Split a very long text by word boundaries to fit within max_tokens."""
    words = text.split()
    chunks = []
    current_words = []
    current_tokens = 0

    for word in words:
        word_tokens = count_tokens(word)
        if current_tokens + word_tokens > max_tokens and current_words:
            chunks.append(" ".join(current_words))
            current_words = []
            current_tokens = 0
        current_words.append(word)
        current_tokens += word_tokens

    if current_words:
        chunks.append(" ".join(current_words))

    return chunks


def _get_overlap(sentences: list[str], overlap_tokens: int) -> list[str]:
    """
    Get the last N tokens worth of sentences for overlap.
    Returns a list of sentences that fit within overlap_tokens.
    """
    if overlap_tokens <= 0:
        return []

    result = []
    total = 0

    for sentence in reversed(sentences):
        tokens = count_tokens(sentence)
        if total + tokens > overlap_tokens:
            break
        result.insert(0, sentence)
        total += tokens

    return result


def _merge_small_chunks(
    chunks: list[dict],
    min_tokens: int,
    max_tokens: int,
) -> list[dict]:
    """
    Merge chunks that are below min_tokens with their neighbors.
    Only merge chunks of the same type and same section heading.
    """
    if len(chunks) <= 1:
        return chunks

    merged = []
    i = 0

    while i < len(chunks):
        chunk = chunks[i]

        # Skip non-text chunks (tables, headings) — they stay as-is
        if chunk["chunk_type"] != "text":
            merged.append(chunk)
            i += 1
            continue

        # If this chunk is under-sized and there's a next text chunk with same heading
        if chunk["token_count"] < min_tokens and i + 1 < len(chunks):
            next_chunk = chunks[i + 1]
            if (
                next_chunk["chunk_type"] == "text"
                and next_chunk.get("section_heading") == chunk.get("section_heading")
                and chunk["token_count"] + next_chunk["token_count"] <= max_tokens
            ):
                # Merge
                combined = chunk["content"] + "\n\n" + next_chunk["content"]
                merged.append({
                    **chunk,
                    "content": combined,
                    "token_count": count_tokens(combined),
                })
                i += 2
                continue

        merged.append(chunk)
        i += 1

    return merged


def _split_large_table(table_text: str, max_tokens: int) -> list[str]:
    """Split a large markdown table into smaller tables."""
    lines = table_text.strip().split("\n")

    if len(lines) < 3:
        return [table_text]

    header = lines[0]
    separator = lines[1]
    data_rows = lines[2:]

    chunks = []
    current_rows = []
    current_tokens = count_tokens(header + "\n" + separator)

    for row in data_rows:
        row_tokens = count_tokens(row)
        if current_tokens + row_tokens > max_tokens and current_rows:
            chunk = "\n".join([header, separator] + current_rows)
            chunks.append(chunk)
            current_rows = []
            current_tokens = count_tokens(header + "\n" + separator)

        current_rows.append(row)
        current_tokens += row_tokens

    if current_rows:
        chunk = "\n".join([header, separator] + current_rows)
        chunks.append(chunk)

    return chunks if chunks else [table_text]
