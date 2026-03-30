"""
document_rag.py — Keyword-based RAG engine for LubeOilSim documents.

Loads D1–D6 .docx files from the backend directory, chunks them into paragraphs
and table rows, and scores chunks against a query using pure Python token overlap.

Ollama integration is included: set OLLAMA_URL env var to enable LLM synthesis.
If Ollama is unavailable, format_response() returns raw excerpts as fallback.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Optional

import httpx

# python-docx is required — install via: pip install python-docx
try:
    import docx  # type: ignore
    from docx.text.paragraph import Paragraph as DocxParagraph  # type: ignore
    from docx.table import Table as DocxTable  # type: ignore
    _DOCX_AVAILABLE = True
except ImportError:
    _DOCX_AVAILABLE = False

# ── Ollama config (optional) ───────────────────────────────────────────────────

_OLLAMA_URL: str = os.environ.get("OLLAMA_URL", "")
_OLLAMA_MODEL: str = os.environ.get("OLLAMA_MODEL", "llama3.2")

# ── Document metadata ─────────────────────────────────────────────────────────

DOC_META: dict[str, str] = {
    "D0": "RAG Chatbot User Questions Guide",
    "D1": "Batch Manufacturing Record — 15W-40",
    "D2": "SCADA / OPC-UA Tag Register",
    "D3": "Cybersecurity Risk Assessment (IEC 62443)",
    "D4": "As-Is / To-Be Process Map",
    "D5": "QC Test Procedures & Specifications",
    "D6": "LIMS Requirements Specification",
}

# D0 is a meta-document (sample questions guide about D1–D6), NOT plant knowledge.
# It is loaded and shown in the status panel, but excluded from search results —
# otherwise its 88 question rows outrank the actual content documents.
_EXCLUDE_FROM_RETRIEVAL: frozenset[str] = frozenset({"D0"})

# Common English stop-words to ignore during scoring
_STOP_WORDS: frozenset[str] = frozenset({
    "the", "and", "for", "are", "with", "that", "this", "from", "have", "was",
    "has", "not", "but", "all", "its", "can", "you", "your", "our", "will",
    "been", "also", "into", "used", "use", "each", "may", "shall", "any",
    "such", "they", "then", "than", "when", "where", "which", "there", "their",
    "these", "those", "more", "must", "should", "would", "could", "during",
    "between", "within", "without", "under", "over", "after", "before",
    "following", "based", "per", "via", "e.g", "i.e",
})


# ── Data types ────────────────────────────────────────────────────────────────

@dataclass
class Chunk:
    doc_id: str
    doc_title: str
    section: str
    text: str
    is_heading: bool = False
    tokens: list[str] = field(default_factory=list)
    section_tokens: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.tokens:
            self.tokens = tokenize(self.text)
        if not self.section_tokens:
            self.section_tokens = tokenize(self.section)


@dataclass
class RetrievedChunk:
    doc_id: str
    doc_title: str
    section: str
    excerpt: str
    score: float


# ── Tokeniser ─────────────────────────────────────────────────────────────────

def tokenize(text: str) -> list[str]:
    """Lowercase, split on non-alphanumeric, drop stop-words and short tokens."""
    raw = re.findall(r"\b[a-zA-Z0-9]+\b", text.lower())
    return [t for t in raw if len(t) >= 3 and t not in _STOP_WORDS]


# ── Document loading ──────────────────────────────────────────────────────────

def _extract_chunks_from_docx(path: str, doc_id: str, doc_title: str) -> list[Chunk]:
    """
    Parse a .docx file into paragraph and table-row chunks.

    Iterates document body elements in order (paragraphs and tables interleaved)
    so that tables inherit the current_section set by the nearest preceding
    heading paragraph. This ensures e.g. the "5. Approvals & Sign-Off" table
    rows get section="5. Approvals & Sign-Off" rather than the table header row.
    """
    if not _DOCX_AVAILABLE:
        return []

    try:
        document = docx.Document(path)
    except Exception:
        return []

    chunks: list[Chunk] = []
    current_section = "General"

    for child in document.element.body:
        # Strip XML namespace prefix to get plain tag name ('p' or 'tbl')
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag

        if tag == "p":
            para = DocxParagraph(child, document)
            text = para.text.strip()
            if not text:
                continue

            style_name = para.style.name.lower() if para.style else ""
            is_heading = (
                "heading" in style_name
                or (len(text) < 80 and text.isupper())
                or (len(text) < 80 and text.endswith(":") and "\n" not in text)
            )

            if is_heading:
                current_section = text.rstrip(":")
                if len(text) > 5:
                    chunks.append(Chunk(
                        doc_id=doc_id, doc_title=doc_title,
                        section=current_section, text=text, is_heading=True,
                    ))
            else:
                if len(text) >= 20:
                    chunks.append(Chunk(
                        doc_id=doc_id, doc_title=doc_title,
                        section=current_section, text=text,
                    ))

        elif tag == "tbl":
            table = DocxTable(child, document)
            if not table.rows:
                continue

            # Section is the heading paragraph context, NOT the table header row.
            # This lets the section-bonus scoring connect "approval" queries to
            # rows inside the "5. Approvals & Sign-Off" table.
            table_section = current_section

            for row in table.rows[1:]:  # skip header row
                cells = [c.text.strip() for c in row.cells if c.text.strip()]
                if not cells:
                    continue
                row_text = " | ".join(cells)
                if len(row_text) >= 10:
                    chunks.append(Chunk(
                        doc_id=doc_id,
                        doc_title=doc_title,
                        section=table_section,
                        text=row_text,
                    ))

    return chunks


def load_all_documents(docs_dir: str) -> list[Chunk]:
    """
    Load D0–D6 .docx documents from docs_dir and return all chunks.
    Documents that cannot be found or parsed are skipped silently.
    """
    all_chunks: list[Chunk] = []
    for doc_id, doc_title in DOC_META.items():
        matches = [
            f for f in os.listdir(docs_dir)
            if f.startswith(f"{doc_id}_") and f.endswith(".docx")
        ]
        if not matches:
            continue
        path = os.path.join(docs_dir, matches[0])
        chunks = _extract_chunks_from_docx(path, doc_id, doc_title)
        all_chunks.extend(chunks)

    return all_chunks


# ── Retrieval ─────────────────────────────────────────────────────────────────

def _score_chunk(query_tokens: set[str], chunk: Chunk) -> float:
    """
    Score a chunk by token overlap with the query.
    - Base score: fraction of query tokens that appear in the chunk text.
    - Section bonus: +0.3 if a section token prefix-matches a query token
      (5-char prefix handles singular/plural, e.g. approval/approvals).
    - Heading bonus: ×1.5 if any query token appears in the first 60 chars.
    """
    if not chunk.tokens:
        return 0.0

    chunk_token_set = set(chunk.tokens)
    matches = query_tokens & chunk_token_set
    base_score = len(matches) / max(len(query_tokens), 1) if matches else 0.0

    # Section-token prefix bonus — rescues table rows whose text tokens don't
    # overlap the query but whose section heading does (e.g. approval rows,
    # ingredient rows).
    if chunk.section_tokens:
        for s_tok in set(chunk.section_tokens):
            s_prefix = s_tok[:5]
            for q_tok in query_tokens:
                if q_tok.startswith(s_prefix) or s_tok.startswith(q_tok[:5]):
                    base_score += 0.3
                    break
            else:
                continue
            break  # one +0.3 bonus maximum

    base_score = min(base_score, 1.0)
    if base_score == 0.0:
        return 0.0

    # Heading bonus
    head_text = chunk.text[:60].lower()
    head_bonus = 1.5 if any(t in head_text for t in query_tokens) else 1.0

    # Length penalty — very long chunks dilute relevance slightly
    length_factor = min(1.0, 80 / max(len(chunk.tokens), 1)) + 0.5

    return base_score * head_bonus * length_factor


def retrieve(query: str, chunks: list[Chunk], k: int = 6) -> list[RetrievedChunk]:
    """Return the top-k most relevant chunks for the query."""
    query_tokens = set(tokenize(query))
    if not query_tokens:
        return []

    scored: list[tuple[float, Chunk]] = []
    for chunk in chunks:
        if chunk.doc_id in _EXCLUDE_FROM_RETRIEVAL:
            continue  # skip meta-documents (D0)
        if chunk.is_heading:
            continue  # heading-only chunks carry no answer content
        score = _score_chunk(query_tokens, chunk)
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)

    results: list[RetrievedChunk] = []
    seen_texts: set[str] = set()
    for score, chunk in scored:
        key = chunk.text[:80]
        if key in seen_texts:
            continue
        seen_texts.add(key)

        excerpt = chunk.text if len(chunk.text) <= 300 else chunk.text[:297] + "..."
        results.append(RetrievedChunk(
            doc_id=chunk.doc_id,
            doc_title=chunk.doc_title,
            section=chunk.section,
            excerpt=excerpt,
            score=round(score, 4),
        ))
        if len(results) >= k:
            break

    return results


# ── Response formatters ───────────────────────────────────────────────────────

def format_response(query: str, top_chunks: list[RetrievedChunk]) -> str:
    """
    Fallback formatter — returns a concise summary of the top-2 most relevant
    excerpts with source attribution.  Used when Ollama is unavailable.
    """
    if not top_chunks:
        return (
            "No relevant content found in the D1–D6 knowledge-base documents. "
            "Try rephrasing or using more specific terms from the documents."
        )

    # Show only the 2 highest-scoring chunks to keep the response focused
    display_chunks = top_chunks[:2]
    lines: list[str] = ["(AI synthesis unavailable — showing best matching excerpts)\n"]

    for chunk in display_chunks:
        doc_label = f"[{chunk.doc_id}] {chunk.doc_title}"
        section_label = chunk.section if chunk.section and chunk.section != "General" else ""
        # Truncate long excerpts for readability
        excerpt = chunk.excerpt if len(chunk.excerpt) <= 200 else chunk.excerpt[:197] + "..."

        lines.append(f"Source: {doc_label}" + (f" › {section_label}" if section_label else ""))
        lines.append(f"  {excerpt}")
        lines.append("")

    return "\n".join(lines).strip()


async def query_with_ollama(query: str, top_chunks: list[RetrievedChunk]) -> tuple[Optional[str], Optional[str]]:
    """
    Call Ollama to synthesize a natural language answer from retrieved chunks.

    Returns a (answer, error) tuple:
    - (answer_text, None)  on success
    - (None, error_message) if OLLAMA_URL is not set, the call fails, or the
      response cannot be parsed — the caller should fall back to format_response().
    """
    if not _OLLAMA_URL:
        return None, "OLLAMA_URL is not configured"
    if not top_chunks:
        return None, "No relevant chunks found"

    context_parts = []
    for c in top_chunks:
        context_parts.append(f"[{c.doc_id} — {c.doc_title} | Section: {c.section}]\n{c.excerpt}")
    context = "\n\n".join(context_parts)

    prompt = (
        "You are a document assistant for a Lube Oil Blending Plant. "
        "Answer the question below using ONLY the provided document excerpts. "
        "Be concise and structured. If the answer is a list or chain, use numbered items. "
        "If the excerpts do not contain enough information to answer fully, say so clearly.\n\n"
        f"Question: {query}\n\n"
        f"Document excerpts:\n{context}\n\n"
        "Answer:"
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{_OLLAMA_URL}/chat",
                json={
                    "model": _OLLAMA_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False,
                    "options": {"temperature": 0.1, "num_predict": 400},
                },
            )
            r.raise_for_status()
            data = r.json()

            # Try multiple response shapes in priority order:
            # 1. Ollama /api/chat  → {"message": {"content": "..."}}
            text = (data.get("message") or {}).get("content", "").strip()

            # 2. OpenAI-compatible → {"choices": [{"message": {"content": "..."}}]}
            if not text:
                choices = data.get("choices") or []
                if choices:
                    text = ((choices[0].get("message") or {}).get("content", "") or "").strip()

            # 3. Ollama /api/generate → {"response": "..."}
            if not text:
                text = (data.get("response") or "").strip()

            if text:
                return text, None
            return None, f"Ollama returned an empty response (model={_OLLAMA_MODEL}, keys={list(data.keys())})"

    except httpx.HTTPStatusError as exc:
        return None, f"Ollama HTTP {exc.response.status_code}: {exc.response.text[:200]}"
    except httpx.RequestError as exc:
        return None, f"Ollama connection error: {type(exc).__name__}: {exc}"
    except Exception as exc:
        return None, f"Ollama unexpected error: {type(exc).__name__}: {exc}"


# ── Singleton corpus ──────────────────────────────────────────────────────────

_corpus: Optional[list[Chunk]] = None
_docs_dir: Optional[str] = None


def get_corpus(docs_dir: str) -> list[Chunk]:
    """Lazy-load and cache the full document corpus."""
    global _corpus, _docs_dir
    if _corpus is None or _docs_dir != docs_dir:
        _corpus = load_all_documents(docs_dir)
        _docs_dir = docs_dir
    return _corpus


def get_loaded_doc_ids(docs_dir: str) -> list[str]:
    """Return which doc IDs were successfully loaded (have at least one chunk)."""
    corpus = get_corpus(docs_dir)
    return list({c.doc_id for c in corpus})
