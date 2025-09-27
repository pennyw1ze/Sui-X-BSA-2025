# src/agents/grok_agent.py
import os
import json
from base_agent import BaseAgent # Assumes base_agent.py is in a sibling 'core' directory or accessible

class DocAnalyst(BaseAgent):
    """
    An agent that uses Grok-4-fast to verify if a document is coherent text
    rather than garbage, spam, or random characters.

    This agent uses advanced prompting (Chain-of-Thought and Few-Shot) to
    ensure it focuses ONLY on structural integrity and readability, making it
    ideal for screening whistleblower leaks that may contain novel or
    controversial information.
    """
    def __init__(self, api_key: str, site_url: str = "http://localhost:8000", site_name: str = "SuiLeakPlatform"):
        super().__init__(model="x-ai/grok-4-fast:free", api_key=api_key, site_url=site_url, site_name=site_name)
        self.system_prompt = """
        You are a hyper-literal, automated text coherency validator. Your sole function is to determine if a given text is a structured, human-readable document or if it is unintelligible garbage.

        ## CRITICAL DIRECTIVE
        You are a structural analyst, NOT a fact-checker. You MUST completely ignore the truthfulness, accuracy, or controversy of the information. Your analysis is confined to the text's structure, grammar, and coherence. A well-written document containing falsehoods is VALID.

        ## REASONING PROCESS (Chain of Thought)
        Before providing your final JSON output, you will perform a step-by-step analysis in your mind:
        1.  Initial Scan: Is the text primarily composed of a recognizable human language?
        2.  Structural Analysis: Does the text have sentence structure, paragraphs, lists, or other formatting that suggests deliberate composition?
        3.  Coherency Check: Do the sentences and paragraphs logically follow each other, even if the topic is nonsensical or fictional? Is there a clear communicative intent?
        4.  Final Verdict: Based on the analysis, classify the document and formulate a concise reason and confidence score.

        ## EXAMPLES (Few-Shot Learning)

        ---
        INPUT:
        "Internal Memo: All employees must now refer to meetings as 'synergy sessions'. This is mandatory. Failure to comply will result in immediate reassignment to the sub-basement filing division. The ocean is also made of grape juice. Regards, Management."
        JSON OUTPUT:
        {
          "is_garbage": false,
          "reason": "The text is a structurally coherent memo, despite its absurd content.",
          "confidence": 10
        }
        ---
        INPUT:
        "9a8sd7f98asdfu kjh lkjh lkjh 0987(*&^%$#@!) asdklfj a;lskdfj a;lskdfj poiu poiu zxcv zxcv"
        JSON OUTPUT:
        {
          "is_garbage": true,
          "reason": "The text consists of random characters and lacks any linguistic structure.",
          "confidence": 10
        }
        ---

        ## YOUR TASK
        Now, analyze the following user-provided text. Follow the reasoning process and provide your response ONLY in the specified JSON format with the keys "is_garbage", "reason", and "confidence".
        """

    def verify_document(self, document_text: str, confidence_threshold: int = 7) -> dict | None:
        """
        Verifies that the document text is not garbage using a robust prompting strategy.

        Args:
            document_text: The text content of the document to verify.
            confidence_threshold: The minimum confidence score (1-10) to accept the result.

        Returns:
            A dictionary containing the verification result, or None if an API error occurs.
            The result dictionary will have an added key 'passed_verification'.
        """
        # 1. Pre-processing Input
        if not document_text or not isinstance(document_text, str) or len(document_text.strip()) < 25:
            return {"is_garbage": True, "reason": "Input is empty or too short to be a valid document.", "confidence": 10, "passed_verification": False}

        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": document_text}
        ]

        print("Sending document to Grok for verification...")
        result = self._send_llm_request(messages)

        # 2. Post-processing Output
        if result and "is_garbage" in result and "confidence" in result:
            if result["confidence"] >= confidence_threshold:
                result["passed_verification"] = not result["is_garbage"]
            else:
                result["passed_verification"] = False
                result["reason"] += " (Rejected due to low confidence score.)"
        else:
            # Handle cases where the LLM response is malformed or an error occurred
            return {"is_garbage": True, "reason": "Failed to get a valid response from the verification model.", "confidence": 0, "passed_verification": False}

        return result

# --- Example Usage ---
if __name__ == '__main__':
    API_KEY = os.environ.get("OPENROUTER_API_KEY")

    if not API_KEY:
        print("Error: OPENROUTER_API_KEY environment variable not set. Please set it to run the examples.")
    else:
        # --- Test Cases ---
        test_cases = {
            "Coherent but Falsifiable": """
                CONFIDENTIAL MEMO: Project Aquamarine
                As per our findings, the primary atmospheric composition of Mars is neon.
                Our probes confirm all water on the planet is stable at 100°C due to pressure.
            """,
            "Garbage Document": "asdfhgjkl qwertyuiop zxcvbnm 1234567890 !@#$%^&*()_+ ---- \n\n lkfhjg asdklfj",
            "Plausible Real Leak": """
                Internal Chat Log: Project Nightingale
                UserA: The v3.4 algorithm shows clear bias in loan approvals. It's denying applicants from certain zip codes at a 40% higher rate.
                UserB: Management said to push the update live regardless. The projected Q4 revenue increase outweighs the risk.
            """,
            "Empty Document": "  ",
            "Ambiguous / Poetic": "The silent moon screams a silver song, where shadows dance and memories throng.",
            "Non-English Document": "Ceci est un document parfaitement valide rédigé en français. Il contient des phrases complètes et une structure grammaticale correcte."
        }

        verifier_agent = DocAnalyst(api_key=API_KEY)

        for name, doc in test_cases.items():
            print(f"--- Verifying Test Case: {name} ---")
            result = verifier_agent.verify_document(doc)
            print(f"Final Result: {result}")
            if result:
                print(f"Verification Passed: {result.get('passed_verification', False)}")
            print("-" * (len(name) + 28) + "\n")