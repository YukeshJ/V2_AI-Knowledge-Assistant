import csv
import io
from datetime import datetime, timedelta, timezone
from pathlib import Path
from bson import ObjectId
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import http_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError
from auth import (
    create_access_token,
    decode_token,
    get_current_user,
    hash_password,
    require_roles,
    verify_password,
)
from config import UPLOAD_DIR, settings
from database import (
    documents_col,
    init_indexes,
    object_id,
    audit_logs_col,
    serialize_audit_log,
    serialize_chat_history,
    serialize_document,
    serialize_user,
    users_col,
    chat_history_col,
    cached_answers_col,
)
from logging_config import get_logger, request_logging_middleware, setup_logging
from models import (
    AskRequest,
    AskResponse,
    AuditLogOut,
    ChatHistoryOut,
    LoginRequest,
    ROLES,
    TokenResponse,
    UserCreate,
    UserUpdate,
    DocumentUpdate
)
from rate_limiter import InMemoryRateLimiter


app = FastAPI(title="Enterprise AI Knowledge Assistant")
setup_logging()
logger = get_logger("app")
# Rate limiter moved below CORS for correct preflight handling
rate_limiter = InMemoryRateLimiter(
    window_seconds=settings.rate_limit_window_seconds,
    max_requests=settings.rate_limit_max_requests,
)


rag_engine = None

def normalize_question(q: str) -> str:
    q = q.lower().strip()
    q = q.replace("?", "").replace(".", "").replace(",", "")
    q = " ".join(q.split())
    return q


def record_audit(actor: dict, action: str, target_type: str = "", target_id: str = "", details: dict | None = None):
    audit_logs_col.insert_one(
        {
            "actor_username": actor.get("username", "system"),
            "actor_role": actor.get("role", "system"),
            "action": action,
            "target_type": target_type or None,
            "target_id": target_id or None,
            "details": details or {},
            "created_at": datetime.now(timezone.utc),
        }
    )


@app.on_event("startup")
def on_startup():
    global rag_engine
    if settings.testing_mode:
        logger.info("Testing mode enabled, skipping startup integrations.")
        return
    init_indexes()
    if rag_engine is None and not settings.skip_rag_init:
        from rag_engine import RAGEngine
        rag_engine = RAGEngine()
        logger.info("RAG engine initialized")
    logger.info("Application startup complete, indexes ensured.")
    if not users_col.find_one({"username": settings.admin_username}):
        users_col.insert_one(
            {
                "username": settings.admin_username,
                "password_hash": hash_password(settings.admin_password),
                "role": "admin",
                "created_at": datetime.now(timezone.utc),
                "last_seen": datetime.now(timezone.utc),
            }
        )
        logger.info("Bootstrap admin account created: %s", settings.admin_username)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request, exc):
    return JSONResponse(status_code=422, content={"detail": exc.errors(), "message": "Validation failed"})


@app.exception_handler(ValidationError)
async def handle_pydantic_validation_error(request, exc):
    return JSONResponse(status_code=422, content={"detail": exc.errors(), "message": "Validation failed"})


@app.exception_handler(HTTPException)
async def handle_http_error(request, exc):
    return await http_exception_handler(request, exc)


@app.exception_handler(Exception)
async def handle_unexpected_error(request, exc):
    logger.exception("Unhandled server error")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.middleware("http")
async def apply_rate_limit(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
        
    limited_paths = {"/login", "/ask", "/upload"}
    if request.url.path in limited_paths:
        client_ip = request.client.host if request.client else "unknown"
        auth_header = request.headers.get("Authorization", "")
        user_key = ""
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            try:
                payload = decode_token(token)
                user_key = payload.get("sub", "")
            except HTTPException:
                user_key = ""
        subject = user_key or f"ip:{client_ip}"
        key = f"{subject}:{request.url.path}"
        if not rate_limiter.allow(key):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests, please retry shortly."},
            )
    return await call_next(request)

# Outermost middlewares (added last)
app.middleware("http")(request_logging_middleware)

allowed_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




@app.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    user = users_col.find_one({"username": payload.username})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    users_col.update_one({"username": payload.username}, {"$set": {"last_seen": datetime.now(timezone.utc)}})
    record_audit(actor={"username": user["username"], "role": user["role"]}, action="login", target_type="user")
    
    token = create_access_token(user["username"], user["role"])
    return {
        "access_token": token,
        "role": user["role"],
        "username": user["username"],
    }

