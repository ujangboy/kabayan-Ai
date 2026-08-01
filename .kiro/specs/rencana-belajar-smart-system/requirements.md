# Requirements Document

## Introduction

The Rencana Belajar Smart System enhances the Kabayan AI learning platform by replacing the existing generic 7-day study plan with a score-tiered, smart prioritization engine. The feature extends the existing `StudyPlanTab` inside the Exam History modal (`DetailModal` in `ExamAnalyzerPage.jsx`). It adds a user-editable start date to study plans, displays day labels as actual calendar dates, shows topic intensity based on exam score tiers, pulls study content from the existing `question_bank` and `materials` tables (no AI generation), and exposes a "Lihat Rencana Belajar" shortcut in `ResultView` and a date-range summary on `HistoryCard`.

---

## Glossary

- **StudyPlan**: The ORM model (`study_plans` table) that stores a 7-day personalized learning roadmap attached to an `ExamSession`.
- **StudyPlanItem**: The ORM model (`study_plan_items` table) representing one activity entry within a `StudyPlan`.
- **ExamSession**: The ORM model (`exam_sessions` table) representing one completed exam session with a score and topic analysis.
- **DetailModal**: The React modal component in `ExamAnalyzerPage.jsx` that displays session details via tabbed views, including `StudyPlanTab`.
- **StudyPlanTab**: The React tab component inside `DetailModal` that renders the stored `StudyPlan` for a session.
- **ResultView**: The React component shown immediately after an exam is submitted, displaying score and action buttons.
- **HistoryCard**: The React card component in `HistoryView` that shows a compact summary of an `ExamSession`.
- **Assessment Engine**: The Python module `services/assessment_engine.py` containing `generate_study_plan()`.
- **Score Tier**: A classification of a topic's exam score that determines study intensity: URGENT (score < 40), HIGH (40–60), MEDIUM (60–79), LOW (80+).
- **start_date**: A new nullable `Date` column on `study_plans` indicating the first day of the 7-day plan window.
- **day_label**: The `StudyPlanItem` field that stores the human-readable date label (e.g., "Senin, 23 Jun") for display.

---

## Requirements

### Requirement 1 — Score-Tiered Topic Distribution

**User Story:** As a student, I want the study plan to focus heavily on topics where I scored very low and lightly on topics where I performed well, so that I spend my limited study time where it matters most.

#### Acceptance Criteria

1. WHEN `generate_study_plan()` in `services/assessment_engine.py` is called with a list of weak topics and a score, THE Assessment Engine SHALL assign each topic a priority tier: URGENT for topics with accuracy below 40, HIGH for accuracy 40–60, MEDIUM for accuracy 60–79, and LOW for accuracy 80 or above.

2. WHEN distributing topics across the 7-day window, THE Assessment Engine SHALL allocate URGENT topics 4 study days at high intensity (60 minutes per day), HIGH topics 2 study days at standard intensity (45 minutes per day), MEDIUM topics 1 study day at light review intensity (30 minutes), and SHALL skip LOW topics entirely.

3. WHEN the total URGENT, HIGH, and MEDIUM topic days exceed 6 (leaving day 7 reserved for simulation), THE Assessment Engine SHALL truncate lower-priority topics first so that exactly 7 items are returned.

4. WHEN the total topic days are fewer than 6, THE Assessment Engine SHALL fill remaining days (up to day 6) with a "Review Umum" activity of type `review` at 30 minutes each, then place a "Simulasi Penuh" activity on day 7.

5. THE Assessment Engine SHALL always place a "Simulasi Penuh" simulation activity as the final (7th) item in the returned `study_plan` list, regardless of topic count.

6. WHEN `generate_study_plan()` returns its result, THE Assessment Engine SHALL return day labels in the format `"Hari {N}"` (e.g., "Hari 1") within the raw output; the start-date-to-real-date conversion SHALL be performed by the frontend `StudyPlanTab`.

---

### Requirement 2 — start_date Column on StudyPlan

**User Story:** As a student, I want to set the start date of my study plan so that the day labels reflect actual calendar dates matching my schedule.

#### Acceptance Criteria

1. THE Assessment Engine SHALL define an Alembic migration that adds a nullable `start_date` column of type `Date` to the `study_plans` table.

2. THE `StudyPlan` ORM model in `models.py` SHALL include a `start_date` column of type `sa.Date`, nullable, with no default.

