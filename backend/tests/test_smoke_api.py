import os

os.environ["TESTING_MODE"] = "true"
os.environ["SKIP_RAG_INIT"] = "true"

from fastapi.testclient import TestClient
from app import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ready_endpoint_in_test_mode():
    response = client.get("/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["status"] in ["ready", "not_ready"]
    assert "mongodb" in body
    assert "rag_engine" in body
