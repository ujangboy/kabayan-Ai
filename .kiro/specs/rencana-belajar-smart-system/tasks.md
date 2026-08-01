# Implementation Plan: Rencana Belajar Smart System

## Overview

This plan upgrades the existing 7-day study plan from a generic queue-based list into a score-tiered smart engine. Changes span four layers: a DB migration adding `start_date` to `study_plans`, an enhanced `generate_study_plan()` in `assessment_engine.py`, updated `ExamService` serialization in `exam_service.py`, and enriched frontend components (`StudyPlanTab`, `ResultView`, `HistoryCard`) in `ExamAnalyzerPage.jsx`.

---

## Tasks

- [x] 1. Database — add `start_date` column to `study_plans`
  - [x] 1.1 Add `start_date` column to `StudyPlan` ORM model in `models.py`
    - Import `Date` from `sqlalchemy` at the top of `models.py`
    - Add `start_date = Column(Date, nullable=True)` to the `StudyPlan` class after the `progress` column
    - No default value; nullable
    - _Requirements: 2.2_

  - [x] 1.2 Create Alembic migration `002_add_start_date_to_study_plans.py`
    - File path: `alembic/versions/002_add_start_date_to_study_plans.py`
    - `down_revision` must reference `"cd7a10ee1930"` (latest existing migration)
    - `upgrade()`: `op.add_column("study_plans", sa.Column("start_date", sa.Date(), nullable=True))`
    - `downgrade()`: `op.drop_column("study_plans", "start_date")`
    - Follow existing naming convention (numeric prefix + snake_case description)
    - _Requirements: 2.1, 10.4_

  - [ ]* 1.3 Write property test for `start_date` round-trip persistence
    - **Property 5: start_date round-trip**
    - **Validates: Requirements 2.3, 2.4, 2.5**
    - Use `hypothesis` to generate arbitrary ISO date strings and `None` values
    - Call `ExamService.save_study_plan()` with the generated `start_date`, then call `ExamService.get_session_detail()` and assert `study_plan.start_date` equals the saved value
    - _Requirements: 2.3, 2.4, 2.5_

- [x] 2. Backend — enhance `generate_study_plan()` in `services/assessment_engine.py`
  - [x] 2.1 Implement score-tier classification and day-allocation algorithm
    - Extend the function signature to accept `db=None` and `subject_id: int = None`
    - Define tier constants: URGENT (accuracy < 40 → 4 days, 60 min), HIGH (40–59 → 2 days, 45 min), MEDIUM (60–79 → 1 day, 30 min), LOW (80+ → skip)
    - Replace the existing `weak_queue` loop with a tier-based `day_slots` builder that iterates `weak_topics` sorted worst-first, allocates per-tier days up to a cap of 6, then fills remaining slots with "Review Umum" (type `review`, 30 min)
    - Always append "Simulasi Penuh" (type `simulation`, 60 min) as the 7th slot
    - Label each slot `f"Hari {i + 1}"` with `order_number = i`
    - Set `activity` description text appropriate to tier (e.g. "Review mendalam…" for URGENT, "Latihan soal…" for HIGH/MEDIUM)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 2.2 Write property test for output length invariant (Property 1)
    - **Property 1: Output length invariant**
    - **Validates: Requirements 1.3, 1.4**
    - Use `hypothesis` to generate arbitrary lists of weak/strong topic dicts and integer scores
    - Assert `len(result["study_plan"]) == 7` for all inputs
    - _Requirements: 1.3, 1.4_

  - [ ]* 2.3 Write property test for simulation finale invariant (Property 2)
    - **Property 2: Simulation finale invariant**
    - **Validates: Requirements 1.5**
    - Use `hypothesis`; assert `result["study_plan"][-1]["type"] == "simulation"` and `result["study_plan"][-1]["topic"] == "Simulasi Penuh"`
    - _Requirements: 1.5_

  - [ ]* 2.4 Write property test for day label format invariant (Property 3)
    - **Property 3: Day label format invariant**
    - **Validates: Requirements 1.6**
    - Use `hypothesis`; assert every item at index `i` has `label == f"Hari {i + 1}"`
    - _Requirements: 1.6_

  - [ ]* 2.5 Write property test for score-tier day allocation (Property 4)
    - **Property 4: Score-tier day allocation**
    - **Validates: Requirements 1.1, 1.2**
    - Use `hypothesis` to generate weak_topic dicts with varying accuracy values; assert that for any topic appearing in the output, its day-count and `duration_minutes` match the tier table
    - _Requirements: 1.1, 1.2_

  - [x] 2.6 Implement resources lookup from `question_bank` and `materials`
    - When `db` and `subject_id` are provided:
      - Query `QuestionBank` count for `subject_id` + `topic`; if count > 0, set `resources = f"{count} soal latihan tersedia untuk topik {topic}"`
      - Else query `Material` count for `subject_id`; if count > 0, set `resources = f"Baca materi {subject_name}"`
      - Else set `resources = "Notebook dan Flashcard di Kabayan AI."`
    - Import `QuestionBank` and `Material` models at the top of `assessment_engine.py`
    - When `db` or `subject_id` is `None`, fall back to current generic string
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 2.7 Write property test for resources field selection (Property 7)
    - **Property 7: Resources field selection**
    - **Validates: Requirements 9.1, 9.2, 9.3**
    - Use `hypothesis` with mocked DB that returns varying counts; assert correct `resources` string per scenario
    - _Requirements: 9.1, 9.2, 9.3_

