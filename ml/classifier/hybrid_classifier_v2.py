"""
Improved Hybrid Transaction Classifier (v2)
WealthIQ — Phase 5 Offline Improvement Pipeline

Features:
- Integrated Indian narration preprocessor
- Contextual token disambiguation (AMC, Society, Prime Video vs Amazon, etc.)
- 11 native ML target classes (including Housing & Rent)
- Calibrated review thresholding & out-of-vocabulary protection
"""

import re
import numpy as np
import joblib
from pathlib import Path
from preprocess import preprocess_indian_narration

candidate_paths = [
    Path(__file__).parent.parent / "models" / "indian_transaction_classifier_v2.joblib",
    Path(__file__).parent / "models" / "indian_transaction_classifier_v2.joblib",
    Path("ml/models/indian_transaction_classifier_v2.joblib"),
]
MODEL_PATH = next((p for p in candidate_paths if p.exists()), candidate_paths[0])
model = joblib.load(MODEL_PATH)

# Contextual and High-Precedence Rules for Indian Transactions
# Specific compound phrases precede generic brand keywords!
CONTEXTUAL_RULES = [
    # 1. Contextual Disambiguation for AMC
    (r"\b(?:debit\s+card|credit\s+card|card|annual\s+maintenance|maintenance\s+charge|account|demat|brokerage)\s+amc\b", "Financial Services"),
    (r"\bamc\s+(?:charge|fee|due|penalty|annual)\b", "Financial Services"),
    (r"\b(?:amc\s+theatres?|amc\s+cinema|amc\s+imax|amc\s+movie)\b", "Entertainment & Recreation"),

    # 2. Contextual Disambiguation for Society
    (r"\b(?:housing|apartment|flat|building|colony|rwa|residential|co-?operative)\s+society\b", "Housing & Rent"),
    (r"\bsociety\s+(?:maintenance|charge|due|bill|fee|association|fund)\b", "Housing & Rent"),
    (r"\b(?:cancer|humane|red\s+cross|charitable|welfare\s+trust)\s+society\b", "Charity & Donations"),

    # 3. High-Precedence Compounds (Streaming / Services vs Parent Brands)
    (r"\b(?:amazon\s+prime\s+video|prime\s+video|prime\s+music)\b", "Entertainment & Recreation"),
    (r"\b(?:fastag\s+icici|fastag\s+sbi|fastag\s+paytm|fastag\s+toll|fastag\s+recharge|nhai\s+toll)\b", "Transportation"),
    (r"\b(?:cred\s+bill|cred\s+credit\s+card|cred\s+club|onecard\s+bill)\b", "Financial Services"),

    # 4. Indian Quick Commerce & Groceries
    (r"\b(?:swiggy|zomato|blinkit|zepto|instamart|bigbasket|dmart|dunzo|grofers|food\s+delivery|restaurant|grocer(?:y|ies))\b", "Food & Dining"),

    # 5. Local Transit & Commute
    (r"\b(?:uber|ola|rapido|blusmart|taxi|cab|metro|namma\s+metro|delhi\s+metro|irctc|bus\s+ticket|train\s+ticket|petrol|diesel|fuel)\b", "Transportation"),

    # 6. Utilities & State Boards
    (r"\b(?:electricity|water\s+bill|mobile\s+recharge|broadband|internet\s+bill|bescom|tata\s+power|adani\s+electricity|msedcl|uppcl|wbsedcl|jio\s+recharge|airtel\s+recharge|act\s+fibernet|tata\s+play|indane|bharat\s+gas|hp\s+gas|igl|mgl)\b", "Utilities & Services"),

    # 7. Healthcare & Diagnostics
    (r"\b(?:apollo\s+pharmacy|medplus|1mg|netmeds|pharmeasy|hospital|doctor\s+consultation|medical\s+clinic|pharmacy|diagnostic|pathlab|thyrocare|dr\s+lal)\b", "Healthcare & Medical"),

    # 8. Housing & Rent
    (r"\b(?:house\s+rent|monthly\s+rent|apartment\s+rent|rent\s+payment|landlord|lease\s+payment|paying\s+guest|pg\s+rent|society\s+maintenance|mygate|nobroker)\b", "Housing & Rent"),

    # 9. Income / Payroll
    (r"\b(?:salary\s+credited|payroll|salary\s+credit|dividend\s+credited|bonus\s+credited|interest\s+credited)\b", "Income"),

    # 10. Financial Services / EMIs
    (r"\b(?:home\s+loan\s+emi|loan\s+emi|loan\s+repayment|credit\s+card\s+bill|emi\s+debit|atm\s+fee)\b", "Financial Services"),

    # 11. Government / Tax
    (r"\b(?:income\s+tax|challan\s+280|property\s+tax|e-?challan|traffic\s+fine|parivahan|passport\s+seva|stamp\s+duty|rto)\b", "Government & Legal"),

    # 12. Charity / Donations
    (r"\b(?:pm\s+cares|akshaya\s+patra|cry\s+india|goonj|temple\s+donation|charity|donation)\b", "Charity & Donations"),

    # 13. General Shopping
    (r"\b(?:amazon|flipkart|myntra|ajio|nykaa|meesho|retail\s+purchase)\b", "Shopping & Retail"),
]

