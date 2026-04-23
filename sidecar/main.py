"""
Juris Sidecar – FastAPI Document Parsing Service

Handles: PDF, DOCX, TXT, HTML, CSV, and image (OCR) parsing with smart chunking.
Runs locally alongside the Next.js app on port 8100.

Usage:
    uvicorn main:app --host 0.0.0.0 --port 8100 --reload
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import tempfile
import os

from parsers.pdf_parser import parse_pdf
from parsers.docx_parser import parse_docx
from parsers.txt_parser import parse_txt
from parsers.html_parser import parse_html
from parsers.csv_parser import parse_csv
from parsers.ocr_engine import parse_image
from chunker.smart_chunker import smart_chunk

app = FastAPI(title="Juris Sidecar", version="1.0.0")


# ─── Request / Response Models ────────────────────────────

class ChunkConfig(BaseModel):
    target_tokens: int = 500
    min_tokens: int = 300
    max_tokens: int = 800
    overlap_tokens: int = 100


class ParseOptions(BaseModel):
    ocr_fallback: bool = True
    language: str = "en"
    chunk_config: ChunkConfig = ChunkConfig()


class ParseRequest(BaseModel):
    file_url: str
    doc_type: str
    doc_id: str
    options: ParseOptions = ParseOptions()


class ChunkResponse(BaseModel):
    chunk_index: int
    content: str
    token_count: int
    page_number: Optional[int] = None
    section_heading: Optional[str] = None
    chunk_type: str = "text"
    metadata: dict = {}


class ParseResponse(BaseModel):
    doc_id: str
    page_count: int
    language: str
    chunks: list[ChunkResponse]


# ─── Endpoints ────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "juris-sidecar"}


@app.post("/parse", response_model=ParseResponse)
async def parse_document(request: ParseRequest):
    """
    Main parsing endpoint.
    1. Download the file from the given URL
    2. Parse it based on doc_type
    3. Chunk the parsed content
    4. Return structured chunks with metadata
    """
    tmp_path = None

    try:
        # ── Download the file ──
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(request.file_url)
            response.raise_for_status()

        # Save to temp file
        suffix = _get_suffix(request.doc_type)
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(response.content)

        print(f"[Sidecar] Downloaded {request.doc_id} ({len(response.content)} bytes) → {tmp_path}")

        # ── Parse based on document type ──
        parsed_sections = []
        page_count = 0
        detected_language = request.options.language

        if request.doc_type == "pdf":
            result = parse_pdf(
                tmp_path,
                ocr_fallback=request.options.ocr_fallback,
                language=request.options.language,
            )
            parsed_sections = result["sections"]
            page_count = result["page_count"]
            detected_language = result.get("language", detected_language)

        elif request.doc_type == "docx":
            result = parse_docx(tmp_path)
            parsed_sections = result["sections"]
            page_count = result.get("page_count", 0)

        elif request.doc_type == "txt":
            result = parse_txt(tmp_path)
            parsed_sections = result["sections"]

        elif request.doc_type == "html":
            result = parse_html(tmp_path)
            parsed_sections = result["sections"]

        elif request.doc_type == "csv":
            result = parse_csv(tmp_path)
            parsed_sections = result["sections"]

        elif request.doc_type == "image":
            result = parse_image(
                tmp_path, language=request.options.language
            )
            parsed_sections = result["sections"]
            page_count = 1

        else:
            # Fallback to plain text
            result = parse_txt(tmp_path)
            parsed_sections = result["sections"]

        # ── Chunk the parsed content ──
        chunks = smart_chunk(
            parsed_sections,
            target_tokens=request.options.chunk_config.target_tokens,
            min_tokens=request.options.chunk_config.min_tokens,
            max_tokens=request.options.chunk_config.max_tokens,
            overlap_tokens=request.options.chunk_config.overlap_tokens,
        )

        print(f"[Sidecar] Doc {request.doc_id}: {len(parsed_sections)} sections → {len(chunks)} chunks")

        return ParseResponse(
            doc_id=request.doc_id,
            page_count=page_count,
            language=detected_language,
            chunks=[
                ChunkResponse(
                    chunk_index=i,
                    content=c["content"],
                    token_count=c["token_count"],
                    page_number=c.get("page_number"),
                    section_heading=c.get("section_heading"),
                    chunk_type=c.get("chunk_type", "text"),
                    metadata=c.get("metadata", {}),
                )
                for i, c in enumerate(chunks)
            ],
        )

    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to download file: HTTP {e.response.status_code}",
        )
    except Exception as e:
        print(f"[Sidecar] Error processing {request.doc_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _get_suffix(doc_type: str) -> str:
    return {
        "pdf": ".pdf",
        "docx": ".docx",
        "txt": ".txt",
        "html": ".html",
        "csv": ".csv",
        "image": ".png",
    }.get(doc_type, ".bin")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8100, reload=True)

