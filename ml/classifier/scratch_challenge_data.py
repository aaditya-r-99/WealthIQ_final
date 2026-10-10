"""
Phase 4 Curated Indian Challenge Set (116 samples)
Preserved as an external smoke test to evaluate failure mode correction.
"""

PHASE4_CHALLENGE_SET = [
    # --- Food & Dining (12) ---
    ("Swiggy food order for lunch", "Food & Dining"),
    ("Zomato restaurant dinner delivery", "Food & Dining"),
    ("Blinkit grocery delivery", "Food & Dining"),
    ("Zepto 10 min groceries delivery", "Food & Dining"),
    ("BigBasket monthly grocery order", "Food & Dining"),
    ("DMart ready supermarket purchase", "Food & Dining"),
    ("Instamart snack delivery", "Food & Dining"),
    ("Haldiram sweets and snacks payment", "Food & Dining"),
    ("Saravana Bhavan breakfast dosa", "Food & Dining"),
    ("Chai Point tea and cookies", "Food & Dining"),
    ("Barbeque Nation dinner buffet", "Food & Dining"),
    ("UPI/432198765432/Swiggy/swiggy@icici", "Food & Dining"),

    # --- Transportation (12) ---
    ("Uber cab ride to office", "Transportation"),
    ("Ola cab ride to airport", "Transportation"),
    ("Rapido bike taxi ride", "Transportation"),
    ("BluSmart electric cab booking", "Transportation"),
    ("IRCTC train ticket booking", "Transportation"),
    ("Delhi Metro smart card recharge", "Transportation"),
    ("Namma Metro token purchase", "Transportation"),
    ("BMTC bus monthly pass", "Transportation"),
    ("FASTag toll debit NH44 highway", "Transportation"),
    ("Indian Oil petrol pump fuel", "Transportation"),
    ("Bharat Petroleum diesel refill", "Transportation"),
    ("Shell petrol station payment", "Transportation"),

    # --- Housing & Rent (10) ---
    ("Monthly house rent to landlord", "Housing & Rent"),
    ("Apartment rent payment for October", "Housing & Rent"),
    ("Rent payment via bank transfer", "Housing & Rent"),
    ("NoBroker house rent payment", "Housing & Rent"),
    ("PG accommodation rent fee", "Housing & Rent"),
    ("Landlord monthly lease payment", "Housing & Rent"),
    ("Society maintenance monthly charges", "Housing & Rent"),
    ("MyGate society dues payment", "Housing & Rent"),
    ("Apartment maintenance fee", "Housing & Rent"),
    ("Paying guest room rent", "Housing & Rent"),

    # --- Utilities & Services (12) ---
    ("BESCOM electricity bill payment", "Utilities & Services"),
    ("Tata Power electricity bill", "Utilities & Services"),
    ("Adani Electricity power payment", "Utilities & Services"),
    ("MSEDCL power bill payment", "Utilities & Services"),
    ("Airtel prepaid mobile recharge", "Utilities & Services"),
    ("Jio fiber broadband recharge", "Utilities & Services"),
    ("Vi postpaid mobile bill payment", "Utilities & Services"),
    ("ACT Fibernet monthly broadband bill", "Utilities & Services"),
    ("BWSSB water supply bill payment", "Utilities & Services"),
    ("Indane LPG gas cylinder refill booking", "Utilities & Services"),
    ("IGL piped natural gas bill", "Utilities & Services"),
    ("Tata Play DTH recharge", "Utilities & Services"),

    # --- Healthcare & Medical (10) ---
    ("Apollo Pharmacy medicine purchase", "Healthcare & Medical"),
    ("Medplus medical store purchase", "Healthcare & Medical"),
    ("1mg online medicine delivery", "Healthcare & Medical"),
    ("Netmeds pharmacy order", "Healthcare & Medical"),
    ("Manipal Hospital doctor consultation fee", "Healthcare & Medical"),
    ("Fortis Hospital OPD consultation", "Healthcare & Medical"),
    ("Dr Lal PathLabs blood test diagnostic", "Healthcare & Medical"),
    ("Thyrocare full body health checkup", "Healthcare & Medical"),
    ("Practo online doctor consultation", "Healthcare & Medical"),
    ("Clove Dental clinic tooth extraction", "Healthcare & Medical"),

    # --- Entertainment & Recreation (10) ---
    ("Netflix monthly subscription plan", "Entertainment & Recreation"),
    ("Disney+ Hotstar annual VIP subscription", "Entertainment & Recreation"),
    ("Spotify premium music subscription", "Entertainment & Recreation"),
    ("Amazon Prime video subscription", "Entertainment & Recreation"),
    ("SonyLIV premium annual subscription", "Entertainment & Recreation"),
    ("BookMyShow movie tickets PVR cinema", "Entertainment & Recreation"),
    ("INOX cinema movie tickets and popcorn", "Entertainment & Recreation"),
    ("Cult.fit gym fitness pass", "Entertainment & Recreation"),
    ("Wonderla amusement park entry tickets", "Entertainment & Recreation"),
    ("Steam online video game purchase", "Entertainment & Recreation"),

    # --- Shopping & Retail (12) ---
    ("Amazon India retail shopping purchase", "Shopping & Retail"),
    ("Flipkart Big Billion Day electronics order", "Shopping & Retail"),
    ("Myntra apparel clothing order", "Shopping & Retail"),
    ("Ajio fashion clothes purchase", "Shopping & Retail"),
    ("Nykaa cosmetics and makeup order", "Shopping & Retail"),
    ("Tata Neu electronics purchase", "Shopping & Retail"),
    ("Croma electronics laptop purchase", "Shopping & Retail"),
    ("Reliance Digital headphones purchase", "Shopping & Retail"),
    ("Decathlon sports shoes purchase", "Shopping & Retail"),
    ("Zudio casual clothing purchase", "Shopping & Retail"),
    ("Westside retail store purchase", "Shopping & Retail"),
    ("Shoppers Stop fashion apparel purchase", "Shopping & Retail"),

    # --- Financial Services (10) ---
    ("SBI home loan EMI debit", "Financial Services"),
    ("HDFC personal loan EMI auto-debit", "Financial Services"),
    ("ICICI car loan monthly EMI payment", "Financial Services"),
    ("Cred credit card bill payment", "Financial Services"),
    ("HDFC credit card bill payment", "Financial Services"),
    ("OneCard credit card bill repayment", "Financial Services"),
    ("SBI ATM cash withdrawal fee", "Financial Services"),
    ("Cheque bounce penalty bank charge", "Financial Services"),
    ("Debit card annual maintenance charge AMC", "Financial Services"),
    ("Demag brokerage account AMC charges", "Financial Services"),

    # --- Government & Legal (10) ---
    ("Income Tax challan 280 tax payment", "Government & Legal"),
    ("BBMP property tax annual payment", "Government & Legal"),
    ("Advance tax payment via NSDL", "Government & Legal"),
    ("Traffic police e-challan penalty fine", "Government & Legal"),
    ("Passport Seva Kendra passport fee", "Government & Legal"),
    ("Driving license renewal fee Parivahan", "Government & Legal"),
    ("Sub-registrar property stamp duty fee", "Government & Legal"),
    ("Court fee stamp paper notary", "Government & Legal"),
    ("Municipal corporation water tax penalty", "Government & Legal"),
    ("Vehicle registration RTO tax payment", "Government & Legal"),

    # --- Charity & Donations (8) ---
    ("PM CARES fund donation contribution", "Charity & Donations"),
    ("Akshaya Patra foundation mid-day meal donation", "Charity & Donations"),
    ("Tirupati temple hundi donation offering", "Charity & Donations"),
    ("CRY India child relief donation", "Charity & Donations"),
    ("Goonj NGO relief fund donation", "Charity & Donations"),
    ("HelpAge India elderly care donation", "Charity & Donations"),
    ("Siddhivinayak temple donation receipt", "Charity & Donations"),
    ("GiveIndia charity donation support", "Charity & Donations"),

    # --- Income (10) ---
    ("Monthly salary credited from Infosys", "Income"),
    ("TCS payroll salary credit NEFT", "Income"),
    ("Wipro salary credited for September", "Income"),
    ("Annual performance bonus credited to account", "Income"),
    ("Freelance consulting payment credited", "Income"),
    ("Dividend credited TCS Ltd shares", "Income"),
    ("Quarterly interest credited savings account", "Income"),
    ("Rental income credited from tenant", "Income"),
    ("Mutual fund redemption payout credited", "Income"),
    ("Fixed deposit maturity interest credited", "Income"),
]
