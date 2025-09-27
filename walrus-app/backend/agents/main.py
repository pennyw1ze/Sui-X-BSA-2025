# src/main.py
import os
import sys

# This allows the script to find the modules in sibling directories
# Add the 'src' directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from base_agent import BaseAgent
from document_coherence_agent import DocAnalyst
from plausibility_agent import PlausibilityAgent

class VerificationPipeline:
    """
    Orchestrates a two-stage document verification process using specialized AI agents.
    """
    def __init__(self, api_key: str):
        """
        Initializes the pipeline and all required agents.
        """
        if not api_key:
            raise ValueError("API key is required to initialize the verification pipeline.")
        print("Initializing verification agents...")
        self.coherency_agent = DocAnalyst(api_key=api_key)
        self.plausibility_agent = PlausibilityAgent(api_key=api_key)
        print("Agents initialized successfully.")

    def run(self, document_text: str) -> dict:
        """
        Executes the full two-stage verification pipeline.

        Args:
            document_text: The raw text of the document to be verified.

        Returns:
            A dictionary containing the results of each stage and the final decision.
        """
        print("\n" + "="*50)
        print("Starting new document verification pipeline...")
        print("="*50)

        # --- STAGE 1: Coherency and Structural Analysis ---
        print("\n--- [STAGE 1] Running Coherency Analysis ---")
        coherency_result = self.coherency_agent.verify_document(document_text)
        print(f"Coherency Agent Output: {coherency_result}")

        if not coherency_result or not coherency_result.get("passed_verification"):
            print("\n--- [RESULT] STAGE 1 FAILED. Document is not coherent or is garbage. ---")
            final_decision = {
                "final_verdict": "REJECTED",
                "reason": f"Failed coherency check: {coherency_result.get('reason', 'Unknown error.')}",
                "coherency_analysis": coherency_result,
                "plausibility_analysis": None
            }
            print("="*50)
            print("Pipeline finished.")
            return final_decision

        print("\n--- [RESULT] STAGE 1 PASSED. Document is structurally coherent. ---")

        # --- STAGE 2: Content Plausibility Assessment ---
        print("\n--- [STAGE 2] Running Plausibility Assessment ---")
        plausibility_result = self.plausibility_agent.assess_plausibility(document_text)
        print(f"Plausibility Agent Output: {plausibility_result}")

        if not plausibility_result or not plausibility_result.get("passed_assessment"):
            print("\n--- [RESULT] STAGE 2 FAILED. Document content is not plausible. ---")
            final_decision = {
                "final_verdict": "REJECTED",
                "reason": f"Failed plausibility check: {plausibility_result.get('reason', 'Unknown error.')}",
                "coherency_analysis": coherency_result,
                "plausibility_analysis": plausibility_result
            }
            print("="*50)
            print("Pipeline finished.")
            return final_decision

        print("\n--- [RESULT] STAGE 2 PASSED. Document content is plausible. ---")

        # --- FINAL DECISION ---
        print("\n" + "*"*50)
        print(">>> FINAL VERDICT: DOCUMENT ACCEPTED <<<")
        print("The document has passed all verification stages and is ready for the next step.")
        print("*"*50)
        final_decision = {
            "final_verdict": "ACCEPTED",
            "reason": "Document passed both coherency and plausibility checks.",
            "coherency_analysis": coherency_result,
            "plausibility_analysis": plausibility_result
        }
        print("Pipeline finished.")
        return final_decision


def load_document_from_source(name: str, content: str) -> dict:
    """Mock function to simulate loading a document."""
    print(f"\n{'='*20} Loading Document: '{name}' {'='*20}")
    # In a real app, this would read from a file, database, or API request
    return {"name": name, "content": content}


if __name__ == '__main__':
    # Load API key from environment variable
    API_KEY = os.environ.get("OPENROUTER_API_KEY")

    if not API_KEY:
        print("FATAL ERROR: The 'OPENROUTER_API_KEY' environment variable is not set.")
        sys.exit(1)

    # --- Define a comprehensive set of test cases ---
    test_documents = {
        "Valid Leak": """
            Internal Chat Log Transcript: Project Nightingale
            UserA: The algorithm's v3.4 update is showing a clear bias in loan approvals.
            We tested it on the holdback dataset. It's denying applicants from specific zip codes
            at a 40% higher rate, even with identical credit scores.
            UserB: Management is aware. The directive is to push the update live regardless.
            They said the projected Q4 revenue increase outweighs the legal and ethical risks.
        """,
        "Garbage Text": "alksdjf;laskdjf lasdkjflk jlkjzxcoivupoiu 903485-2345(*&^%)",
        "Coherent Nonsense": "MEMO: To all staff. Effective immediately, our new Chief of Morale, a sentient stapler named Stanley, requires all TPS reports to be submitted via carrier pigeon. The ocean is also made of grape juice.",
        "Sci-Fi Fiction": "Captain's Log, Stardate 4523.3. The Enterprise has entered the Omega sector. We are detecting unusual energy readings from the gas giant, consistent with a Class-4 quantum singularity. Recommend we proceed with caution.",
        "Valid but Boring": "This is the recipe for my grandmother's award-winning lasagna. First, brown one pound of ground beef with onions and garlic. Add two cans of crushed tomatoes, a teaspoon of oregano, and let simmer for at least one hour.",
        "Too Short": "This is a test."
    }

    try:
        # --- Initialize and run the pipeline ---
        pipeline = VerificationPipeline(api_key=API_KEY)

        for name, content in test_documents.items():
            doc = load_document_from_source(name, content)
            final_result = pipeline.run(doc["content"])
            # The final_result dictionary contains all the details if needed
            # For this demo, we just print the process.

    except ValueError as e:
        print(f"Initialization Error: {e}")
    except Exception as e:
        print(f"An unexpected error occurred during the pipeline execution: {e}")