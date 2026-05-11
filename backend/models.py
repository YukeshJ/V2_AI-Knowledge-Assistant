from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator


ROLES = ["admin", "Project Manager", "Team Leader", "Senior Developer", "Junior Developer"]


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, value):
        if value not in ROLES:
            raise ValueError("Invalid role")
        return value


class UserUpdate(BaseModel):
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)
    role: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, value):
        if value is None:
            return value
        if value not in ROLES:
            raise ValueError("Invalid role")
        return value


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    created_at: datetime


class DocumentOut(BaseModel):
    id: str
    filename: str
    uploader: str
    allowed_roles: List[str]
    uploaded_at: datetime


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3)
    document_id: Optional[str] = None
    top_k: Optional[int] = Field(default=None, ge=1, le=20)
    mode: Literal["local", "online"] = "local"


class SourceOut(BaseModel):
    document_id: str
    document_name: str
    page_number: int
    chunk_text: str


class AskResponse(BaseModel):
    answer: str
    sources: List[SourceOut]
    cached: bool = False


class ChatHistoryOut(BaseModel):
    id: str
    username: str
    role: str
    question: str
    answer: str
    mode: str
    document_id: Optional[str] = None
    created_at: datetime


class AuditLogOut(BaseModel):
    id: str
    actor_username: str
    actor_role: str
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    details: dict = {}
    created_at: datetime


class DocumentUpdate(BaseModel):
    allowed_roles: List[str]

