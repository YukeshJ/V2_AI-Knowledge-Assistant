from datetime import datetime, timezone
from bson import ObjectId
from pymongo import MongoClient, ASCENDING
from config import settings


client = MongoClient(settings.mongodb_uri)
db = client[settings.mongodb_db]

users_col = db["users"]
documents_col = db["documents"]
chunks_col = db["chunk"]
chat_history_col = db["chat_history"]
audit_logs_col = db["audit_logs"]
cached_answers_col = db["cached_answers"]

def init_indexes():
    users_col.create_index([("username", ASCENDING)], unique=True)
    documents_col.create_index([("uploaded_at", ASCENDING)])
    chunks_col.create_index([("document_id", ASCENDING)])
    chat_history_col.create_index([("username", ASCENDING), ("created_at", ASCENDING)])
    audit_logs_col.create_index([("created_at", ASCENDING)])
    audit_logs_col.create_index([("actor_username", ASCENDING), ("created_at", ASCENDING)])
    cached_answers_col.create_index([("normalized_question", ASCENDING), ("document_id", ASCENDING), ("role", ASCENDING), ("mode", ASCENDING)])


def object_id(value: str) -> ObjectId:
    return ObjectId(value)


def serialize_user(doc):
    return {
        "id": str(doc["_id"]),
        "username": doc["username"],
        "role": doc["role"],
        "created_at": doc.get("created_at", datetime.now(timezone.utc)),
    }


def serialize_document(doc):
    return {
        "id": str(doc["_id"]),
        "filename": doc["filename"],
        "uploader": doc["uploader"],
        "allowed_roles": doc["allowed_roles"],
        "uploaded_at": doc["uploaded_at"],
    }


def serialize_chat_history(doc):
    return {
        "id": str(doc["_id"]),
        "username": doc["username"],
        "role": doc["role"],
        "question": doc["question"],
        "answer": doc["answer"],
        "mode": doc["mode"],
        "document_id": doc.get("document_id"),
        "created_at": doc["created_at"],
    }


def serialize_audit_log(doc):
    return {
        "id": str(doc["_id"]),
        "actor_username": doc["actor_username"],
        "actor_role": doc["actor_role"],
        "action": doc["action"],
        "target_type": doc.get("target_type"),
        "target_id": doc.get("target_id"),
        "details": doc.get("details", {}),
        "created_at": doc["created_at"],
    }