@app.post("/users/active")
def update_active_status(user=Depends(get_current_user)):
    users_col.update_one({"username": user["username"]}, {"$set": {"last_seen": datetime.now(timezone.utc)}})
    return {"status": "ok"}


@app.get("/users")
def list_users(user=Depends(require_roles(["admin", "Project Manager"]))):

    docs = users_col.find({}, {"password_hash": 0}).sort("created_at", -1)
    return [serialize_user(doc) for doc in docs]


@app.get("/audit-logs", response_model=list[AuditLogOut])
def list_audit_logs(limit: int = Query(100, ge=1, le=500), user=Depends(require_roles(["admin", "Project Manager"]))):

    docs = audit_logs_col.find({}).sort("created_at", -1).limit(limit)
    return [serialize_audit_log(doc) for doc in docs]


@app.get("/chat-history", response_model=list[ChatHistoryOut])
def list_chat_history(
    limit: int = Query(50, ge=1, le=500),
    username: str = Query(default=""),
    user=Depends(get_current_user),
):
    query = {}
    if user["role"] != "admin":
        query["username"] = user["username"]
    elif username:
        query["username"] = username
    docs = chat_history_col.find(query).sort("created_at", -1).limit(limit)
    return [serialize_chat_history(doc) for doc in docs]


@app.delete("/chat-history")
def clear_chat_history(user=Depends(get_current_user)):
    if user["role"] == "admin":
        result = chat_history_col.delete_many({})
    else:
        result = chat_history_col.delete_many({"username": user["username"]})
    record_audit(
        actor=user,
        action="chat_history_cleared",
        target_type="chat_history",
        details={"deleted_count": result.deleted_count},
    )
    return {"message": "Chat history cleared", "deleted_count": result.deleted_count}

