import os
from typing import Any, Dict

try:
    from .base_agent import BaseAgent
except ImportError:  # pragma: no cover - fallback when executed as script
    from base_agent import BaseAgent  # type: ignore  # pylint: disable=import-error


class LeakInsightsAgent(BaseAgent):
    """Agent that enriches leak metadata with concise tags using OpenRouter."""

    def __init__(self) -> None:
        api_key = os.getenv("OPENROUTER_API_KEY")
        model = os.getenv("OPENROUTER_MODEL", "x-ai/grok-4-fast:free")
        site_url = os.getenv("OPENROUTER_SITE_URL")
        site_name = os.getenv("OPENROUTER_SITE_NAME")
        super().__init__(model=model, api_key=api_key, site_url=site_url, site_name=site_name)

    def enrich(self, title: str, description: str) -> Dict[str, Any]:
        prompt = (
            "You are assisting a transparency collective that curates leaked documents. "
            "Given a leak title and description, produce JSON describing it. "
            "Return keys: tags (array of short lowercase tags), insight (string with one-sentence context) "
            "and risk (one of Low, Medium, High). Keep tags focused on impact areas, not generic words."
        )
        payload = {
            "title": title.strip(),
            "description": description.strip(),
        }
        messages = [
            {
                "role": "system",
                "content": prompt,
            },
            {
                "role": "user",
                "content": (
                    "Produce strictly valid JSON following this schema: "
                    "{\"tags\": string[], \"insight\": string, \"risk\": string}."
                    f" Title: {payload['title']}. Description: {payload['description']}"
                ),
            },
        ]

        result = self._send_llm_request(messages)
        if not result:
            return {
                "tags": [],
                "insight": "Unable to generate automated insight at this time.",
                "risk": "Unknown",
            }

        tags = result.get("tags", [])
        if isinstance(tags, str):
            tags = [tag.strip() for tag in tags.split(",") if tag.strip()]
        elif not isinstance(tags, list):
            tags = []

        clean_tags = []
        for tag in tags:
            if isinstance(tag, str) and tag.strip():
                clean_tags.append(tag.strip().replace(" ", "-"))

        insight = result.get("insight")
        if not isinstance(insight, str) or not insight.strip():
            insight = "Community-curated leak awaiting deeper analysis."

        risk = result.get("risk", "Unknown")
        if isinstance(risk, str):
            risk = risk.strip().capitalize()
        else:
            risk = "Unknown"

        return {
            "tags": clean_tags[:6],
            "insight": insight.strip(),
            "risk": risk,
        }
