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
    ("Nimetumia kiasi gani mwezi huu?", {"spending_summary", "find_transactions", "period_totals"}),
    ("How much did I spend on transport last month?", {"spending_summary", "find_transactions", "period_totals"}),
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
    # Changing a budget: only when asked, with the right category and amount.
    ("Create a budget for transport 40000", {"set_budget"}, {"category": "transport", "amount": 40000}),
    ("Set my food budget to 250,000", {"set_budget"}, {"category": "food", "amount": 250000}),
    ("Weka bajeti ya usafiri elfu 40", {"set_budget"}, {"category": "transport", "amount": 40000}),
    ("Create a transport budget", set()),
    ("How much is my transport budget?", {"budget_status"}),
    # Doing things: the right action, only when asked and when enough is known.
    ("I spent 5000 on lunch", {"add_transaction"}, {"type": "expense", "category": "food", "amount": 5000}),
    ("Nimelipa nauli 2000", {"add_transaction"}, {"type": "expense", "category": "transport", "amount": 2000}),
    ("I received 500,000 salary today", {"add_transaction"}, {"type": "income", "category": "salary", "amount": 500000}),
    ("Create a goal for school fees of 2 million by 2027-03-31", {"add_savings_goal"}, {"target": 2000000}),
    ("Add my internet subscription, 50000 per month, category utilities", {"add_subscription"}, {"amount": 50000}),
    ("Rent of 300000 repeats monthly under home, add it", {"add_recurring"}, {"amount": 300000, "frequency": "monthly"}),
    ("I borrowed 80000 from Asha for bike repair, due 2026-12-20", {"add_loan"}, {"amount": 80000, "kind": "money"}),
    ("Add the due recurring entries", {"post_due_recurring"}),
    ("Turn off the daily reminders", {"set_reminders"}, {"enabled": False}),
    ("Export my transactions", {"export_transactions"}),
    ("Undo that", {"undo_last"}),
    ("Delete the snack I added today", {"find_transactions", "period_totals"}),
    ("Mark my internet subscription as paid", {"upcoming_payments"}),
    ("Log me out", {"open_screen"}, {"screen": "profile"}),
    ("I spent money on lunch", set()),
    ("Create a savings goal for a laptop", set()),
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
    # Free tiers allow only a few requests a minute, so be patient.
    for _ in range(12):
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
    pause = float(sys.argv[2]) if len(sys.argv) > 2 else 4
    passed = 0
    for question, expected, *dates in CASES:
        calls = first_tools(base, question)
        called = [call["name"] for call in calls]
        ok = bool(set(called) & expected) if expected else not called
        asked = None
        if dates and ok and isinstance(dates[0], dict):
            arguments = calls[0]["arguments"]
            asked = {
                key: value.lower() if isinstance(value := arguments.get(key), str) else value for key in dates[0]
            }
            ok = asked == dates[0]
        elif dates and ok:
            arguments = calls[0]["arguments"]
            asked = (arguments.get("from"), arguments.get("to") or arguments.get("from"))
            ok = asked == dates[0]
        passed += ok
        print("PASS" if ok else "FAIL", question, "->", called or "no tool", asked or "", flush=True)
        print(end="", flush=True)
        time.sleep(pause)  # stay within the server's and the provider's limits
    print(f"{passed}/{len(CASES)} passed")
    sys.exit(0 if passed == len(CASES) else 1)


if __name__ == "__main__":
    main()