@app.delete("/chat-history/{history_id}")
def delete_chat_history_item(history_id: str, user=Depends(require_roles(["admin"]))):
    doc = chat_history_col.find_one({"_id": object_id(history_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    
    chat_history_col.delete_one({"_id": object_id(history_id)})
    record_audit(
        actor=user,
        action="chat_history_item_deleted",
        target_type="chat_history",
        target_id=history_id,
        details={"question": doc.get("question")}
    )
    return {"message": "Deleted"}


@app.post("/users")
def create_user(payload: UserCreate, user=Depends(require_roles(["admin", "Project Manager"]))):

    if users_col.find_one({"username": payload.username}):
        raise HTTPException(status_code=409, detail="Username already exists")
    created = users_col.insert_one(
        {
            "username": payload.username,
            "password_hash": hash_password(payload.password),
            "role": payload.role,
            "created_at": datetime.now(timezone.utc),
            "last_seen": datetime.now(timezone.utc),
        }
    )
    record_audit(
        actor=user,
        action="user_created",
        target_type="user",
        target_id=str(created.inserted_id),
        details={"username": payload.username, "role": payload.role},
    )
    return {"message": "User created"}


@app.put("/users/{user_id}")
def update_user(user_id: str, payload: UserUpdate, user=Depends(require_roles(["admin", "Project Manager"]))):

    updates = {}
    if payload.password:
        updates["password_hash"] = hash_password(payload.password)
    if payload.role:
        updates["role"] = payload.role
    if not updates:
        raise HTTPException(status_code=400, detail="No changes provided")
    users_col.update_one({"_id": object_id(user_id)}, {"$set": updates})
    record_audit(
        actor=user,
        action="user_updated",
        target_type="user",
        target_id=user_id,
        details={"fields": list(updates.keys())},
    )
    return {"message": "User updated"}


@app.delete("/users/{user_id}")
def delete_user(user_id: str, user=Depends(require_roles(["admin", "Project Manager"]))):

    users_col.delete_one({"_id": object_id(user_id)})
    record_audit(actor=user, action="user_deleted", target_type="user", target_id=user_id)
    return {"message": "User deleted"}


@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    allowed_roles: str = Form(...),
    user=Depends(require_roles(["admin", "Project Manager"])),

):
    if rag_engine is None:
        raise HTTPException(status_code=503, detail="RAG engine not initialized")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    if documents_col.find_one({"filename": file.filename}):
        raise HTTPException(status_code=409, detail="Document with this filename already exists")

    roles = [r.strip() for r in allowed_roles.split(",") if r.strip()]
    if any(role not in ROLES for role in roles):
        raise HTTPException(status_code=400, detail="One or more roles are invalid")

    saved_path = UPLOAD_DIR / file.filename
    content = await file.read()
    saved_path.write_bytes(content)

    doc_result = documents_col.insert_one(
        {
            "filename": file.filename,
            "uploader": user["username"],
            "allowed_roles": roles,
            "uploaded_at": datetime.now(timezone.utc),
            "file_path": str(saved_path),
        }
    )

    rag_engine.ingest_document(str(doc_result.inserted_id), saved_path)
    record_audit(
        actor=user,
        action="document_uploaded",
        target_type="document",
        target_id=str(doc_result.inserted_id),
        details={"filename": file.filename, "allowed_roles": roles},
    )
    return {"message": "Document uploaded and indexed", "id": str(doc_result.inserted_id)}


@app.get("/documents")
def list_documents(user=Depends(get_current_user)):
    if user["role"] in ["admin", "Project Manager"]:
        query = {}
    else:
        query = {"allowed_roles": user["role"]}

    docs = documents_col.find(query).sort("uploaded_at", -1)
    return [serialize_document(doc) for doc in docs]

@app.get("/documents/{document_id}/content")
def get_document_content(document_id: str, user=Depends(get_current_user)):
    doc = documents_col.find_one({"_id": object_id(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if user["role"] not in ["admin", "Project Manager"] and user["role"] not in doc.get("allowed_roles", []):
        raise HTTPException(status_code=403, detail="Access denied")

        
    from config import UPLOAD_DIR
    file_path = UPLOAD_DIR / doc["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    def file_iterator():
        with open(file_path, "rb") as f:
            while chunk := f.read(8192):
                yield chunk
                
    return StreamingResponse(
        file_iterator(), 
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{doc["filename"]}"'
        }
    )

@app.put("/documents/{document_id}")
def update_document_roles(document_id: str, payload: DocumentUpdate, user=Depends(require_roles(["admin", "Project Manager"]))):

    result = documents_col.update_one(
        {"_id": object_id(document_id)}, 
        {"$set": {"allowed_roles": payload.allowed_roles}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
        
    record_audit(
        actor=user,
        action="document_role_updated",
        target_type="document",
        target_id=document_id,
        details={"allowed_roles": payload.allowed_roles}
    )
    return {"message": "Document updated"}


@app.delete("/documents/{document_id}")
def delete_document(document_id: str, user=Depends(require_roles(["admin", "Project Manager"]))):

    doc = documents_col.find_one({"_id": object_id(document_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    documents_col.delete_one({"_id": ObjectId(document_id)})
    rag_engine.remove_document_chunks(document_id)
    try:
        Path(doc["file_path"]).unlink(missing_ok=True)
    except OSError:
        pass
    
    # Invalidate cache for this document
    cached_answers_col.delete_many({"document_id": document_id})
    record_audit(
        actor=user,
        action="document_deleted",
        target_type="document",
        target_id=document_id,
        details={"filename": doc.get("filename")},
    )
    return {"message": "Document deleted"}


@app.post("/rebuild-index")
def rebuild_index(user=Depends(require_roles(["admin", "Project Manager"]))):

    if rag_engine is None:
        raise HTTPException(status_code=503, detail="RAG engine not initialized")
    rag_engine.rebuild_index()
    
    # Clear all cache when index is completely rebuilt
    cached_answers_col.delete_many({})
    
    record_audit(actor=user, action="index_rebuilt", target_type="vector_store")
    return {"message": "FAISS index rebuilt"}


@app.post("/ask", response_model=AskResponse)
def ask_question(payload: AskRequest, user=Depends(get_current_user)):
    top_k = payload.top_k or settings.default_top_k
    if rag_engine is None:
        raise HTTPException(status_code=503, detail="RAG engine not initialized")

    record_audit(actor=user, action="ask_question", target_type="document", target_id=payload.document_id, details={"question": payload.question})

    normalized_q = normalize_question(payload.question)
    
    # Check cache based on strict conditions
    cached_doc = cached_answers_col.find_one({
        "normalized_question": normalized_q,
        "document_id": payload.document_id,
        "role": user["role"],
        "mode": payload.mode
    })

    if cached_doc:
        cached_answers_col.update_one(
            {"_id": cached_doc["_id"]},
            {
                "$inc": {"hit_count": 1},
                "$set": {"last_used_at": datetime.now(timezone.utc)}
            }
        )
        result = {
            "answer": cached_doc["answer"],
            "sources": cached_doc.get("sources", []),
            "cached": True
        }
    else:
        try:
            # Fetch recent history for conversation context (Chat Memory feature)
            recent_cursor = chat_history_col.find({"username": user["username"]}).sort("created_at", -1).limit(4)
            recent_history = list(recent_cursor)
            recent_history.reverse()

            result = rag_engine.answer(
                question=payload.question,
                role=user["role"],
                mode=payload.mode,
                document_id=payload.document_id,
                top_k=top_k,
                history=recent_history,
            )
            result["cached"] = False
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to generate answer: {str(exc)}") from exc

        
        # Store in cache
        cached_answers_col.insert_one({
            "question": payload.question,
            "normalized_question": normalized_q,
            "document_id": payload.document_id,
            "role": user["role"],
            "mode": payload.mode,
            "answer": result["answer"],
            "sources": result.get("sources", []),
            "created_at": datetime.now(timezone.utc),
            "last_used_at": datetime.now(timezone.utc),
            "hit_count": 1
        })

    chat_history_col.insert_one(
        {
            "username": user["username"],
            "role": user["role"],
            "question": payload.question,
            "answer": result["answer"],
            "mode": payload.mode,
            "document_id": payload.document_id,
            "created_at": datetime.now(timezone.utc),
        }
    )
    return result


@app.get("/analytics")
def analytics(days: int = Query(7, ge=1, le=365), user=Depends(require_roles(["admin", "Project Manager"]))):

    start_time = datetime.now(timezone.utc) - timedelta(days=days)
    base_filter = {"created_at": {"$gte": start_time}}
    total_queries = chat_history_col.count_documents(base_filter)
    
    top_queries_cursor = chat_history_col.aggregate(
        [
            {"$match": base_filter},
            {"$group": {"_id": "$role", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10},
        ]
    )
    trend_cursor = chat_history_col.aggregate(
        [
            {"$match": base_filter},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id": 1}},
        ]
    )
    top_queries = [{"role": row["_id"], "count": row["count"]} for row in top_queries_cursor]
    trend = [{"date": row["_id"], "count": row["count"]} for row in trend_cursor]
    active_time = datetime.now(timezone.utc) - timedelta(minutes=1)
    active_users = users_col.count_documents({"last_seen": {"$gte": active_time}})

    return {
        "window_days": days,
        "total_queries": total_queries,
        "top_queries": top_queries,
        "trend": trend,
        "active_users": active_users,
    }


@app.get("/analytics/active-users")
def get_active_users(user=Depends(require_roles(["admin", "Project Manager"]))):

    active_time = datetime.now(timezone.utc) - timedelta(minutes=1)
    active_users = users_col.count_documents({"last_seen": {"$gte": active_time}})
    return {"active_users": active_users}


@app.get("/analytics/export")
def export_analytics(days: int = Query(7, ge=1, le=365), user=Depends(require_roles(["admin", "Project Manager"]))):

    start_time = datetime.now(timezone.utc) - timedelta(days=days)
    base_filter = {"created_at": {"$gte": start_time}}
    top_queries_cursor = chat_history_col.aggregate(
        [
            {"$match": base_filter},
            {"$group": {"_id": "$question", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 100},
        ]
    )
    trend_cursor = chat_history_col.aggregate(
        [
            {"$match": base_filter},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                    },
                    "count": {"$sum": 1},
                }
            },
            {"$sort": {"_id": 1}},
        ]
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["window_days", days])
    writer.writerow(["generated_utc", datetime.now(timezone.utc).isoformat()])
    writer.writerow([])
    writer.writerow(["top_queries"])
    writer.writerow(["question", "count"])
    for row in top_queries_cursor:
        writer.writerow([row["_id"], row["count"]])

    writer.writerow([])
    writer.writerow(["trend"])
    writer.writerow(["date", "count"])
    for row in trend_cursor:
        writer.writerow([row["_id"], row["count"]])

    output.seek(0)
    filename = f"analytics_{days}d_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(output, media_type="text/csv", headers=headers)


@app.get("/health")
def health():
    return JSONResponse({"status": "ok"})


@app.get("/ready")
def ready():
    if settings.testing_mode:
        return JSONResponse(
            {"status": "not_ready", "mongodb": False, "rag_engine": rag_engine is not None},
            status_code=503,
        )
    db_ok = True
    try:
        users_col.database.client.admin.command("ping")
    except Exception:
        db_ok = False
    ready_state = db_ok and rag_engine is not None
    return JSONResponse(
        {"status": "ready" if ready_state else "not_ready", "mongodb": db_ok, "rag_engine": rag_engine is not None},
        status_code=200 if ready_state else 503,
    )
