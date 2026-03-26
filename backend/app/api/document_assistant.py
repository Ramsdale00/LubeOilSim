"""
document_assistant.py — FastAPI router for the Document Assistant / RAG endpoint.

POST /ai/doc-query   — query the D0-D6 knowledge-base documents.
GET  /ai/doc-status  — report which documents are loaded and chunk counts.
"""

from __future__ import annotations

import os
import time
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.simulation.document_rag import (
    DOC_META,
    format_response,
    get_corpus,
    get_loaded_doc_ids,
    query_with_ollama,
    retrieve,
)

router = APIRouter(prefix="/ai", tags=["document-assistant"])

# Resolve the docs directory relative to this file:
# backend/app/api/document_assistant.py → backend/app/api/ → backend/app/ → backend/
_BACKEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)


# ── Request / Response models ─────────────────────────────────────────────────

class DocQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500, description="Natural language question")


class SourceChunk(BaseModel):
    doc_id: str
    doc_title: str
    section: str
    excerpt: str
    score: float


class DocQueryResponse(BaseModel):
    query: str
    answer: str
    sources: list[SourceChunk]
    processing_time_ms: float
    total_chunks_searched: int


class DocStatusEntry(BaseModel):
    doc_id: str
    doc_title: str
    loaded: bool
    chunk_count: int


class DocStatusResponse(BaseModel):
    docs: list[DocStatusEntry]
    total_chunks: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/doc-query", response_model=DocQueryResponse)
async def doc_query(body: DocQueryRequest) -> DocQueryResponse:
    """
    Query the knowledge-base documents using keyword-based retrieval.
    If OLLAMA_URL is configured, Ollama synthesizes a natural language answer.
    Otherwise falls back to returning raw excerpts with source attribution.
    """
    t0 = time.perf_counter()

    corpus = get_corpus(_BACKEND_DIR)
    top_chunks = retrieve(body.query, corpus, k=6)

    # Try LLM synthesis first; fall back to raw excerpts if Ollama is unavailable
    answer = await query_with_ollama(body.query, top_chunks)
    if answer is None:
        answer = format_response(body.query, top_chunks)

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

    return DocQueryResponse(
        query=body.query,
        answer=answer,
        sources=[
            SourceChunk(
                doc_id=c.doc_id,
                doc_title=c.doc_title,
                section=c.section,
                excerpt=c.excerpt,
                score=c.score,
            )
            for c in top_chunks
        ],
        processing_time_ms=elapsed_ms,
        total_chunks_searched=len(corpus),
    )


@router.get("/doc-status", response_model=DocStatusResponse)
async def doc_status() -> DocStatusResponse:
    """
    Return the load status of each knowledge-base document.
    Used by the frontend to show which documents are available.
    """
    corpus = get_corpus(_BACKEND_DIR)

    # Count chunks per doc
    counts: dict[str, int] = {}
    for chunk in corpus:
        counts[chunk.doc_id] = counts.get(chunk.doc_id, 0) + 1

    docs: list[DocStatusEntry] = []
    for doc_id, doc_title in DOC_META.items():
        chunk_count = counts.get(doc_id, 0)
        docs.append(DocStatusEntry(
            doc_id=doc_id,
            doc_title=doc_title,
            loaded=chunk_count > 0,
            chunk_count=chunk_count,
        ))

    return DocStatusResponse(docs=docs, total_chunks=len(corpus))