- [-] 3. Checkpoint — backend engine
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Backend — update `ExamService` serialization in `services/exam_service.py`
  - [x] 4.1 Update `save_study_plan()` to parse and persist `start_date`
    - Parse `plan_data.get("start_date")` using `datetime.date.fromisoformat(str(raw_date)[:10])` wrapped in try/except; default to `None` on failure
    - Pass `start_date=start_date_val` when constructing the `StudyPlan` ORM object
    - _Requirements: 2.3, 2.4_

  - [x] 4.2 Update `get_session_detail()` to serialize `start_date`
    - In the `plan_data` dict, add `"start_date": s.plan.start_date.isoformat() if s.plan.start_date else None`
    - _Requirements: 2.5_

  - [x] 4.3 Update `get_unified_sessions()` to include `study_plan_start_date`
    - In the `result.append(...)` dict, add `"study_plan_start_date": plan.start_date.isoformat() if (plan and plan.start_date) else None`
    - _Requirements: 8.4_

  - [x] 4.4 Update `get_recommendation()` to pass `db` and `subject_id` to `generate_study_plan()`
    - Change the `generate_study_plan(...)` call to include `db=db` and `subject_id=session.subject_id`
    - _Requirements: 9.4_

  - [ ]* 4.5 Write property test for `study_plan_start_date` in unified sessions (Property 6)
    - **Property 6: study_plan_start_date in unified sessions**
    - **Validates: Requirements 8.4**
    - Use `hypothesis` to generate sessions with varying `start_date` values; assert `"study_plan_start_date"` key is always present and equals the ISO string or `null`
    - _Requirements: 8.4_

- [ ] 5. Frontend — enhance `StudyPlanTab` in `ExamAnalyzerPage.jsx`
  - [~] 5.1 Add start-date state, date picker, and `handleDateChange` handler
    - Add `startDate` state initialized to `plan?.start_date || today` (today = `new Date().toISOString().split('T')[0]`)
    - Add `dateSaving` and `dateError` state
    - Add `handleDateChange(newDate)` async function that sends the full plan payload via `sessionsAPI.saveStudyPlan()`, updates `startDate` on success, restores previous value on error, and shows inline error
    - Render a date picker `<input type="date">` in the plan header with `<Calendar>` icon, `<Loader2>` spinner during save, and error paragraph below
    - Accept `sessionId` and `onPlanSaved` as new props from `DetailModal`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [~] 5.2 Add real-date label computation and "Lewati" skip button
    - Add `formatItemDate(startDateStr, orderNumber)` helper using `DAYS_ID` and `MONTHS_ID` Indonesian locale arrays (no new libraries)
    - In the item render loop, compute `dateLabel = plan.start_date ? formatItemDate(startDate, item.order_number) : item.day_label`
    - Display `dateLabel` instead of the raw `item.day_label`
    - For each incomplete item, render a "Lewati" button that calls `onToggle(item.id)` — styled with `border-border hover:border-warning/40 hover:text-warning`
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_

  - [~] 5.3 Add visual progress bar with percentage and completion label
    - Compute `completedItems` and `totalItems` from `plan.items`
    - Compute `progressValue = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0`
    - Replace the existing static progress display with dynamic values
    - When `progressValue >= 100`, render `ProgressBar` with `color="success"` and label "🎉 Rencana Selesai!"
    - When `progressValue < 100`, render `ProgressBar` with `color="primary"` and label `"{completedItems}/{totalItems} hari · {progressValue}%"`
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 5.4 Write property test for progress percentage correctness (Property 8)
    - **Property 8: Progress percentage correctness**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Use `fast-check` to generate N and K (0 ≤ K ≤ N, N > 0) values; render `StudyPlanTab` in a test environment and assert `progressValue == Math.round((K / N) * 100)` and correct color/label
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 5.5 Write property test for real-date label calculation (Property 9)
    - **Property 9: Real-date label calculation**
    - **Validates: Requirements 4.1**
    - Use `fast-check` to generate ISO date strings and `order_number` values (0–6); assert `formatItemDate(startDate, orderNumber)` returns `"{DayName}, {D} {MonthAbbr}"` in Indonesian locale
    - _Requirements: 4.1_

