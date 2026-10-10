"""
India Financial Transaction Dataset Builder
WealthIQ — Phase 5 Offline Improvement Pipeline

Constructs a balanced, deduplicated 11-class dataset covering Indian and global transactions.
Separates data into train (70%), val (15%), and locked test (15%) without leakage.
"""

import json
from pathlib import Path
import random
import pyarrow.parquet as pq
import pandas as pd
import numpy as np

from preprocess import preprocess_indian_narration

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# 11 Native Target Classes
CLASSES = [
    "Food & Dining",
    "Transportation",
    "Housing & Rent",
    "Utilities & Services",
    "Healthcare & Medical",
    "Entertainment & Recreation",
    "Shopping & Retail",
    "Financial Services",
    "Government & Legal",
    "Charity & Donations",
    "Income",
]

# Curated Indian Merchants and Phrasings per Category
# Format: (Merchant/Template, Category)
INDIAN_CORPUS = [
    # --- Food & Dining ---
    ("Swiggy food delivery", "Food & Dining"),
    ("Swiggy Instamart groceries", "Food & Dining"),
    ("Zomato restaurant order", "Food & Dining"),
    ("Blinkit 10 minute grocery", "Food & Dining"),
    ("Zepto instant grocery delivery", "Food & Dining"),
    ("BigBasket online supermarket", "Food & Dining"),
    ("DMart ready groceries", "Food & Dining"),
    ("Haldiram sweets snacks", "Food & Dining"),
    ("Bikanervala sweets restaurant", "Food & Dining"),
    ("Saravana Bhavan south indian restaurant", "Food & Dining"),
    ("Chai Point tea snacks", "Food & Dining"),
    ("Chaayos tea cafe", "Food & Dining"),
    ("Barbeque Nation buffet dinner", "Food & Dining"),
    ("Domino's pizza online delivery", "Food & Dining"),
    ("McDonald's fast food restaurant", "Food & Dining"),
    ("KFC chicken meal order", "Food & Dining"),
    ("Subway sandwich lunch", "Food & Dining"),
    ("Burger King order", "Food & Dining"),
    ("Starbucks coffee cafe", "Food & Dining"),
    ("Cafe Coffee Day beverage", "Food & Dining"),
    ("Nandhini deluxe restaurant", "Food & Dining"),
    ("Empire restaurant dinner", "Food & Dining"),
    ("Local bakery bread cakes", "Food & Dining"),
    ("Nature's Basket gourmet store", "Food & Dining"),
    ("Spencer's retail supermarket groceries", "Food & Dining"),
    ("EatFit healthy meal order", "Food & Dining"),
    ("Faasos wrap food delivery", "Food & Dining"),
    ("Behrouz biryani order", "Food & Dining"),
    ("Biryani By Kilo delivery", "Food & Dining"),
    ("Sweet Bengal mithai purchase", "Food & Dining"),
    ("Udupi cafe breakfast idli vada", "Food & Dining"),
    ("Madras Coffee House filter coffee", "Food & Dining"),
    ("Dunzo Daily grocery delivery", "Food & Dining"),
    ("Licious fresh meat order", "Food & Dining"),
    ("FreshToHome fish meat delivery", "Food & Dining"),

    # --- Transportation ---
    ("Uber cab ride trip", "Transportation"),
    ("Uber auto rickshaw ride", "Transportation"),
    ("Ola cab airport drop", "Transportation"),
    ("Ola auto ride payment", "Transportation"),
    ("Rapido bike taxi booking", "Transportation"),
    ("BluSmart electric mobility ride", "Transportation"),
    ("IRCTC railway train ticket booking", "Transportation"),
    ("Indian Railways passenger ticket", "Transportation"),
    ("Delhi Metro DMRC smartcard recharge", "Transportation"),
    ("Namma Metro Bangalore smart card", "Transportation"),
    ("Mumbai Metro one card topup", "Transportation"),
    ("FASTag NHAI toll plaza payment", "Transportation"),
    ("FASTag ICICI toll debit", "Transportation"),
    ("FASTag SBI toll payment", "Transportation"),
    ("FASTag Paytm toll debit", "Transportation"),
    ("Indian Oil Corporation petrol fuel", "Transportation"),
    ("Bharat Petroleum BPCL diesel refill", "Transportation"),
    ("Hindustan Petroleum HPCL petrol bunk", "Transportation"),
    ("Shell petrol station fuel payment", "Transportation"),
    ("Mahanagar Gas CNG auto filling", "Transportation"),
    ("Indraprastha Gas IGL CNG station", "Transportation"),
    ("BMTC bus daily pass Bangalore", "Transportation"),
    ("BEST bus ticket Mumbai", "Transportation"),
    ("DTC bus ticket Delhi", "Transportation"),
    ("RedBus intercity bus ticket booking", "Transportation"),
    ("AbhiBus travels bus reservation", "Transportation"),
    ("IndiGo airline flight booking", "Transportation"),
    ("Air India flight ticket purchase", "Transportation"),
    ("SpiceJet domestic flight ticket", "Transportation"),
    ("Akasa Air flight ticket", "Transportation"),
    ("Airport parking toll fee", "Transportation"),
    ("Railway station parking charges", "Transportation"),
    ("Zoomcar self drive car rental", "Transportation"),
    ("Revv car subscription rental", "Transportation"),
    ("Ather energy EV charging station", "Transportation"),
    ("Tata Power EZ charge EV station", "Transportation"),

    # --- Housing & Rent ---
    ("Monthly house rent to landlord", "Housing & Rent"),
    ("Apartment flat rent payment", "Housing & Rent"),
    ("House lease payment to owner", "Housing & Rent"),
    ("NoBroker pay house rent", "Housing & Rent"),
    ("CRED rent pay house lease", "Housing & Rent"),
    ("Magicbricks rent pay to landlord", "Housing & Rent"),
    ("PG accommodation monthly rent", "Housing & Rent"),
    ("Paying guest room rent charges", "Housing & Rent"),
    ("Hostel accommodation fees", "Housing & Rent"),
    ("Apartment society maintenance charges", "Housing & Rent"),
    ("MyGate housing society dues payment", "Housing & Rent"),
    ("NoBrokerHood society maintenance dues", "Housing & Rent"),
    ("Residential welfare association RWA maintenance", "Housing & Rent"),
    ("Building maintenance charges monthly", "Housing & Rent"),
    ("Flat maintenance association dues", "Housing & Rent"),
    ("Landlord security deposit rent", "Housing & Rent"),
    ("Rental advance payment house", "Housing & Rent"),
    ("Stanleys property rent payment", "Housing & Rent"),
    ("Commercial office rent lease", "Housing & Rent"),
    ("Co-living space monthly rent Zolo Stanza", "Housing & Rent"),

    # --- Utilities & Services ---
    ("BESCOM electricity bill payment", "Utilities & Services"),
    ("Tata Power electricity bill", "Utilities & Services"),
    ("Adani Electricity Mumbai power bill", "Utilities & Services"),
    ("MSEDCL Maharashtra electricity bill", "Utilities & Services"),
    ("UPPCL power bill payment", "Utilities & Services"),
    ("WBSEDCL West Bengal electricity bill", "Utilities & Services"),
    ("Torrent Power electricity bill", "Utilities & Services"),
    ("BSES Rajdhani power bill Delhi", "Utilities & Services"),
    ("BSES Yamuna power bill payment", "Utilities & Services"),
    ("Jio prepaid mobile recharge", "Utilities & Services"),
    ("Jio fiber broadband bill payment", "Utilities & Services"),
    ("Airtel prepaid mobile recharge", "Utilities & Services"),
    ("Airtel Xstream fiber broadband bill", "Utilities & Services"),
    ("Airtel postpaid mobile bill payment", "Utilities & Services"),
    ("Vodafone Idea Vi mobile recharge", "Utilities & Services"),
    ("BSNL landline broadband bill", "Utilities & Services"),
    ("ACT Fibernet broadband bill payment", "Utilities & Services"),
    ("Hathway cable broadband bill", "Utilities & Services"),
    ("Indane LPG cylinder refill booking", "Utilities & Services"),
    ("Bharat Gas LPG cylinder booking", "Utilities & Services"),
    ("HP Gas cylinder refill payment", "Utilities & Services"),
    ("Indraprastha Gas IGL piped natural gas PNG bill", "Utilities & Services"),
    ("Mahanagar Gas MGL piped natural gas bill", "Utilities & Services"),
    ("BWSSB water supply sewage bill Bangalore", "Utilities & Services"),
    ("Delhi Jal Board water bill DJB", "Utilities & Services"),
    ("Tata Play DTH satellite TV recharge", "Utilities & Services"),
    ("Airtel Digital TV DTH recharge", "Utilities & Services"),
    ("Dish TV DTH recharge payment", "Utilities & Services"),
    ("Urban Company home cleaning service", "Utilities & Services"),
    ("Urban Company AC repair service", "Utilities & Services"),

    # --- Healthcare & Medical ---
    ("Apollo Pharmacy medicine purchase", "Healthcare & Medical"),
    ("Medplus medical store pharmacy", "Healthcare & Medical"),
    ("Tata 1mg online pharmacy medicine", "Healthcare & Medical"),
    ("Netmeds online medicine order", "Healthcare & Medical"),
    ("PharmEasy medicine prescription order", "Healthcare & Medical"),
    ("Local chemist medical store prescription", "Healthcare & Medical"),
    ("Manipal Hospital consultation doctor fee", "Healthcare & Medical"),
    ("Fortis Hospital OPD consultation fee", "Healthcare & Medical"),
    ("Apollo Hospitals health checkup consultation", "Healthcare & Medical"),
    ("Max Healthcare hospital OPD doctor fee", "Healthcare & Medical"),
    ("Narayana Health hospital doctor appointment", "Healthcare & Medical"),
    ("Dr Lal PathLabs diagnostic blood test", "Healthcare & Medical"),
    ("Thyrocare technologies pathology lab checkup", "Healthcare & Medical"),
    ("Metropolis healthcare diagnostic lab", "Healthcare & Medical"),
    ("SRL Diagnostics pathology test", "Healthcare & Medical"),
    ("Practo doctor consultation online appointment", "Healthcare & Medical"),
    ("Clove Dental clinic dentist appointment", "Healthcare & Medical"),
    ("Lenskart optical spectacles frame lenses", "Healthcare & Medical"),
    ("Titan Eyeplus spectacles prescription glasses", "Healthcare & Medical"),
    ("Healthians diagnostic blood test at home", "Healthcare & Medical"),

    # --- Entertainment & Recreation ---
    ("Netflix monthly streaming subscription", "Entertainment & Recreation"),
    ("Amazon Prime video subscription plan", "Entertainment & Recreation"),
    ("Disney+ Hotstar annual VIP streaming plan", "Entertainment & Recreation"),
    ("Spotify premium music streaming plan", "Entertainment & Recreation"),
    ("YouTube Premium family subscription", "Entertainment & Recreation"),
    ("Apple Music streaming subscription", "Entertainment & Recreation"),
    ("SonyLIV premium streaming subscription", "Entertainment & Recreation"),
    ("Zee5 premium annual streaming subscription", "Entertainment & Recreation"),
    ("JioCinema premium annual subscription", "Entertainment & Recreation"),
    ("BookMyShow cinema movie tickets PVR", "Entertainment & Recreation"),
    ("PVR Cinemas movie tickets popcorn snacks", "Entertainment & Recreation"),
    ("INOX Leisure multiplex cinema tickets", "Entertainment & Recreation"),
    ("Cinepolis multiplex movie tickets", "Entertainment & Recreation"),
    ("Cult.fit gym fitness pass subscription", "Entertainment & Recreation"),
    ("Gold's Gym monthly membership dues", "Entertainment & Recreation"),
    ("Anytime Fitness gym membership", "Entertainment & Recreation"),
    ("PlayStation Network PSN store game purchase", "Entertainment & Recreation"),
    ("Steam games online video game store", "Entertainment & Recreation"),
    ("Google Play store game purchase in-app", "Entertainment & Recreation"),
    ("Wonderla amusement park entry tickets", "Entertainment & Recreation"),

    # --- Shopping & Retail ---
    ("Amazon India online shopping retail order", "Shopping & Retail"),
    ("Flipkart online retail marketplace order", "Shopping & Retail"),
    ("Myntra apparel fashion clothing order", "Shopping & Retail"),
    ("Ajio fashion clothes lifestyle purchase", "Shopping & Retail"),
    ("Nykaa beauty cosmetics makeup order", "Shopping & Retail"),
    ("Meesho online clothing retail order", "Shopping & Retail"),
    ("Tata Neu online shopping purchase", "Shopping & Retail"),
    ("Croma electronics laptop phone purchase", "Shopping & Retail"),
    ("Reliance Digital electronics gadgets", "Shopping & Retail"),
    ("Vijay Sales electronics home appliances", "Shopping & Retail"),
    ("Decathlon sports goods shoes apparel", "Shopping & Retail"),
    ("Zudio fashion store clothing purchase", "Shopping & Retail"),
    ("Westside retail store apparel footwear", "Shopping & Retail"),
    ("Shoppers Stop retail fashion store", "Shopping & Retail"),
    ("Pantaloons retail clothing store", "Shopping & Retail"),
    ("H&M clothing retail apparel purchase", "Shopping & Retail"),
    ("Zara retail fashion clothing store", "Shopping & Retail"),
    ("Uniqlo apparel retail clothing store", "Shopping & Retail"),
    ("IKEA home furniture decor purchase", "Shopping & Retail"),
    ("Pepperfry furniture home decor online", "Shopping & Retail"),

    # --- Financial Services ---
    ("SBI home loan EMI monthly auto debit", "Financial Services"),
    ("HDFC home loan monthly EMI repayment", "Financial Services"),
    ("ICICI car loan monthly EMI installment", "Financial Services"),
    ("Axis Bank personal loan EMI debit", "Financial Services"),
    ("Kotak Mahindra loan EMI auto deduction", "Financial Services"),
    ("CRED credit card bill repayment", "Financial Services"),
    ("HDFC Bank credit card bill payment", "Financial Services"),
    ("SBI Card credit card bill settlement", "Financial Services"),
    ("ICICI Bank credit card bill payment", "Financial Services"),
    ("OneCard metal credit card bill payment", "Financial Services"),
    ("Axis Bank credit card bill payment", "Financial Services"),
    ("Debit card annual maintenance charges AMC fee", "Financial Services"),
    ("Bank ATM cash withdrawal service fee", "Financial Services"),
    ("Cheque return penalty bank fee charges", "Financial Services"),
    ("Zerodha Broking demat AMC charges account", "Financial Services"),
    ("Groww demat account annual charges", "Financial Services"),
    ("Angel One trading account brokerage AMC", "Financial Services"),
    ("Upstox trading account charges", "Financial Services"),
    ("Mutual fund SIP auto debit investment installment", "Financial Services"),
    ("NPS National Pension System tier 1 contribution", "Financial Services"),

    # --- Government & Legal ---
    ("Income Tax challan 280 advance tax payment", "Government & Legal"),
    ("Self assessment income tax payment NSDL", "Government & Legal"),
    ("BBMP property tax annual payment Bangalore", "Government & Legal"),
    ("BMC property tax payment Mumbai", "Government & Legal"),
    ("Traffic police e-challan traffic violation fine", "Government & Legal"),
    ("Passport Seva Kendra appointment passport fee", "Government & Legal"),
    ("Parivahan Sarathi driving license renewal fee", "Government & Legal"),
    ("Vahan RTO vehicle registration tax road tax", "Government & Legal"),
    ("Sub-registrar property stamp duty registration fee", "Government & Legal"),
    ("Court fee stamp paper notary judicial charges", "Government & Legal"),
    ("Municipal corporation trade license renewal fee", "Government & Legal"),
    ("Commercial tax department professional tax payment", "Government & Legal"),
    ("FASTag national highway toll fine penalty", "Government & Legal"),
    ("Water tax municipal corporation penalty fee", "Government & Legal"),

    # --- Charity & Donations ---
    ("PM CARES fund contribution donation relief", "Charity & Donations"),
    ("Akshaya Patra foundation mid day meal donation", "Charity & Donations"),
    ("Tirupati Tirumala Devasthanam hundi donation offering", "Charity & Donations"),
    ("CRY Child Rights and You donation contribution", "Charity & Donations"),
    ("Goonj NGO cloth relief rehabilitation donation", "Charity & Donations"),
    ("Smile Foundation child education charity donation", "Charity & Donations"),
    ("HelpAge India elderly care foundation donation", "Charity & Donations"),
    ("Siddhivinayak temple trust donation receipt", "Charity & Donations"),
    ("Shirdi Saibaba Sansthan trust charity offering", "Charity & Donations"),
    ("GiveIndia certified nonprofit donation support", "Charity & Donations"),
    ("UNICEF India emergency children relief donation", "Charity & Donations"),
    ("World Wildlife Fund WWF India conservation donation", "Charity & Donations"),
    ("Ramakrishna Mission charitable trust donation", "Charity & Donations"),
    ("Red Cross Society disaster relief donation", "Charity & Donations"),

    # --- Income ---
    ("Monthly salary credited from employer", "Income"),
    ("Infosys Ltd payroll salary credited NEFT", "Income"),
    ("Tata Consultancy Services TCS salary credit", "Income"),
    ("Wipro Technologies monthly salary credit", "Income"),
    ("HCL Tech payroll salary credited bank", "Income"),
    ("Annual performance incentive bonus credit", "Income"),
    ("Freelance client project payment credited", "Income"),
    ("Consulting professional fees credited IMPS", "Income"),
    ("TCS Ltd equity shares dividend credited", "Income"),
    ("Reliance Industries Ltd dividend credited", "Income"),
    ("Quarterly savings account bank interest credited", "Income"),
    ("Fixed deposit maturity interest payout credited", "Income"),
    ("Rental income credited from tenant house lease", "Income"),
    ("Mutual fund capital gains redemption credited", "Income"),
    ("Employee provident fund EPF withdrawal credited", "Income"),
    ("Income tax refund credited CPC Bengaluru", "Income"),
    ("Central government pension credited pension account", "Income"),
    ("Stipend credited internship research", "Income"),
]

