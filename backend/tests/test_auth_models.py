import pytest
from auth import create_access_token, decode_token, hash_password, verify_password
from models import AskRequest, UserCreate, UserUpdate


def test_password_hash_and_verify_roundtrip():
    plain = "securePass123"
    hashed = hash_password(plain)
    assert hashed != plain
    assert verify_password(plain, hashed)
    assert not verify_password("wrongPass", hashed)


def test_access_token_contains_username_and_role():
    token = create_access_token("alice", "admin")
    payload = decode_token(token)
    assert payload["sub"] == "alice"
    assert payload["role"] == "admin"


def test_user_create_rejects_invalid_role():
    with pytest.raises(ValueError):
        UserCreate(username="john", password="abc12345", role="invalid-role")


def test_user_update_allows_empty_and_validates_role():
    user = UserUpdate()
    assert user.password is None
    assert user.role is None

    with pytest.raises(ValueError):
        UserUpdate(role="not-a-role")


def test_ask_request_mode_is_restricted():
    valid = AskRequest(question="How does deployment work?", mode="local", top_k=3)
    assert valid.mode == "local"

    with pytest.raises(ValueError):
        AskRequest(question="test question", mode="hybrid")
