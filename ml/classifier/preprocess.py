"""
Indian Transaction Narration Preprocessing & Normalization Engine
WealthIQ — Phase 5 Offline Improvement Pipeline

Cleans and normalizes noisy Indian bank narrations, UPI handles, NEFT/IMPS prefixes,
POS strings, and transaction references into clean semantic text.
"""

import re

# Common Indian bank UPI VPA handle suffixes
UPI_PSP_SUFFIXES = [
    r"@okaxis", r"@okhdfcbank", r"@okicici", r"@oksbi",
    r"@icici", r"@hdfcbank", r"@sbi", r"@axisbank",
    r"@paytm", r"@ybl", r"@ibl", r"@axl",
    r"@barodampay", r"@kotak", r"@indus", r"@federal",
    r"@upi", r"@freecharge", r"@airtel", r"@postbank"
]
UPI_SUFFIX_PATTERN = re.compile(r"|".join(UPI_PSP_SUFFIXES), flags=re.IGNORECASE)

# Bank narration prefixes
PREFIX_PATTERNS = [
    re.compile(r"^UPI\s*[/:\-]\s*([0-9]{9,16})\s*[/:\-]\s*", flags=re.IGNORECASE),
    re.compile(r"^POS\s+(?:W/D|PUR|TXN)\s+[0-9]+\s+", flags=re.IGNORECASE),
    re.compile(r"^(?:NEFT|RTGS|IMPS)\s+(?:CR|DR|P2A|P2P|TRANSFER)[-/: ]+(?:[A-Z0-9]+[-/: ]+)?", flags=re.IGNORECASE),
    re.compile(r"^ACH\s+[DC][-/: ]+", flags=re.IGNORECASE),
    re.compile(r"^BBPS[-/: ]+(?:BILLPAY[-/: ]+)?", flags=re.IGNORECASE),
    re.compile(r"^E-COMM\s+PUR\s+", flags=re.IGNORECASE),
    re.compile(r"^INB\s+TRANSFER\s+", flags=re.IGNORECASE),
]

# Numeric reference patterns
REF_PATTERNS = [
    re.compile(r"\b(?:TXN|REF|RRN|UTR)[0-9A-Z]+\b", flags=re.IGNORECASE),
    re.compile(r"\b[0-9]{8,18}\b"),  # Long transaction/account numbers
]

# Currency terms
CURRENCY_PATTERNS = re.compile(r"\b(?:INR|RS\.?|RUPEES?)\b", flags=re.IGNORECASE)

def preprocess_indian_narration(text: str) -> str:
    """
    Cleans raw transaction descriptions/bank narrations into semantic merchant tokens.
    """
    if not text or not isinstance(text, str):
        return ""

    cleaned = text.strip()

    # 1. Strip bank transaction prefixes (UPI, POS, NEFT, IMPS)
    for p in PREFIX_PATTERNS:
        cleaned = p.sub("", cleaned)

    # 2. Extract semantic merchant name from raw UPI slash pattern if present
    # Format: [Number]/[MerchantName]/[VPA]/[Memo]
    if "/" in cleaned:
        parts = [p.strip() for p in cleaned.split("/") if p.strip()]
        # Filter out purely numeric parts
        alpha_parts = [p for p in parts if not p.isdigit() and len(p) > 1]
        if alpha_parts:
            cleaned = " ".join(alpha_parts)

    # 3. Strip UPI PSP suffixes (@icici, @okhdfcbank, etc.)
    cleaned = UPI_SUFFIX_PATTERN.sub("", cleaned)

    # 4. Remove transaction reference numbers
    for p in REF_PATTERNS:
        cleaned = p.sub(" ", cleaned)

    # 5. Remove currency labels
    cleaned = CURRENCY_PATTERNS.sub(" ", cleaned)

    # 6. Replace special characters with spaces (preserve alphanumeric)
    cleaned = re.sub(r"[^a-zA-Z0-9\s&+\-]", " ", cleaned)

    # 7. Collapse multiple spaces and lowercase
    cleaned = re.sub(r"\s+", " ", cleaned).strip().lower()

    return cleaned

if __name__ == "__main__":
    test_cases = [
        "UPI/432198765432/Swiggy/swiggy@icici",
        "POS W/D 12345678 APOLLO PHARMACY BANGALORE",
        "NEFT CR-HDFC0001234-INFOSYS LTD-SALARY SEPT2026",
        "BBPS/BILLPAY/BESCOM ELECTRICITY/9876543210",
        "ACH D- HDFC HOUSING LOAN EMI",
        "UPI/528192837192/Blinkit Groceries/blinkit@hdfcbank",
        "Paid Rs. 450 to Swiggy for dinner order TXN987654",
        "FASTag ICICI toll debit NH44 UTR891238912",
        "Debit card annual maintenance charge AMC Rs 590",
        "Society maintenance charges MyGate apartment",
    ]

    print("Preprocessed Examples:")
    for tc in test_cases:
        print(f"  ORIG: {tc}")
        print(f"  PREP: {preprocess_indian_narration(tc)}\n")
