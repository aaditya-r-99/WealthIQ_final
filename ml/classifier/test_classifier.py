"""
Automated Test Suite for WealthIQ Transaction Classifier v2 Service Package
Uses standard library urllib.request to test real HTTP requests against a live FastAPI instance.
Zero external test dependencies required.
"""

import os
import sys
import time
import json
import urllib.request
import urllib.error
import threading
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

TEST_PORT = 8019
TEST_HOST = "127.0.0.1"
TEST_SECRET = "test_classifier_secret_key_12345"
BASE_URL = f"http://{TEST_HOST}:{TEST_PORT}"

# Configure test environment
os.environ["CLASSIFIER_API_SECRET"] = TEST_SECRET

import uvicorn
from api.index import app

server_thread = None
server = None


def run_server():
    config = uvicorn.Config(app, host=TEST_HOST, port=TEST_PORT, log_level="warning")
    global server
    server = uvicorn.Server(config)
    server.run()


def make_request(path, method="GET", data=None, headers=None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)

    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = {"raw": err_body}
        return e.code, parsed


def test_health_check_unauthenticated():
    """Health check must be open for monitoring and not leak credentials."""
    status, data = make_request("/health")
    assert status == 200, f"Expected 200, got {status}"
    assert data["status"] == "healthy"
    assert data["version"] == "v2"
    assert data["model"] == "indian_transaction_classifier_v2"
    assert "secret" not in str(data)
    assert "key" not in str(data)


def test_predict_missing_api_key():
    """Predict route must reject requests without x-api-key header with 401."""
    status, data = make_request("/predict", method="POST", data={"description": "Swiggy food order"})
    assert status == 401, f"Expected 401, got {status}"
    assert "Missing required authentication credential" in data.get("detail", "")


def test_predict_invalid_api_key():
    """Predict route must reject requests with wrong x-api-key header with 401."""
    status, data = make_request(
        "/predict",
        method="POST",
        data={"description": "Swiggy food order"},
        headers={"x-api-key": "wrong_secret_key"},
    )
    assert status == 401, f"Expected 401, got {status}"
    assert "Invalid authentication credential" in data.get("detail", "")


def test_predict_valid_api_key():
    """Predict route must succeed with valid x-api-key and return proper schema."""
    status, data = make_request(
        "/predict",
        method="POST",
        data={"description": "Swiggy dinner order"},
        headers={"x-api-key": TEST_SECRET},
    )
    assert status == 200, f"Expected 200, got {status}"
    assert data["category"] == "Food & Dining"
    assert data["method"] == "rule"
    assert "confidence" in data
    assert "needs_review" in data
    assert data["needs_review"] is False


def test_predict_ml_inference():
    """Tests ML inference for transportation / fastag."""
    status, data = make_request(
        "/predict",
        method="POST",
        data={"description": "FASTag ICICI toll debit NH44"},
        headers={"x-api-key": TEST_SECRET},
    )
    assert status == 200, f"Expected 200, got {status}"
    assert data["category"] == "Transportation"


def test_predict_empty_description():
    """Empty description must be rejected with 422 validation error."""
    status, data = make_request(
        "/predict",
        method="POST",
        data={"description": ""},
        headers={"x-api-key": TEST_SECRET},
    )
    assert status == 422, f"Expected 422, got {status}"


def test_predict_whitespace_only():
    """Whitespace-only description must be rejected with 422."""
    status, data = make_request(
        "/predict",
        method="POST",
        data={"description": "    "},
        headers={"x-api-key": TEST_SECRET},
    )
    assert status == 422, f"Expected 422, got {status}"


def test_predict_excessive_length():
    """Descriptions longer than 500 characters must be rejected with 422."""
    long_desc = "swiggy " * 100  # 700 chars
    status, data = make_request(
        "/predict",
        method="POST",
        data={"description": long_desc},
        headers={"x-api-key": TEST_SECRET},
    )
    assert status == 422, f"Expected 422, got {status}"


def main():
    print("Starting background test server on port", TEST_PORT)
    t = threading.Thread(target=run_server, daemon=True)
    t.start()
    time.sleep(1.5)  # Allow server to initialize

    print("Running WealthIQ Classifier Package Tests...")
    test_health_check_unauthenticated()
    print("  [PASS] test_health_check_unauthenticated")
    test_predict_missing_api_key()
    print("  [PASS] test_predict_missing_api_key")
    test_predict_invalid_api_key()
    print("  [PASS] test_predict_invalid_api_key")
    test_predict_valid_api_key()
    print("  [PASS] test_predict_valid_api_key")
    test_predict_ml_inference()
    print("  [PASS] test_predict_ml_inference")
    test_predict_empty_description()
    print("  [PASS] test_predict_empty_description")
    test_predict_whitespace_only()
    print("  [PASS] test_predict_whitespace_only")
    test_predict_excessive_length()
    print("  [PASS] test_predict_excessive_length")

    if server:
        server.should_exit = True
    print("\nAll 8 real HTTP integration tests passed successfully!")


if __name__ == "__main__":
    main()