3. WHEN `ExamService.save_study_plan()` receives a `plan_data` dict containing a `"start_date"` key with a valid ISO-8601 date string, THE ExamService SHALL parse the value and persist it in the `StudyPlan.start_date` field.

4. IF `plan_data` does not contain a `"start_date"` key, THEN THE ExamService SHALL set `StudyPlan.start_date` to `None`.

5. WHEN `ExamService.get_session_detail()` serializes a `StudyPlan` for the API response, THE ExamService SHALL include a `"start_date"` field containing the ISO-8601 string of `StudyPlan.start_date`, or `null` if the column is `None`.

---

### Requirement 3 — Always-Editable Date Picker in StudyPlanTab

**User Story:** As a student, I want to see and change the start date of my study plan at any time within the plan view, so that I can reschedule without losing my progress.

#### Acceptance Criteria

1. WHEN `StudyPlanTab` renders a non-null `plan`, THE StudyPlanTab SHALL display a date-picker input of type `date` in the plan header, pre-populated with `plan.start_date` if it exists, or today's date if `plan.start_date` is null.

2. WHEN the user changes the date-picker value, THE StudyPlanTab SHALL call `sessionsAPI.saveStudyPlan()` with the updated `start_date` and the existing plan data, then update local state to reflect the new date, without requiring a full page reload.

3. WHILE a start-date save is in progress, THE StudyPlanTab SHALL disable the date-picker input and display a loading indicator adjacent to the picker.

4. IF the start-date save API call fails, THEN THE StudyPlanTab SHALL display an inline error message below the date-picker and restore the previous date value.

---

### Requirement 4 — Real-Date Day Labels

**User Story:** As a student, I want each day in my study plan to show the actual weekday and date (e.g., "Senin, 23 Jun") rather than "Hari 1", so that I can directly align the plan with my calendar.

#### Acceptance Criteria

1. WHEN `StudyPlanTab` renders plan items and `plan.start_date` is not null, THE StudyPlanTab SHALL compute the actual date for each item by adding `item.order_number` days to `plan.start_date` and format it as `"{DayName}, {D} {MonthAbbr}"` using the Indonesian locale (e.g., "Senin, 23 Jun").

2. WHEN `StudyPlanTab` renders plan items and `plan.start_date` is null, THE StudyPlanTab SHALL display the raw `item.day_label` value (e.g., "Hari 1") without date computation.

3. THE StudyPlanTab SHALL perform all date computations client-side using JavaScript's `Date` object; no additional date library SHALL be introduced.

---

### Requirement 5 — Per-Item Skip Button

**User Story:** As a student, I want to skip a study plan item I have already covered or cannot complete, so that the plan reflects what I still need to do.

#### Acceptance Criteria

1. WHEN `StudyPlanTab` renders a plan item that is not yet completed, THE StudyPlanTab SHALL display a "Lewati" button alongside the completion checkbox for that item.

2. WHEN the user clicks the "Lewati" button, THE StudyPlanTab SHALL call `sessionsAPI.togglePlanItem()` with the item's id, which marks the item as completed on the backend.

3. WHEN a plan item is marked completed (whether via checkbox or skip), THE StudyPlanTab SHALL visually distinguish it with a strikethrough on the topic text and reduced opacity on the row.

---

### Requirement 6 — Visual Progress Bar in StudyPlanTab

**User Story:** As a student, I want to see how much of my study plan I have completed at a glance, so that I stay motivated and aware of remaining work.

#### Acceptance Criteria

1. WHEN `StudyPlanTab` renders a plan with at least one item, THE StudyPlanTab SHALL display a progress bar showing the percentage of completed items out of total items, calculated as `(completed_items / total_items) * 100`.

2. WHEN the progress value reaches 100, THE StudyPlanTab SHALL render the progress bar in a success color (green) and display a completion label "Rencana Selesai!".

3. WHEN the progress value is between 1 and 99, THE StudyPlanTab SHALL render the progress bar in the primary color and display `"{completed_days}/{total_days} hari · {progress}%"` as text.

---

### Requirement 7 — "Lihat Rencana Belajar" Button in ResultView

**User Story:** As a student, I want a single button in the result screen to save my study plan and immediately open it in the plan tab of the Detail Modal, so that I can review and start my plan without navigating away manually.

#### Acceptance Criteria

1. WHEN `ResultView` renders after a completed exam submission, THE ResultView SHALL display a "Lihat Rencana Belajar" button in the action row.

