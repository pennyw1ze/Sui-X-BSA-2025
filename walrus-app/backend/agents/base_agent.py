# src/core/base_agent.py
import json
from openai import OpenAI

class BaseAgent:
    """A base class for Agents that use an LLM, providing a shared client."""
    def __init__(self, model: str, api_key: str, site_url: str = None, site_name: str = None):
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
        )
        self.model = model
        self.extra_headers = {}
        if site_url: self.extra_headers["HTTP-Referer"] = site_url
        if site_name: self.extra_headers["X-Title"] = site_name

    def _send_llm_request(self, messages: list[dict]) -> dict | None:
        """Sends a request to the LLM and returns a parsed JSON object."""
        response_content = None
        try:
            completion = self.client.chat.completions.create(
                extra_headers=self.extra_headers,
                model=self.model,
                messages=messages,
                response_format={"type": "json_object"}
            )
            response_content = completion.choices[0].message.content
            if not response_content:
                print("LLM returned empty content.")
                return None
            return json.loads(response_content)
        except json.JSONDecodeError as e:
            print(f"Error decoding LLM response: {e}\nRaw response: {response_content}")
            return None
        except Exception as e:
            # Includes TypeError (e.g., invalid/missing parameters) and API errors
            print(f"An unexpected error occurred during LLM request: {e}")
            return None