GENERIC_FINANCIAL_TOKENS = {
    "payment", "transfer", "paid", "sent", "txn", "debit", "dr", "cr",
    "money", "personal", "bill", "charges", "fee", "to", "for", "in", "from",
    "transfer to", "bill payment", "friend"
}

def categorize_v2(raw_description: str) -> dict:
    """
    Categorizes transaction using cleaned Indian narration, contextual rules,
    and calibrated 11-class ML prediction with ambiguity protection.
    """
    text = (raw_description or "").strip()
    if not text:
        return {
            "description": "",
            "category": "Other",
            "method": "fallback",
            "confidence": None,
            "needs_review": True,
        }

    # Preprocess narration into clean semantic tokens
    cleaned = preprocess_indian_narration(text)

    # 1. Check Contextual Compound Rules (against both raw and cleaned text)
    for pattern, category in CONTEXTUAL_RULES:
        if re.search(pattern, text, flags=re.IGNORECASE) or re.search(pattern, cleaned, flags=re.IGNORECASE):
            return {
                "description": raw_description,
                "cleaned": cleaned,
                "category": category,
                "method": "rule",
                "confidence": 1.0,
                "needs_review": False,
            }

    # 2. ML Prediction (Calibrated LinearSVC)
    text_to_eval = cleaned if len(cleaned) > 1 else text.lower()
    probabilities = model.predict_proba([text_to_eval])[0]
    best_index = probabilities.argmax()
    confidence = float(probabilities[best_index])
    predicted_category = model.classes_[best_index]

    # Margin check between top 2 classes
    sorted_probs = np.sort(probabilities)[::-1]
    prob_margin = float(sorted_probs[0] - sorted_probs[1])

    # Domain vocabulary check (out-of-vocabulary / generic tokens)
    indices = model.named_steps["tfidf"].transform([text_to_eval]).indices
    active_features = set(model.named_steps["tfidf"].get_feature_names_out()[i] for i in indices)
    non_generic_features = active_features - GENERIC_FINANCIAL_TOKENS

    # Out-of-vocabulary / low margin check:
    # If confidence is below 0.55 OR margin between top 2 classes < 0.12 OR no domain features, flag for review!
    is_ambiguous = len(non_generic_features) == 0 or confidence < 0.55 or prob_margin < 0.12 or len(cleaned.split()) <= 1

    final_category = "Other" if len(non_generic_features) == 0 else predicted_category
    final_confidence = round(min(confidence, 0.40), 4) if len(non_generic_features) == 0 else round(confidence, 4)

    return {
        "description": raw_description,
        "cleaned": cleaned,
        "category": final_category,
        "confidence": final_confidence,
        "method": "ml",
        "needs_review": is_ambiguous,
    }


if __name__ == "__main__":
    samples = [
        "Swiggy food order",
        "UPI/432198765432/Blinkit/blinkit@icici",
        "Society maintenance charges MyGate",
        "Debit card annual maintenance charge AMC Rs 590",
        "Amazon Prime video subscription",
        "FASTag ICICI toll debit NH44",
        "Monthly house rent to landlord",
        "Apollo Pharmacy medicines",
        "Salary credited Infosys",
        "UPI transfer to Sharmaji",
    ]
    for s in samples:
        print(s, "->", categorize_v2(s))