# Generate realistic bank narration syntaxes (Passbook / UPI / SMS)
def generate_narration_variants(desc: str, cat: str) -> list[tuple[str, str]]:
    variants = [(desc, cat)]
    # 1. UPI VPA format
    vpa_handles = ["icici", "okhdfcbank", "paytm", "sbi", "axisbank", "ybl"]
    slug = desc.split()[0].lower()
    rrn = random.randint(100000000000, 999999999999)
    vpa = random.choice(vpa_handles)
    variants.append((f"UPI/{rrn}/{desc}/{slug}@{vpa}", cat))
    variants.append((f"UPI/{rrn}/{slug}@{vpa}/Payment", cat))
    
    # 2. POS format
    pos_id = random.randint(10000000, 99999999)
    city = random.choice(["BANGALORE", "MUMBAI", "DELHI", "HYDERABAD", "PUNE", "CHENNAI"])
    variants.append((f"POS {pos_id} {desc.upper()} {city}", cat))
    
    # 3. SMS notification format
    amt = random.choice([150, 420, 850, 1200, 3500, 8000, 15000, 25000])
    variants.append((f"Paid Rs {amt} to {desc} via UPI", cat))
    
    return variants

def generate_housing_corpus():
    """Generates ~1,200 realistic, distinct Indian housing, rent, and society maintenance transactions."""
    records = []
    landlords = ["Sharma", "Verma", "Gupta", "Patel", "Reddy", "Nair", "Rao", "Kumar", "Iyer", "Singh", "Mukherjee", "Deshmukh", "Chopra", "Mehta", "Bhat"]
    societies = [
        "Prestige Shantiniketan", "Sobha Renaissance", "Godrej Woods", "Brigade Metropolis",
        "Purva Windermere", "Hiranandani Gardens", "Lodha Palava", "DLF Cyber City",
        "Aparna Sarovar", "Mahagun Moderne", "Jaypee Greens", "Tata Promont",
        "Salarpuria Sattva", "Mantri Espana", "Rohan Iksha", "Gokuldham Society",
        "Shanti Vihar Society", "Green Glen Layout", "Palm Meadows", "Windmills of Your Mind"
    ]
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    
    # 1. Direct rent payments
    for ll in landlords:
        for m in months:
            records.append((f"Monthly house rent to {ll} for {m}", "Housing & Rent"))
            records.append((f"Apartment rent transfer to Mr {ll}", "Housing & Rent"))
            records.append((f"Flat rent {m} landlord {ll}", "Housing & Rent"))
            records.append((f"Rent payment {m} via NEFT to {ll}", "Housing & Rent"))
            
    # 2. Portal & Digital rent payments
    for ll in landlords[:8]:
        records.append((f"NoBroker house rent payment to {ll}", "Housing & Rent"))
        records.append((f"CRED rent pay house lease {ll}", "Housing & Rent"))
        records.append((f"Magicbricks rent payment landlord {ll}", "Housing & Rent"))
        records.append((f"Housing.com rent pay owner {ll}", "Housing & Rent"))
        records.append((f"Paytm rent payment landlord {ll}", "Housing & Rent"))
        
    # 3. Society maintenance dues
    for soc in societies:
        for m in months[:6]:
            records.append((f"{soc} society maintenance charges for {m}", "Housing & Rent"))
            records.append((f"MyGate {soc} apartment dues payment", "Housing & Rent"))
            records.append((f"NoBrokerHood {soc} monthly maintenance", "Housing & Rent"))
            records.append((f"{soc} RWA maintenance charges", "Housing & Rent"))
            records.append((f"{soc} flat maintenance association fee", "Housing & Rent"))
            
    # 4. PG, Co-living, and Hostels
    for area in ["Koramangala", "HSR Layout", "Whitefield", "Indiranagar", "Gachibowli", "Hitec City", "Andheri", "Gurgaon Sector 21", "Noida Sector 62", "Viman Nagar"]:
        records.append((f"PG accommodation monthly rent {area}", "Housing & Rent"))
        records.append((f"Paying guest room rent {area}", "Housing & Rent"))
        records.append((f"Zolo Stanza co-living monthly rent {area}", "Housing & Rent"))
        records.append((f"Hostel room and mess accommodation rent {area}", "Housing & Rent"))
        records.append((f"House lease deposit advance payment {area}", "Housing & Rent"))
        
    return records

