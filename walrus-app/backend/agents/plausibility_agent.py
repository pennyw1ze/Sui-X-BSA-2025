# src/agents/plausibility_agent.py
import os
from base_agent import BaseAgent # Assumes base_agent.py is in a sibling 'core' directory

class PlausibilityAgent(BaseAgent):
    """
    An agent that assesses the plausibility of a document's content.

    This agent's role is to act as a second-level filter after basic coherency
    has been established. It determines if the content could plausibly be from a
    real-world source (corporate, technical, etc.) or if it is likely fiction,
    spam, or nonsensical fantasy.
    """
    def __init__(self, api_key: str, site_url: str = "http://localhost:8000", site_name: str = "SuiLeakPlatform"):
        super().__init__(model="x-ai/grok-4-fast:free", api_key=api_key, site_url=site_url, site_name=site_name)
        self.system_prompt = """
        You are an AI analyst specializing in vetting leaked information. Your job is to determine if a document's content is **plausible** as a real-world document, or if it is likely fictional, nonsensical, or spam.

        ## CRITICAL DISTINCTION: Plausible vs. True
        You are NOT a fact-checker. A document's claims can be shocking, unverified, or contradict public information and STILL be plausible. Your task is to judge the *context*, not the *content's truthfulness*.

        ### PLAUSIBLE DOCUMENTS:
        - They resemble real-world documents: memos, chat logs, technical papers, financial reports, legal contracts.
        - The topics are grounded in reality: corporate dealings, technical specifications, HR issues, political discussions.
        - The language and jargon are appropriate for the purported document type.

        ### IMPLAUSIBLE DOCUMENTS:
        - **Fiction:** Contains clear elements of science fiction, fantasy, or reads like a creative story (e.g., "The starship's warp core is failing.").
        - **Absurdity:** Makes claims that are physically impossible or completely nonsensical (e.g., "Our new CEO is a sentient stapler.").
        - **Spam/Advertisement:** Is clearly trying to sell a product or service.
        - **Debunked Conspiracies:** Pertains to widely debunked, fantastical conspiracy theories (e.g., flat earth, lizard people).

        ## EXAMPLES

        ---
        INPUT:
        "Internal Chat Log: Project Nightingale. UserA: The v3.4 algorithm shows clear bias in loan approvals. UserB: Management said to push the update live regardless."
        JSON OUTPUT:
        {
          "is_plausible": true,
          "reason": "The document appears to be a plausible internal chat log discussing a realistic corporate and ethical issue.",
          "confidence": 9,
          "document_type": "Chat Log"
        }
        ---
        INPUT:
        "CONFIDENTIAL MEMO: The primary atmospheric composition of Mars is neon. Our probes confirm all water is stable at 100°C due to pressure."
        JSON OUTPUT:
        {
          "is_plausible": true,
          "reason": "While scientifically questionable, this is formatted as a plausible internal scientific or corporate memo.",
          "confidence": 8,
          "document_type": "Scientific Memo"
        }
        ---
        INPUT:
        "Log Entry: Stardate 4523.3. Captain's orders are to proceed to the Neutral Zone. The Klingons are exhibiting unusual aggression, and our dilithium crystals are running low."
        JSON OUTPUT:
        {
          "is_plausible": false,
          "reason": "The document contains language and concepts specific to science fiction (Star Trek) and is not a plausible real-world leak.",
          "confidence": 10,
          "document_type": "Fiction"
        }
        ---

        ## YOUR TASK
        Analyze the following text. Provide your response ONLY in the specified JSON format with the keys "is_plausible", "reason", "confidence", and "document_type".
        """

    def assess_plausibility(self, document_text: str, confidence_threshold: int = 7) -> dict | None:
        """
        Assesses the plausibility of the document's content.

        Args:
            document_text: The text content of the document to assess.
            confidence_threshold: The minimum confidence score (1-10) to accept the result.

        Returns:
            A dictionary containing the assessment, including a 'passed_assessment' key.
        """
        if not document_text or len(document_text.strip()) < 25:
             return {"is_plausible": False, "reason": "Input is too short to assess for plausibility.", "confidence": 10, "document_type": "Error", "passed_assessment": False}

        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": document_text}
        ]

        print("Sending document to LLM for plausibility assessment...")
        result = self._send_llm_request(messages)

        if result and "is_plausible" in result and "confidence" in result:
            if result["confidence"] >= confidence_threshold:
                result["passed_assessment"] = result["is_plausible"]
            else:
                result["passed_assessment"] = False
                # If confidence is low, we default to rejecting the document for safety.
                result["is_plausible"] = False
                result["reason"] += " (Rejected due to low confidence.)"
        else:
            return {"is_plausible": False, "reason": "Failed to get a valid response from the plausibility model.", "confidence": 0, "document_type": "Error", "passed_assessment": False}

        return result

# --- Example Usage ---
if __name__ == '__main__':
    API_KEY = os.environ.get("OPENROUTER_API_KEY")

    if not API_KEY:
        print("Error: OPENROUTER_API_KEY environment variable not set.")
    else:
        # --- Test Cases ---
        test_cases = {
            "Plausible Corporate Leak": """
                Internal Chat Log: Project Nightingale
                UserA: The v3.4 algorithm shows clear bias in loan approvals.
                UserB: Management said to push the update live regardless. The Q4 revenue increase outweighs the risk.
            """,
            "Implausible Sci-Fi": "Captain's Log, supplemental. The Enterprise has entered the Omega sector. We are detecting unusual energy readings from the gas giant, consistent with a Class-4 quantum singularity.",
            "Implausible Absurdity": "MEMO: To all staff. Effective immediately, all TPS reports must be submitted in triplicate via carrier pigeon. Our new Chief of Avian Logistics, Polly, will be overseeing the transition.",
            "Plausible but Controversial": "This document outlines the planned geo-engineering strategy for cloud-seeding over the Pacific to mitigate hurricane season. Environmental impact assessments are still pending, but the finance committee has already approved the budget.",
            "Implausible Spam": "Congratulations! You've been selected for a FREE cruise! Click here to claim your prize and enter your credit card details for a small processing fee. Limited time offer!",
            "Plausible Boring Document": "Here is the recipe for my grandmother's lasagna. First, brown one pound of ground beef with onions and garlic. Add two cans of crushed tomatoes and let simmer for at least one hour."
        }

        plausibility_agent = PlausibilityAgent(api_key=API_KEY)

        for name, doc in test_cases.items():
            print(f"--- Assessing Test Case: {name} ---")
            assessment = plausibility_agent.assess_plausibility(doc)
            print(f"Final Assessment: {assessment}")
            if assessment:
                print(f"Assessment Passed: {assessment.get('passed_assessment', False)}")
            print("-" * (len(name) + 25) + "\n")