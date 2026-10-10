"""
WealthIQ - India Findex 2025 Dataset Inspection Script
Read-only script to audit dimensions, columns, and target distribution.
"""

import csv
import sys
from pathlib import Path
from collections import Counter

DATASET_PATH = Path("ml/data/raw/IND_2024_FINDEX_v02_M_CSV/Findex_Microdata_2025_updateIndia.csv")

def main():
    if not DATASET_PATH.exists():
        print(f"Error: Dataset not found at {DATASET_PATH}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading dataset from: {DATASET_PATH}")
    with open(DATASET_PATH, mode="r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = list(reader)

    num_rows = len(rows)
    num_cols = len(header)
    print(f"\n--- DATASET DIMENSIONS ---")
    print(f"Rows (respondents): {num_rows}")
    print(f"Columns: {num_cols}")

    # Check fin24a target
    if "fin24a" in header:
        idx_target = header.index("fin24a")
        target_counts = Counter(r[idx_target] for r in rows)
        print(f"\n--- TARGET fin24a FREQUENCY DISTRIBUTION ---")
        labels = {
            "1": "Very difficult",
            "2": "Somewhat difficult",
            "3": "Not difficult at all",
            "4": "Don't know",
            "": "Missing / Skipped (Sysmiss)"
        }
        for val, count in sorted(target_counts.items(), key=lambda x: str(x[0])):
            label = labels.get(val, "Other")
            pct = (count / num_rows) * 100
            print(f"  Code {repr(val)} ({label}): {count} ({pct:.2f}%)")
    else:
        print("\nTarget fin24a NOT found in header!")

    # Check fin24 skip logic
    if "fin24" in header and "fin24a" in header:
        idx_f24 = header.index("fin24")
        idx_f24a = header.index("fin24a")
        print(f"\n--- CROSS-TABULATION: fin24 (Emergency Source) vs fin24a (Difficulty) ---")
        src_labels = {
            "1": "Savings",
            "2": "Family/friends",
            "3": "Work money",
            "4": "Loan (bank/employer/private)",
            "5": "Sale of assets",
            "6": "Other source",
            "7": "Could not come up with money",
            "8": "Don't know",
            "9": "Refused"
        }
        f24_counts = Counter(r[idx_f24] for r in rows)
        for code, cnt in sorted(f24_counts.items()):
            label = src_labels.get(code, "Unknown")
            sub_f24a = Counter(r[idx_f24a] for r in rows if r[idx_f24] == code)
            sub_str = ", ".join(f"fin24a={k if k!='' else 'MISSING'}:{v}" for k, v in sorted(sub_f24a.items()))
            print(f"  fin24={code} ({label:30s}, N={cnt:4d}) -> {sub_str}")

if __name__ == "__main__":
    main()