def build_dataset():
    print("Building India-enriched transaction dataset...")
    records = []
    
    # Add Indian corpus with variations
    for text, cat in INDIAN_CORPUS:
        for var_text, var_cat in generate_narration_variants(text, cat):
            records.append({
                "raw_text": var_text,
                "category": var_cat,
                "source": "curated_india_bank",
            })
            
    # Add expanded Housing & Rent corpus
    housing_data = generate_housing_corpus()
    for text, cat in housing_data:
        for var_text, var_cat in generate_narration_variants(text, cat):
            records.append({
                "raw_text": var_text,
                "category": var_cat,
                "source": "curated_housing",
            })
            
    # Sample clean baseline from 0000.parquet
    parquet_path = Path("0000.parquet")
    if parquet_path.exists():
        print("Sampling clean baseline records from 0000.parquet...")
        table = pq.read_table(parquet_path, columns=["transaction_description", "category"])
        df = table.to_pandas()
        
        # Deduplicate
        df = df.drop_duplicates(subset=["transaction_description"])
        
        # Sample balanced subset (~1100 per category to balance with Indian corpus)
        sampled_parts = []
        for cat in CLASSES:
            if cat == "Housing & Rent":
                continue  # Housing is provided by the comprehensive housing corpus
            cat_df = df[df["category"] == cat]
            if len(cat_df) > 0:
                n = min(len(cat_df), 1100)
                sampled_parts.append(cat_df.sample(n=n, random_state=42))
                
        baseline_df = pd.concat(sampled_parts, ignore_index=True)
        for _, row in baseline_df.iterrows():
            records.append({
                "raw_text": row["transaction_description"],
                "category": row["category"],
                "source": "cleaned_baseline",
            })
            
    full_df = pd.DataFrame(records)
    print(f"Total raw generated records: {len(full_df)}")
    
    # Preprocess text
    full_df["cleaned_text"] = full_df["raw_text"].apply(preprocess_indian_narration)
    
    # Filter empty and deduplicate on cleaned text
    full_df = full_df[full_df["cleaned_text"].str.len() > 1]
    
    # Remove label conflicts (ambiguous cleaned text mapped to multiple categories)
    conflicts = full_df.groupby("cleaned_text")["category"].nunique()
    ambiguous_texts = conflicts[conflicts > 1].index
    print(f"Found {len(ambiguous_texts)} ambiguous text collisions across sources. Removing...")
    full_df = full_df[~full_df["cleaned_text"].isin(ambiguous_texts)]
    
    # Deduplicate
    full_df = full_df.drop_duplicates(subset=["cleaned_text"])
    print(f"Total clean, unique records: {len(full_df)}")
    
    # Stratified split: Train (70%), Val (15%), Locked Test (15%)
    from sklearn.model_selection import train_test_split
    
    train_df, temp_df = train_test_split(
        full_df, test_size=0.30, random_state=42, stratify=full_df["category"]
    )
    val_df, test_df = train_test_split(
        temp_df, test_size=0.50, random_state=42, stratify=temp_df["category"]
    )
    
    # Save splits
    train_df.to_json(DATA_DIR / "train_set.json", orient="records", indent=2)
    val_df.to_json(DATA_DIR / "val_set.json", orient="records", indent=2)
    test_df.to_json(DATA_DIR / "test_locked.json", orient="records", indent=2)
    
    print("\nDataset Split Summary:")
    print(f"  Train Set: {len(train_df)} rows")
    print(f"  Val Set:   {len(val_df)} rows")
    print(f"  Test Set:  {len(test_df)} rows (LOCKED)")
    
    print("\nClass Distribution in Train Set:")
    print(train_df["category"].value_counts().to_string())

if __name__ == "__main__":
    build_dataset()
