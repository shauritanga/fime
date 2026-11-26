"""Does the model ask for the right data? Run against a server that has a real model:

    python3 eval_tools.py http://127.0.0.1:8190

Uses only the standard library. No personal data is involved: it stops at the model's first tool choice.
"""
import json
import sys
import time
import urllib.error
import urllib.request

CASES = [
    ("Analyze my spending this month", {"spending_summary"}),
    ("Nimetumia kiasi gani mwezi huu?", {"spending_summary", "find_transactions"}),
    ("How much did I spend on transport last month?", {"spending_summary", "find_transactions"}),
    ("Show my largest expenses", {"find_transactions"}),
    ("Check my budget", {"budget_status"}),
    ("Bajeti yangu ikoje?", {"budget_status"}),
    ("Ninadaiwa kiasi gani", {"upcoming_payments"}),
    ("Nina deni kiasi gani?", {"upcoming_payments"}),
    ("How much do I owe?", {"upcoming_payments"}),
    ("What bills are coming up?", {"upcoming_payments"}),
    ("Compare my spending over the last six months", {"monthly_trend", "spending_summary"}),
    ("How are my savings goals going?", {"savings_goals"}),
    ("Malengo yangu ya akiba yamefikia wapi?", {"savings_goals"}),
    ("Who won the 2022 world cup?", set()),
    # Dates (today is Thursday 2026-11-26): the right tool AND the right days.
    ("What is my spend today", {"period_totals"}, ("2026-11-26", "2026-11-26")),
    ("What is my daily expense from yesterday", {"period_totals"}, ("2026-11-25", "2026-11-25")),
    ("Nimetumia kiasi gani jana?", {"period_totals"}, ("2026-11-25", "2026-11-25")),
    ("Total spend on 19 November", {"period_totals"}, ("2026-11-19", "2026-11-19")),
    ("How much have I spent this week?", {"period_totals"}, ("2026-11-23", "2026-11-26")),
    ("Spending between 1 and 15 November", {"period_totals"}, ("2026-11-01", "2026-11-15")),
    ("How much did I spend last week?", {"period_totals"}, ("2026-11-16", "2026-11-22")),
]


def first_tools(base, question):
    body = json.dumps({"today": "2026-11-26", "messages": [{"role": "user", "content": question}]}).encode()
    request = urllib.request.Request(f"{base}/v1/chat", body, {"Content-Type": "application/json"})
    for _ in range(4):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return json.load(response)["tool_calls"]
        except urllib.error.HTTPError as error:
            if error.code != 429:
                raise
            time.sleep(20)
    raise SystemExit("Still rate limited; try again later.")


def main():
    base = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8190").rstrip("/")
    passed = 0
    for question, expected, *dates in CASES:
        calls = first_tools(base, question)
        called = [call["name"] for call in calls]
        ok = bool(set(called) & expected) if expected else not called
        asked = None
        if dates and ok:
            arguments = calls[0]["arguments"]
            asked = (arguments.get("from"), arguments.get("to") or arguments.get("from"))
            ok = asked == dates[0]
        passed += ok
        print("PASS" if ok else "FAIL", question, "->", called or "no tool", asked or "")
        time.sleep(4)  # stay within the server's and the free tier's limits
    print(f"{passed}/{len(CASES)} passed")
    sys.exit(0 if passed == len(CASES) else 1)


if __name__ == "__main__":
    main()
