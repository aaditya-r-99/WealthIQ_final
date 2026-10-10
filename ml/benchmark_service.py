#!/usr/bin/env python3
"""
WealthIQ — Phase 17: Household Consumption Spending Benchmark API Service
FastAPI microservice exposing HCES 2023-24 ML regression benchmark inference on port 8002.
"""

import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

# Import prediction engine
from predict_benchmark import (
    predict_household_benchmark,
    get_metadata,
    get_benchmarks,
    STATE_NAMES,
)

app = FastAPI(
    title="WealthIQ Household Spending Benchmark Service",
    description="Inference service for MoSPI HCES 2023-24 Household Spending Benchmark regression model.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BenchmarkInferenceRequest(BaseModel):
    state: str = Field(..., description="Two-digit NSSO state code ('01'-'37')")
    sector: str = Field(..., description="'rural' or 'urban'")
    highest_education: str = Field(..., description="'below_primary', 'primary_middle', 'secondary_higher', 'graduate_above'")
    livelihood: str = Field(..., description="'regular_wage', 'self_employed', 'casual_labour', 'other'")
    dwelling_type: str = Field(..., description="'pucca', 'semi_pucca', 'katcha'")
    cooking_fuel: str = Field(..., description="'lpg', 'png_electric', 'firewood', 'other'")
    land_owned: str = Field(..., description="'owned' or 'not_owned'")
    hh_size: int = Field(..., ge=1, le=25, description="Household size (1-25)")
    num_adults: Optional[int] = Field(None, ge=1, le=25, description="Number of adults in household")
    num_children: Optional[int] = Field(None, ge=0, le=25, description="Number of children in household")

@app.get("/")
def home():
    return {
        "service": "WealthIQ Household Spending Benchmark API",
        "status": "online",
        "version": "1.0.0",
        "model": "hces_spending_benchmark_v1",
        "dataset": "MoSPI HCES 2023-24",
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "states_count": len(STATE_NAMES),
        "benchmarks_count": len(get_benchmarks()),
    }

@app.get("/metadata")
def metadata():
    return {
        "states": STATE_NAMES,
        "metadata": get_metadata(),
    }

@app.post("/predict")
def predict(request: BenchmarkInferenceRequest):
    try:
        req_dict = request.model_dump()
        result = predict_household_benchmark(req_dict)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("benchmark_service:app", host="127.0.0.1", port=8002, reload=False)
