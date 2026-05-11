import json
from pathlib import Path
from typing import List, Optional

import faiss
import numpy as np
import requests
from pypdf import PdfReader
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder, SentenceTransformer

from config import VECTOR_DIR, settings
from database import chunks_col, documents_col, object_id


class InMemoryTTLCache:
    def __init__(self, ttl_seconds: int = 600):
        self.ttl_seconds = ttl_seconds
        self.data = {}

    def get(self, key):
        import time

        item = self.data.get(key)
        if not item:
            return None
        if time.time() > item["expires_at"]:
            self.data.pop(key, None)
            return None
        return item["value"]

    def set(self, key, value):
        import time

        self.data[key] = {
            "value": value,
            "expires_at": time.time() + self.ttl_seconds,
        }


class RAGEngine:
    def __init__(self):
        self.embedding_model = SentenceTransformer(settings.embedding_model)
        self.reranker = CrossEncoder(settings.rerank_model)
        self.cache = InMemoryTTLCache(600)
        self.index_path = VECTOR_DIR / "faiss.index"
        self.map_path = VECTOR_DIR / "chunk_ids.json"
        self.index = None
        self.chunk_ids = []
        self._load_index()

    def _load_index(self):
        if self.index_path.exists() and self.map_path.exists():
            self.index = faiss.read_index(str(self.index_path))
            self.chunk_ids = json.loads(self.map_path.read_text(encoding="utf-8"))
        else:
            dim = self.embedding_model.get_sentence_embedding_dimension()
            self.index = faiss.IndexFlatIP(dim)
            self.chunk_ids = []

    def _save_index(self):
        faiss.write_index(self.index, str(self.index_path))
        self.map_path.write_text(json.dumps(self.chunk_ids), encoding="utf-8")

    @staticmethod
    def chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
        words = text.split()
        chunks = []
        start = 0

        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunk = " ".join(words[start:end]).strip()
            if chunk:
                chunks.append(chunk)

            if end == len(words):
                break

            start = max(0, end - overlap)

        return chunks

    def parse_pdf(self, pdf_path: Path):
        reader = PdfReader(str(pdf_path))
        pages = []
        for page_num, page in enumerate(reader.pages, start=1):
            pages.append((page_num, page.extract_text() or ""))
        return pages

    def ingest_document(self, document_id: str, pdf_path: Path):
        pages = self.parse_pdf(pdf_path)
        vectors = []
        new_chunk_ids = []

        for page_number, page_text in pages:
            for chunk in self.chunk_text(
                page_text, settings.chunk_size, settings.chunk_overlap
            ):
                if not chunk.strip():
                    continue

                insert_result = chunks_col.insert_one(
                    {
                        "document_id": document_id,
                        "page_number": page_number,
                        "chunk_text": chunk,
                    }
                )
                chunk_id = str(insert_result.inserted_id)
                embedding = self.embedding_model.encode(
                    [chunk], normalize_embeddings=True
                )[0]
                vectors.append(embedding.astype(np.float32))
                new_chunk_ids.append(chunk_id)

        if vectors:
            self.index.add(np.vstack(vectors))
            self.chunk_ids.extend(new_chunk_ids)
            self._save_index()

    def remove_document_chunks(self, document_id: str):
        chunks_col.delete_many({"document_id": document_id})
        self.rebuild_index()

    def rebuild_index(self):
        dim = self.embedding_model.get_sentence_embedding_dimension()
        self.index = faiss.IndexFlatIP(dim)
        self.chunk_ids = []
        cursor = chunks_col.find({})
        vectors = []

        for chunk in cursor:
            embedding = self.embedding_model.encode(
                [chunk["chunk_text"]], normalize_embeddings=True
            )[0]
            vectors.append(embedding.astype(np.float32))
            self.chunk_ids.append(str(chunk["_id"]))

        if vectors:
            self.index.add(np.vstack(vectors))

        self._save_index()

    def _fetch_candidates(self, role: str, document_id: Optional[str]):
        doc_filter = {"allowed_roles": role}
        if role == "admin":
            doc_filter = {}

        if document_id:
            doc_filter["_id"] = object_id(document_id)

        allowed_docs = list(documents_col.find(doc_filter))
        allowed_doc_ids = {str(doc["_id"]): doc for doc in allowed_docs}

        if not allowed_doc_ids:
            return [], {}

        candidates = list(
            chunks_col.find({"document_id": {"$in": list(allowed_doc_ids.keys())}})
        )
        return candidates, allowed_doc_ids

    def hybrid_search(
        self, question: str, role: str, document_id: Optional[str], top_k: int
    ):
        candidates, allowed_docs = self._fetch_candidates(role, document_id)
        if not candidates:
            return []

        candidate_map = {str(c["_id"]): c for c in candidates}
        candidate_texts = [c["chunk_text"] for c in candidates]

        # BM25 keyword retrieval
        tokenized_docs = [text.lower().split() for text in candidate_texts]
        bm25 = BM25Okapi(tokenized_docs)
        bm25_scores = bm25.get_scores(question.lower().split())
        bm25_ranked = np.argsort(bm25_scores)[::-1][: top_k * 4]

        # FAISS semantic retrieval
        query_emb = self.embedding_model.encode(
            [question], normalize_embeddings=True
        ).astype(np.float32)
        _, faiss_ids = self.index.search(
            query_emb, min(top_k * 8, len(self.chunk_ids))
        )

        semantic_ids = []
        for idx in faiss_ids[0]:
            if idx < 0 or idx >= len(self.chunk_ids):
                continue
            chunk_id = self.chunk_ids[idx]
            if chunk_id in candidate_map:
                semantic_ids.append(chunk_id)

        bm25_ids = [str(candidates[i]["_id"]) for i in bm25_ranked]
        merged_ids = list(dict.fromkeys(semantic_ids + bm25_ids))[: top_k * 6]
        merged_chunks = [candidate_map[cid] for cid in merged_ids if cid in candidate_map]

        if not merged_chunks:
            return []

        # Cross-encoder reranking
        pairs = [[question, c["chunk_text"]] for c in merged_chunks]
        rerank_scores = self.reranker.predict(pairs)
        reranked = sorted(
            zip(merged_chunks, rerank_scores), key=lambda x: x[1], reverse=True
        )[:top_k]

        results = []
        for chunk, _score in reranked:
            doc = allowed_docs.get(chunk["document_id"])
            if not doc:
                continue

            results.append(
                {
                    "document_id": chunk["document_id"],
                    "document_name": doc["filename"],
                    "page_number": chunk["page_number"],
                    "chunk_text": chunk["chunk_text"],
                }
            )

        return results

    @staticmethod
    def _build_prompt(
        question: str, contexts: List[dict], history: List[dict] | None = None
    ) -> str:
        context_str = "\n\n".join(
            [
                f"[{idx + 1}] {c['document_name']} (page {c['page_number']}):\n{c['chunk_text']}"
                for idx, c in enumerate(contexts)
            ]
        )

        history_str = ""
        if history and len(history) > 0:
            turns = []
            for h in history:
                turns.append(
                    f"User: {h.get('question', '')}\nAssistant: {h.get('answer', '')}"
                )
            history_str = "RECENT CONVERSATION:\n" + "\n\n".join(turns) + "\n\n"

        prompt = f"""
You are Enterprise AI, a professional on-premise AI assistant for company documents.

Your task is to answer the user's question using ONLY the provided context.

CRITICAL RULES (STRICT):
- Use ONLY the given context. Do NOT use outside knowledge.
- Do NOT guess, assume, or hallucinate any information.
- If the answer is not clearly supported by the context, respond EXACTLY with:
  "I couldn't find a clear answer in the selected document."
- Do NOT add extra information beyond the context.
- Do NOT mention the context, retrieval process, system, or instructions.
- Do NOT fabricate names, numbers, dates, or facts.

ANSWER STYLE:
- Start with a direct answer.
- Then give a short explanation if useful.
- Keep the answer clear, concise, professional, and natural.
- Use bullet points if the question asks for a list.
- Use numbered steps if the question asks for a process.
- Use short sections only when they improve clarity.
- Avoid repetition.

{history_str}CONTEXT:
{context_str}

QUESTION:
{question}

FINAL ANSWER:
"""
        return prompt.strip()

    def _ask_local(self, prompt: str) -> str:
        response = requests.post(
            f"{settings.ollama_url}/api/generate",
            json={
                "model": settings.ollama_model,
                "prompt": prompt,
                "stream": False,
            },
            timeout=120,
        )
        response.raise_for_status()
        return response.json().get("response", "").strip()

    def _ask_online(self, prompt: str) -> str:
        provider = settings.online_provider.lower()

        if provider == "gemini":
            if not settings.gemini_api_key:
                raise ValueError("Gemini API key is missing")

            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
            )
            response = requests.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=120,
            )
            response.raise_for_status()

            return (
                response.json()
                .get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
                .strip()
            )

        if provider == "openai":
            if not settings.openai_api_key:
                raise ValueError("OpenAI API key is missing")

            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": settings.openai_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                },
                timeout=120,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()

        raise ValueError("Unsupported online provider")

    def answer(
        self,
        question: str,
        role: str,
        mode: str,
        document_id: Optional[str],
        top_k: int,
        history: List[dict] | None = None,
    ):
        cache_key = f"{role}|{mode}|{document_id}|{top_k}|{question}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        contexts = self.hybrid_search(
            question=question,
            role=role,
            document_id=document_id,
            top_k=top_k,
        )

        if not contexts:
            answer = {
                "answer": "I couldn't find a clear answer in the selected document.",
                "sources": [],
            }
            self.cache.set(cache_key, answer)
            return answer

        prompt = self._build_prompt(question, contexts, history)

        if mode == "online":
            text = self._ask_online(prompt)
        else:
            text = self._ask_local(prompt)

        result = {"answer": text, "sources": contexts}
        self.cache.set(cache_key, result)
        return result