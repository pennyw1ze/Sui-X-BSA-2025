"""CLI helper that enriches leak entries via OpenRouter and prints JSON."""

import json
import sys
from pathlib import Path
from typing import Any, Dict, List

CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.append(str(CURRENT_DIR))

from leak_insights_agent import LeakInsightsAgent


def enrich_entries(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    agent = LeakInsightsAgent()
    enriched: List[Dict[str, Any]] = []

    for entry in entries:
        title = entry.get("title") or "Untitled leak"
        description = entry.get("description") or "No description provided."
        insight = agent.enrich(title=title, description=description)
        enriched.append({**entry, **insight})

    return {"entries": enriched}


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:  # noqa: BLE001
        print(json.dumps({"error": f"Invalid JSON payload: {exc}"}))
        sys.exit(1)

    entries = payload.get("entries", [])
    if not isinstance(entries, list) or not entries:
        print(json.dumps({"entries": []}))
        return

    try:
        result = enrich_entries(entries)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc)}))
        sys.exit(2)

    print(json.dumps(result))


if __name__ == "__main__":
    main()
