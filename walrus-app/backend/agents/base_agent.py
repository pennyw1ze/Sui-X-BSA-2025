import json
import os
from openai import OpenAI


class BaseAgent:
    """A base class for Agents that use an LLM, providing a shared client."""

    def __init__(self, model: str, api_key: str, site_url: str | None = None, site_name: str | None = None):
        if not api_key:
            raise ValueError("Missing OpenRouter API key. Set OPENROUTER_API_KEY in your environment.")

        base_url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
        self.client = OpenAI(
            base_url=base_url,
            api_key=api_key,
        )
        self.model = model
        self.extra_headers = {}
        if site_url:
            self.extra_headers["HTTP-Referer"] = site_url
        if site_name:
            self.extra_headers["X-Title"] = site_name

    def _send_llm_request(self, messages: list[dict]) -> dict | None:
        """Sends a request to the LLM and returns a parsed JSON object."""
        response_content = None
        try:
            completion = self.client.chat.completions.create(
                extra_headers=self.extra_headers,
                model=self.model,
                messages=messages,
                response_format={"type": "json_object"},
            )
            response_content = completion.choices[0].message.content
            if not response_content:
                print("LLM returned empty content.")
                return None
            return json.loads(response_content)
        except json.JSONDecodeError as exc:
            print(f"Error decoding LLM response: {exc}\nRaw response: {response_content}")
            return None
        except Exception as exc:  # noqa: BLE001
            # Includes TypeError (e.g., invalid/missing parameters) and API errors
            print(f"An unexpected error occurred during LLM request: {exc}")
            return None