- [ ] 6. Frontend — add "Lihat Rencana Belajar" button to `ResultView` and lift state in `ExamAnalyzerPage`
  - [~] 6.1 Add `planSaved`, `loadingPlanNav`, `planNavError` state and `handleLihatRencana` handler in `ResultView`
    - Add `planSaved`, `loadingPlanNav`, `planNavError` state to `ResultView`
    - Implement `handleLihatRencana`: if plan already saved (`planSaved || saved`), call `onFinish()` and `onOpenPlanTab()`; otherwise fetch via `examAPI.getRecommendation()`, save via `sessionsAPI.saveStudyPlan()`, set `planSaved(true)`, then call both callbacks
    - Render a "Lihat Rencana Belajar" `<button>` in the action row with `<Calendar>` icon; show `<Loader2>` while `loadingPlanNav` is true; show inline error paragraph on failure
    - Accept `onOpenPlanTab` as a new prop
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [~] 6.2 Lift `detailId` and pre-set `tab` state in `ExamAnalyzerPage` and wire `onOpenPlanTab`
    - Lift `detailId` state from `HistoryView` into `ExamAnalyzerPage` (or pass it down via callback)
    - Add `pendingPlanTab` state to `ExamAnalyzerPage` that pre-sets the modal tab to `'plan'` when navigating from `ResultView`
    - Pass `onOpenPlanTab` to `ResultView` as `() => { setPendingPlanTab(true); setDetailId(sessionData.session_id); }`
    - In `HistoryView`/`DetailModal`, read `pendingPlanTab` to open on the `'plan'` tab, then clear it
    - Pass `sessionId` prop to `StudyPlanTab` from `DetailModal` for the date picker save call
    - _Requirements: 7.2, 7.3, 10.1, 10.3_

- [ ] 7. Frontend — add date range display to `HistoryCard`
  - [~] 7.1 Render date range chip in `HistoryCard` when `study_plan_start_date` is present
    - Define `MONTHS_ID` array inline in the render (no new library)
    - Compute `start` and `end` (`start + 6 days`) from `s.study_plan_start_date`
    - Format each as `"{D} {MonthAbbr}"` using `MONTHS_ID`
    - Render below the study plan progress chip as `<span>` with `<Calendar size={9}/>` icon: `"D MMM – D MMM"`
    - Show only when `s.has_study_plan && s.study_plan_start_date`
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 7.2 Write property test for HistoryCard date-range correctness (Property 10)
    - **Property 10: HistoryCard date-range correctness**
    - **Validates: Requirements 8.1**
    - Use `fast-check` to generate ISO date strings for `study_plan_start_date`; render `HistoryCard` and assert the displayed date range equals `formatDate(start) + " – " + formatDate(start + 6 days)` in Indonesian locale
    - _Requirements: 8.1_

- [~] 8. Final checkpoint — integration
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at critical integration points
- The design specifies 10 correctness properties — each property-based test sub-task maps to exactly one property
- No new routes, sidebar entries, or third-party libraries are introduced (Requirement 10)
- The Alembic migration must be run (`alembic upgrade head`) before the backend changes take effect

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "4.1", "4.2", "4.3"] },
    { "id": 3, "tasks": ["1.3", "2.2", "2.3", "2.4", "2.5", "4.4", "4.5"] },
    { "id": 4, "tasks": ["2.6"] },
    { "id": 5, "tasks": ["2.7"] },
    { "id": 6, "tasks": ["5.1", "5.3", "6.1", "7.1"] },
    { "id": 7, "tasks": ["5.2", "5.4", "5.5", "6.2", "7.2"] }
  ]
}
```
