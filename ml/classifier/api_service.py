import os
import sys
import secrets
from pathlib import Path
from fastapi import FastAPI, HTTPException, Security, status
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field

# Ensure root directory is on sys.path for serverless execution
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from hybrid_classifier_v2 import categorize_v2

app = FastAPI(
    title="WealthIQ Indian Transaction Classifier v2",
    description="Categorizes Indian financial transactions using contextual rules and calibrated LinearSVC with service-to-service authentication.",
    version="2.0.0",
)

API_KEY_HEADER_NAME = "x-api-key"
api_key_header = APIKeyHeader(name=API_KEY_HEADER_NAME, auto_error=False)


def verify_api_key(api_key: str = Security(api_key_header)):
    """
    Enforces server-to-server authentication using the CLASSIFIER_API_SECRET environment variable.
    Constant-time comparison is used to mitigate timing side-channel attacks.
    """
    expected_secret = os.environ.get("CLASSIFIER_API_SECRET")

    # If the server has no secret configured, fail securely rather than allowing open access
    if not expected_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication configuration error: CLASSIFIER_API_SECRET is not configured.",
        )

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required authentication credential (x-api-key header required).",
        )

    if not secrets.compare_digest(api_key, expected_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credential.",
        )

    return api_key


class TransactionRequest(BaseModel):
    description: str = Field(
        min_length=1,
        max_length=500,
        description="The transaction description to categorize",
    )


@app.get("/")
def home():
    return {
        "message": "WealthIQ Indian Transaction Classifier API v2",
        "status": "running",
        "version": "2.0.0",
        "model": "indian_transaction_classifier_v2",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "version": "v2",
        "model": "indian_transaction_classifier_v2",
    }


@app.post("/predict")
def predict_transaction(
    request: TransactionRequest,
    _auth: str = Security(verify_api_key),
):
    description = request.description.strip()

    if not description:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Transaction description cannot be empty or pure whitespace.",
        )

    # Privacy preservation: Never print or log raw financial transaction descriptions
    result = categorize_v2(description)

    return {
        "description": result["description"],
        "category": result["category"],
        "method": result["method"],
        "confidence": result.get("confidence"),
        "needs_review": result.get("needs_review", False),
    }
