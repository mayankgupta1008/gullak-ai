"""Extract the insurance tables the agent needs from the event zip into backend/data/insurance.json.

Usage: python3 scripts/extract_insurance.py ~/Desktop/buildathon_data.zip
"""
import csv
import io
import json
import sys
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path

TODAY = date(2026, 10, 14)  # data snapshot: active cycles end between 14 Oct and 12 Nov 2026
OUT = Path(__file__).resolve().parent.parent / "backend" / "data" / "insurance.json"

zf = zipfile.ZipFile(sys.argv[1])


def rows(name):
    with zf.open(f"buildathon/insurance/{name}") as f:
        return list(csv.DictReader(io.TextIOWrapper(f, encoding="utf-8", newline="")))


def num(s):
    n = float(s)
    return int(n) if n.is_integer() else n


def age(dob):
    d = date.fromisoformat(dob[:10])
    return TODAY.year - d.year - ((TODAY.month, TODAY.day) < (d.month, d.day))


products = {p["product_id"]: p for p in rows("insurance_products.csv")}

rate_cards = []
for r in rows("premium_rate_cards.csv"):
    p = products[r["product_id"]]
    rate_cards.append({
        "productId": r["product_id"],
        "insurer": p["insurer_code"],
        "productType": p["product_type"],
        "cadence": p["billing_cadence"],
        "cover": num(r["cover_amount"]),
        "adults": int(r["adult_count"]),
        "children": int(r["child_count"]),
        "ageMin": int(r["eldest_age_band_min"]),
        "ageMax": int(r["eldest_age_band_max"]),
        "premium": num(r["premium_amount"]),
        "deductible": num(r["deductible_amount"]) if r["deductible_amount"] else 0,
    })
keys = [(r["productId"], r["cover"], r["adults"], r["children"], r["ageMin"]) for r in rate_cards]
assert len(keys) == len(set(keys)), "duplicate rate-card rows would double up quotes"

applications = {a["application_id"]: a for a in rows("applications.csv")}
members_by_app = defaultdict(list)
for m in rows("policy_members.csv"):
    members_by_app[m["application_id"]].append(m)

customers, checked, matched = {}, 0, 0
for p in rows("policies.csv"):
    if p["status"] != "active":
        continue
    a, product = applications[p["application_id"]], products[p["product_id"]]

    # Self-check: the rate card must reproduce what each customer actually pays.
    checked += 1
    matched += any(
        r["productId"] == p["product_id"] and r["cover"] == num(a["cover_amount"])
        and r["adults"] == int(a["adult_count"]) and r["children"] == int(a["child_count"])
        and r["ageMin"] <= int(a["eldest_age"]) <= r["ageMax"] and r["premium"] == num(p["cycle_premium"])
        for r in rate_cards
    )

    members = [{
        "name": f'{m["first_name"]} {m["last_name"]}',
        "relationship": m["relationship"],
        "gender": m["gender"],
        "age": age(m["dob"]),
        "conditions": json.loads(m["disease_flags"]) if m["disease_flags"] else [],
        "conditionsSince": int(m["ped_since"]) if m["ped_since"] else None,
    } for m in sorted(members_by_app[p["application_id"]], key=lambda m: int(m["member_index"] or 0))]
    address = [s.strip() for s in a["address"].split(",")]

    customer = customers.setdefault(p["user_id"], {
        "userId": p["user_id"],
        "name": next((m["name"] for m in members if m["relationship"] == "self"), members[0]["name"] if members else None),
        "city": address[-2] if len(address) > 1 else None,
        "state": address[-1],
        "members": members,
        "adults": int(a["adult_count"]),
        "children": int(a["child_count"]),
        "eldestAge": max((m["age"] for m in members), default=int(a["eldest_age"])),
        "policies": [],
    })
    customer["policies"].append({
        "policyId": p["policy_id"],
        "productId": p["product_id"],
        "insurer": product["insurer_code"],
        "productType": product["product_type"],
        "cadence": product["billing_cadence"],
        "cover": num(a["cover_amount"]),
        "premium": num(p["cycle_premium"]),
        "cycleStart": p["current_cycle_start"],
        "cycleEnd": p["current_cycle_end"],
        "nextPaymentAt": p["next_payment_at"] or None,
        "activatedAt": p["activated_at"] or None,
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"today": TODAY.isoformat(), "rateCards": rate_cards, "customers": customers}))
print(f"{len(rate_cards)} rate cards, {len(customers)} customers -> {OUT}")
print(f"premium check: {matched}/{checked} active policies reproduce their premium from the rate card")
