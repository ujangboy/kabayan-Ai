from services.ai_service import ai_service
from prompts.summary import SUMMARY_PROMPT

class SummaryService:
    @staticmethod
    def generate_summary(context: str, instruction: str) -> str:
        return ai_service.generate(
            capability="summary",
            prompt_template=SUMMARY_PROMPT,
            input_variables={"context": context, "input": instruction}
        )

summary_service = SummaryService()
