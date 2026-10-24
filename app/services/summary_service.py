from app.services.ai_service import ai_service
from app.prompts.summary import SUMMARY_PROMPT

class SummaryService:
    def generate_summary(self, context: str, instruction: str) -> str:
        return ai_service.generate(
            capability="summary",
            prompt_template=SUMMARY_PROMPT,
            input_variables={"context": context, "input": instruction}
        )

summary_service = SummaryService()
