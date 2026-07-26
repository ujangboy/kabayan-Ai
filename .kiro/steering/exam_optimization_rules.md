---
inclusion: always
---

# Exam Analyzer — Optimization Rules

These rules apply to ALL code changes in the Exam Analyzer module
(`services/exam_service.py`, `routers/exam_analyzer.py`, `routers/exam_history.py`,
`services/exam_history_service.py`, `prompts/exam_analyzer.py`, and all related frontend pages).

---

## Rule 1 — Hybrid Evaluation (MCQ/TrueFalse scored locally)

- MCQ and True/False questions are **always scored in Python**, never sent to AI.
- Compare normalized answer keys (strip, uppercase, first-char comparison).
- AI is called **only** for: Essay, Short Answer, Case Study, Analysis, Calculation.

## Rule 2 — Batched Essay Evaluation (max 5–8 per AI call)

- Never send all subjective questions in a single AI prompt.
- Batch size: **5 per call** (safe default), max 8.
- If there are more than 8 subjective questions, loop in batches and merge results.
- Each batch sends only: `question_id`, `topic`, truncated `question` (≤200 chars),
  truncated `user_answer` (≤300 chars), truncated `correct_answer` (≤200 chars).

## Rule 3 — Backend owns all calculations

AI must **never** compute:
- Final score (%)
- Grade (A/B/C/D/E)
- Total correct / wrong / unanswered
- Progress percentage
- Performance level label
- Topic summaries

All of the above are computed in Python after AI returns per-question results.

## Rule 4 — AI output scope

For subjective evaluation, AI returns **only** per-question:
```json
{
  "per_question_feedback": [
    {
      "question_id": 3,
      "is_correct": true,
      "score": 85,
      "feedback": "...",
      "explanation": "..."
    }
  ]
}
```
No grade, no score totals, no statistics in the AI response.

## Rule 5 — Simple, consistent JSON prompts

- Every AI prompt must request a **single flat JSON object**.
- No nested arrays deeper than 2 levels.
- Include explicit fallback instruction: "Jika tidak yakin, kembalikan is_correct: false dan score: 0."
- Prompts for subjective evaluation use a **minimal template** — no examples inside the template itself.

## Rule 6 — Heavy operations run after result is shown

Roadmap / study plan generation (`RECOMMENDATION_PROMPT`) is triggered **after**
the evaluation result is displayed to the user (on "Rencana Belajar" button click),
not during the submit flow. Never block the submit response with recommendation generation.

## Rule 7 — Exam History never calls AI

`ExamHistoryPage` and all `/api/history/*` endpoints read **only from the database**.
No AI calls anywhere in `exam_history_service.py` or `routers/exam_history.py`.

## Rule 8 — Retry uses metadata only

When "Latihan Lagi" triggers a new blueprint:
- Pass only: `subject_id`, `exam_type`, `difficulty`, `bloom_level`,
  `weak_topic_names` (list of strings), `total_questions`.
- Do NOT pass: full evaluation JSON, full questions list, full answers.

## Rule 9 — Independent retry for each stage

Each stage must be independently retriable:
- Scoring (local) — never fails
- Subjective AI eval — retry each batch independently; partial failure = score 0 for that batch
- Recommendation — fully independent, called lazily
- Exam History save — independent POST after eval completes

## Rule 10 — Token efficiency

- Context for question generation: **≤ 1500 words** per blueprint topic call.
- Context for analysis: **≤ 3000 words** total.
- Recommendation prompt inputs: topic names only (no full eval object).
- All text fields sent to AI are **truncated** at source before building the prompt.