2. WHEN the user clicks "Lihat Rencana Belajar" and no study plan has been saved yet, THE ResultView SHALL first fetch the study plan data via `examAPI.getRecommendation()`, then call `sessionsAPI.saveStudyPlan()` to persist it, then navigate to the History view and open the `DetailModal` for the current session pre-selected on the "plan" tab.

3. WHEN the user clicks "Lihat Rencana Belajar" and a study plan has already been saved, THE ResultView SHALL navigate directly to open the `DetailModal` for the current session on the "plan" tab, without refetching or re-saving.

4. WHILE the save and navigation operation is in progress, THE ResultView SHALL disable the "Lihat Rencana Belajar" button and display a loading indicator inside it.

5. IF the save operation fails, THEN THE ResultView SHALL display an inline error message below the button and re-enable the button so the user can retry.

---

### Requirement 8 — Date Range Display on HistoryCard

**User Story:** As a student, I want each history card to show the study plan date range when one exists, so that I can immediately see when my plan runs without opening the detail modal.

#### Acceptance Criteria

1. WHEN `HistoryCard` renders a session where `has_study_plan` is true and the session's study plan contains a non-null `start_date`, THE HistoryCard SHALL display the date range as `"{start_date_fmt} – {end_date_fmt}"` where `end_date_fmt` is 6 days after `start_date`, formatted as `"D MMM"` in Indonesian locale (e.g., "23 Jun – 29 Jun").

2. WHEN `HistoryCard` renders a session where `has_study_plan` is true but the study plan's `start_date` is null, THE HistoryCard SHALL display only the existing study plan progress chip (e.g., "42% plan") without a date range.

3. WHEN `HistoryCard` renders a session where `has_study_plan` is false, THE HistoryCard SHALL not display any plan-related date information.

4. THE HistoryCard SHALL retrieve the `start_date` from the session list API response; THE ExamService's `get_unified_sessions()` method SHALL include `"study_plan_start_date"` in each session dict, containing the `StudyPlan.start_date` ISO string or `null`.

---

### Requirement 9 — Content References from question_bank and materials

**User Story:** As a student, I want study plan items to reference real materials or practice questions from my uploaded content, so that I know exactly which resources to use each day.

#### Acceptance Criteria

1. WHEN `generate_study_plan()` builds a study plan item for a topic that has matching rows in `question_bank` (same `subject_id` and `topic`), THE Assessment Engine SHALL set the `resources` field of that item to a string referencing the count and topic of available practice questions (e.g., "5 soal latihan tersedia untuk topik Struktur Data").

2. WHEN `generate_study_plan()` builds a study plan item for a topic that has no matching rows in `question_bank` but the subject has uploaded materials, THE Assessment Engine SHALL set the `resources` field to a generic reference to the subject's uploaded materials (e.g., "Baca materi Algoritma dan Pemrograman").

3. IF no `question_bank` rows and no materials exist for the topic, THEN THE Assessment Engine SHALL set `resources` to `"Notebook dan Flashcard di Kabayan AI."`.

4. THE Assessment Engine SHALL query `question_bank` and `materials` counts via the database session passed as a parameter to `generate_study_plan()`; THE function signature SHALL be extended to accept `db: Session` and `subject_id: int` as additional parameters.

---

### Requirement 10 — Backward Compatibility and No New Routes

**User Story:** As a developer, I want all changes to extend existing patterns without introducing new sidebar entries, new API routes, or new libraries, so that the codebase stays cohesive and maintainable.

#### Acceptance Criteria

1. THE system SHALL NOT introduce any new sidebar navigation entries or new React Router routes for this feature.

2. THE system SHALL NOT introduce any new JavaScript or Python packages beyond those already listed in `package.json` and `requirements.txt` (or equivalent).

3. WHEN saving or retrieving study plan data via the API, THE system SHALL reuse the existing endpoints `POST /exam/sessions/{id}/study-plan` and `POST /exam/sessions/plan-item/{id}/toggle` without adding new route paths.

4. THE Alembic migration for `start_date` SHALL follow the naming convention of existing migrations (numeric prefix, snake_case description) and SHALL include both `upgrade()` and `downgrade()` functions.

5. WHEN the frontend saves an updated `start_date`, THE StudyPlanTab SHALL send the full plan structure (including existing items) in the `saveStudyPlan` API call so that the backend replaces the plan atomically without losing item data.
