# Enterprise AI Knowledge Assistant

Production-style full-stack RAG application with:
- FastAPI backend + MongoDB metadata storage
- FAISS vector store for embeddings only
- Hybrid retrieval (FAISS semantic + BM25 keyword + cross-encoder rerank)
- JWT auth + role-based access control
- React (Vite) frontend with role dashboards and ChatGPT-like UX
- Local/offline LLM mode (Ollama) and online API mode (Gemini/OpenAI)
- Analytics with time-window filters, trend chart, and CSV export
- Chat history persistence and retrieval
- Request logging middleware and global error handling
- In-memory rate limiting for sensitive endpoints
- Admin audit logging for critical actions

## Project Structure

- `backend/`
  - `app.py` - FastAPI app and endpoints
  - `auth.py` - JWT + password hashing + role guards
  - `database.py` - MongoDB collections and serializers
  - `logging_config.py` - request logging middleware and logger setup
  - `models.py` - Pydantic schemas
  - `rag_engine.py` - ingest, chunking, hybrid retrieval, generation
  - `Dockerfile` - backend container image
  - `uploads/` - PDF files
  - `vector_store/` - FAISS index and chunk id mapping
- `frontend/`
  - `src/pages/` - `LoginPage`, `AdminPage`, `PMChatPage`, `SDChatPage`, `JDChatPage`
  - `src/components/` - `Sidebar`, `ChatBox`, `ProtectedRoute`
  - `src/services/api.js` - all backend API calls
  - `Dockerfile` - frontend container image
- `docker-compose.yml` - full stack local orchestration

## Backend Setup

1. Create virtual environment and install dependencies:
   - `cd backend`
   - `python -m venv .venv`
   - Windows PowerShell: `.venv\Scripts\Activate.ps1`
   - `pip install -r requirements.txt`
2. Create `.env` from `.env.example` and configure keys/models.
3. Start API server:
   - `uvicorn app:app --reload --port 8000`

## Frontend Setup

1. Install dependencies:
   - `cd frontend`
   - `npm install`
2. Create `.env` from `.env.example` if needed.
3. Start UI:
   - `npm run dev`

## Docker Setup

1. Create `backend/.env` from `backend/.env.example`
2. Start full stack:
   - `docker compose up --build`
3. Access:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:8000`
   - MongoDB: `mongodb://localhost:27017`

## Default Admin Account

Created on backend startup if missing:
- Username: value of `ADMIN_USERNAME` (default `admin`)
- Password: value of `ADMIN_PASSWORD` (default `admin123`)

## Implemented API Endpoints

- `POST /login`
- `POST /upload`
- `GET /documents`
- `DELETE /documents/{id}`
- `POST /ask`
- `POST /rebuild-index`
- `GET /users`
- `POST /users`
- `PUT /users/{id}`
- `DELETE /users/{id}`
- `GET /chat-history`
- `DELETE /chat-history`
- `GET /analytics`
- `GET /analytics/export`
- `GET /audit-logs`
- `GET /ready`

## Notes

- MongoDB stores metadata only (`users`, `documents`, `chunks`, `chat_history`).
- FAISS stores embeddings and index mapping only.
- Offline mode works with local Ollama without internet.
- Online mode uses Gemini or OpenAI based on environment config.
- Chat history in frontend is hydrated from backend at startup.
- API request logs include latency and request id response header.
- Readiness endpoint verifies MongoDB ping and RAG initialization.
- Sensitive endpoints are rate-limited (`/login`, `/ask`, `/upload`) using user token subject when available, otherwise IP.
- Audit logs capture key admin/system actions and are viewable in the admin dashboard.

## Testing

- Backend unit tests:
  - `cd backend`
  - `pytest`

## Extra Backend Environment Options

- `CORS_ORIGINS` (comma-separated allowed origins)
- `SKIP_RAG_INIT` (`true/false`, useful for API-only diagnostics)
- `TESTING_MODE` (`true/false`, skips startup integrations in tests)
- `RATE_LIMIT_WINDOW_SECONDS`
- `RATE_LIMIT_MAX_REQUESTS`
