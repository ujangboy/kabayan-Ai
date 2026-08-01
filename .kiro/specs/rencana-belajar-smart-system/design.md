# Design Document

## Feature: Rencana Belajar Smart System

---

## Overview

This feature upgrades the existing 7-day study plan from a generic queue-based list into a smart, score-tiered engine. The changes are distributed across three layers:

1. **Database** – Alembic migration adding `start_date DATE` to `study_plans`
2. **Backend** – Enhanced `generate_study_plan()` with score-tier logic + DB queries; updated `ExamService` serialization
3. **Frontend** – `StudyPlanTab`, `ResultView`, and `HistoryCard` UI enhancements

No new routes, sidebar entries, or third-party libraries are introduced.

---

## Architecture

### Component Diagram

```
ExamAnalyzerPage.jsx
│
├── ResultView
│   └── [Lihat Rencana Belajar] button
│       → examAPI.getRecommendation()
│       → sessionsAPI.saveStudyPlan()
│       → navigate to HistoryView, open DetailModal (tab=plan)
│
├── HistoryView
│   ├── HistoryCard         ← shows date range if start_date present
│   └── DetailModal
│       └── StudyPlanTab    ← date picker, real-date labels, skip button, progress bar
│
└── services/api.js
    └── sessionsAPI.saveStudyPlan(sessionId, planData)
        └── POST /exam/sessions/{id}/study-plan

FastAPI Backend
└── exam_analyzer.router
    └── POST /exam/sessions/{id}/study-plan
        └── ExamService.save_study_plan()
            └── parses start_date, persists StudyPlan

    └── GET /exam/sessions/{id}
        └── ExamService.get_session_detail()
            └── serializes plan.start_date

    └── GET /exam/sessions
        └── ExamService.get_unified_sessions()
            └── includes study_plan_start_date

    └── GET /exam/recommendation/{id}
        └── ExamService.get_recommendation()
            └── generate_study_plan(weak_topics, strong_topics, score,
                                    subject_name, db, subject_id)

services/assessment_engine.py
└── generate_study_plan(weak_topics, strong_topics, score,
                        subject_name, db, subject_id)
    ├── Score-tier classification (URGENT/HIGH/MEDIUM/LOW)
    ├── Day allocation (4/2/1/0 days per tier)
    ├── Gap-filling with "Review Umum"
    ├── Day 7 = "Simulasi Penuh"
    └── resources from question_bank → materials → fallback
```

---

## Data Models

### StudyPlan (modified)

```python
class StudyPlan(Base):
    __tablename__ = "study_plans"
    id                    = Column(Integer, primary_key=True, index=True)
    session_id            = Column(Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), index=True)
    title                 = Column(String, nullable=True)
    motivational_message  = Column(Text, nullable=True)
    priority_actions_json = Column(Text, nullable=True)
    total_days            = Column(Integer, default=7)
    completed_days        = Column(Integer, default=0)
    progress              = Column(Integer, default=0)
    start_date            = Column(Date, nullable=True)   # NEW
    created_at            = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at            = Column(DateTime, default=datetime.datetime.utcnow,
                                   onupdate=datetime.datetime.utcnow)
```

### Alembic Migration

```python
# alembic/versions/002_add_start_date_to_study_plans.py
def upgrade() -> None:
    op.add_column("study_plans",
        sa.Column("start_date", sa.Date(), nullable=True))

def downgrade() -> None:
    op.drop_column("study_plans", "start_date")
```

---

## Backend Components

### `generate_study_plan()` — Enhanced Signature and Logic

```python
def generate_study_plan(
    weak_topics: List[dict],
    strong_topics: List[dict],
    score: int,
    subject_name: str = "Mata Kuliah",
    total_days: int = 7,
    db=None,           # Optional[Session]
    subject_id: int = None,
) -> dict:
    ...
```

#### Score-Tier Classification

| Accuracy | Tier    | Days | Duration |
|----------|---------|------|----------|
| < 40     | URGENT  | 4    | 60 min   |
| 40–59    | HIGH    | 2    | 45 min   |
| 60–79    | MEDIUM  | 1    | 30 min   |
| 80+      | LOW     | 0    | (skip)   |

#### Day-Building Algorithm

```python
# Pseudocode
day_slots = []
for topic in weak_topics (sorted worst-first):
    tier = classify_tier(topic.accuracy)
    if tier == LOW: continue
    days  = TIER_DAYS[tier]
    dur   = TIER_DURATION[tier]
    for d in range(days):
        if len(day_slots) < 6:
            day_slots.append({topic, tier_activity_type, dur})
        # else: truncate (lower-priority topics dropped first because
        #        weak_topics is sorted worst-first, so later = lower priority)

# Fill remaining slots up to 6 with Review Umum
while len(day_slots) < 6:
    day_slots.append({"Review Umum", "review", 30})

# Day 7 always Simulasi Penuh
day_slots.append({"Simulasi Penuh", "simulation", 60})

# Label each slot
for i, slot in enumerate(day_slots):
    slot["label"] = f"Hari {i + 1}"
    slot["order_number"] = i
```

#### Resources Lookup

```python
if db and subject_id:
    count = db.query(QuestionBank).filter_by(
        subject_id=subject_id, topic=topic).count()
    if count > 0:
        resources = f"{count} soal latihan tersedia untuk topik {topic}"
    else:
        mat_count = db.query(Material).filter_by(
            subject_id=subject_id).count()
        if mat_count > 0:
            # get subject name for the message
            resources = f"Baca materi {subject_name}"
        else:
            resources = "Notebook dan Flashcard di Kabayan AI."
else:
    resources = f"Materi {subject_name} — topik {topic}."
```

### `ExamService.save_study_plan()` — start_date Handling

```python
@staticmethod
def save_study_plan(db: Session, session_id: int, plan_data: dict) -> dict:
    # Parse start_date
    raw_date = plan_data.get("start_date")
    start_date_val = None
    if raw_date:
        try:
            start_date_val = datetime.date.fromisoformat(str(raw_date)[:10])
        except (ValueError, TypeError):
            start_date_val = None

    plan = StudyPlan(
        session_id=session_id,
        ...
        start_date=start_date_val,   # NEW
    )
```

### `ExamService.get_session_detail()` — start_date in plan serialization

```python
plan_data = {
    "id": s.plan.id,
    ...
    "start_date": s.plan.start_date.isoformat() if s.plan.start_date else None,  # NEW
    "items": [...],
}
```

### `ExamService.get_unified_sessions()` — study_plan_start_date

```python
result.append({
    ...
    "has_study_plan": plan is not None,
    "study_plan_progress": plan.progress if plan else 0,
    "study_plan_start_date": plan.start_date.isoformat() if (plan and plan.start_date) else None,  # NEW
    ...
})
```

### `ExamService.get_recommendation()` — pass db and subject_id

```python
return generate_study_plan(
    weak_topics=eval_data.get("weak_topics", []),
    strong_topics=eval_data.get("strong_topics", []),
    score=eval_data.get("score", 0),
    subject_name=subject_name,
    db=db,               # NEW
    subject_id=session.subject_id,  # NEW
)
```

---

## Frontend Components

### `StudyPlanTab` — Enhanced

```jsx
function StudyPlanTab({ plan, sessionId, onToggle, onPlanSaved }) {
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(plan?.start_date || today);
  const [dateSaving, setDateSaving] = useState(false);
  const [dateError, setDateError] = useState('');

  // Date formatting helpers — no new libraries, pure JS
  const DAYS_ID   = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  function formatItemDate(startDateStr, orderNumber) {
    const d = new Date(startDateStr);
    d.setDate(d.getDate() + orderNumber);
    return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]}`;
  }

  async function handleDateChange(newDate) {
    const prevDate = startDate;
    setStartDate(newDate);
    setDateSaving(true); setDateError('');
    try {
      // Send full plan structure with updated start_date
      const planPayload = {
        title: plan.title,
        motivational_message: plan.motivational_message,
        priority_actions: plan.priority_actions,
        start_date: newDate,
        study_plan: plan.items.map(item => ({
          label: item.day_label,
          topic: item.topic,
          activity: item.activity,
          type: item.activity_type,
          duration_minutes: item.duration_minutes,
          resources: item.resources,
        })),
      };
      await sessionsAPI.saveStudyPlan(sessionId, planPayload);
      onPlanSaved && onPlanSaved();
    } catch (e) {
      setStartDate(prevDate);
      setDateError('Gagal menyimpan tanggal. Coba lagi.');
    } finally { setDateSaving(false); }
  }
  // ... render
}
```

#### Date Picker in Header

```jsx
<div className="flex items-center gap-2 mb-4">
  <Calendar size={14} className="text-primary" />
  <span className="text-xs font-semibold text-text-secondary">Mulai Belajar:</span>
  <input
    type="date"
    value={startDate}
    onChange={e => handleDateChange(e.target.value)}
    disabled={dateSaving}
    className="px-2 py-1 bg-card border border-border rounded-lg text-xs text-text
               focus:outline-none focus:border-primary disabled:opacity-50"
  />
  {dateSaving && <Loader2 size={12} className="animate-spin text-primary" />}
</div>
{dateError && <p className="text-danger text-xs mb-2">{dateError}</p>}
```

#### Real-Date Labels and Skip Button

```jsx
{(plan.items || []).map((item) => {
  const dateLabel = plan.start_date
    ? formatItemDate(startDate, item.order_number)
    : item.day_label;
  return (
    <div key={item.id}
      className={cn('flex items-start gap-3 p-3 rounded-xl border transition-all',
        item.completed ? 'bg-success/5 border-success/20 opacity-70' : 'bg-card border-border')}>
      {/* Completion checkbox */}
      <button onClick={() => onToggle(item.id)} ... />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-text-muted">{dateLabel}</span>
          {/* chips, duration */}
        </div>
        <p className={cn("text-sm font-medium text-text", item.completed && "line-through")}>
          {item.topic}
        </p>
        {item.activity && <p className="text-xs text-text-secondary">{item.activity}</p>}
      </div>
      {/* Skip button — only for incomplete items */}
      {!item.completed && (
        <button onClick={() => onToggle(item.id)}
          className="text-[10px] px-2 py-0.5 rounded border border-border text-text-muted
                     hover:border-warning/40 hover:text-warning transition-colors shrink-0">
          Lewati
        </button>
      )}
    </div>
  );
})}
```

#### Progress Bar

```jsx
const completedItems = (plan.items || []).filter(i => i.completed).length;
const totalItems     = (plan.items || []).length;
const progressValue  = totalItems > 0
  ? Math.round((completedItems / totalItems) * 100)
  : 0;

<div className="flex justify-between text-xs text-text-muted mb-1">
  <span>Progress Rencana Belajar</span>
  <span>
    {progressValue >= 100
      ? '🎉 Rencana Selesai!'
      : `${completedItems}/${totalItems} hari · ${progressValue}%`}
  </span>
</div>
<ProgressBar
  value={progressValue}
  color={progressValue >= 100 ? 'success' : 'primary'}
/>
```

---

### `ResultView` — "Lihat Rencana Belajar" Button

```jsx
// State additions
const [planSaved, setPlanSaved]           = useState(false);
const [loadingPlanNav, setLoadingPlanNav] = useState(false);
const [planNavError, setPlanNavError]     = useState('');

const handleLihatRencana = async () => {
  setPlanNavError('');
  if (planSaved || saved) {
    // Plan already saved — navigate directly
    onFinish && onFinish();           // goes to HistoryView
    onOpenPlanTab && onOpenPlanTab(); // parent sets detailId + tab='plan'
    return;
  }
  setLoadingPlanNav(true);
  try {
    const rr = await examAPI.getRecommendation(sessionId);
    if (!rr.data || rr.data.detail) throw new Error(rr.data?.detail || 'Gagal ambil rencana');
    await sessionsAPI.saveStudyPlan(sessionId, rr.data);
    setPlanSaved(true);
    onFinish && onFinish();
    onOpenPlanTab && onOpenPlanTab();
  } catch (e) {
    setPlanNavError(e.message || 'Gagal menyimpan rencana belajar.');
  } finally { setLoadingPlanNav(false); }
};
```

```jsx
{/* Action buttons row */}
<button
  onClick={handleLihatRencana}
  disabled={loadingPlanNav}
  className="btn-ghost text-sm border border-border">
  {loadingPlanNav
    ? <><Loader2 size={13} className="animate-spin"/> Menyimpan...</>
    : <><Calendar size={13}/> Lihat Rencana Belajar</>}
</button>
{planNavError && <p className="text-danger text-xs">{planNavError}</p>}
```

Parent (`ExamAnalyzerPage`) needs to pass `onOpenPlanTab` — handled by lifting state for `detailId` and pre-setting tab to `'plan'` before transitioning to `VIEW.HISTORY`.

---

### `HistoryCard` — Date Range Display

```jsx
// In HistoryCard component, after the study plan progress chip:
{s.has_study_plan && s.study_plan_start_date && (() => {
  const MONTHS_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const start = new Date(s.study_plan_start_date);
  const end   = new Date(s.study_plan_start_date);
  end.setDate(end.getDate() + 6);
  const fmt = (d) => `${d.getDate()} ${MONTHS_ID[d.getMonth()]}`;
  return (
    <span className="text-[10px] text-text-muted flex items-center gap-1">
      <Calendar size={9}/> {fmt(start)} – {fmt(end)}
    </span>
  );
})()}
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `start_date` in `plan_data` is not a valid ISO date | Backend silently sets `start_date = None`, no 400 error |
| `db` or `subject_id` not passed to `generate_study_plan()` | Falls back to generic resources string (backward compatible) |
| Date-picker save API call fails | Frontend shows inline error, restores previous date value |
| "Lihat Rencana Belajar" fetch or save fails | Inline error message shown, button re-enabled for retry |
| `study_plan` query returns no plan in `get_unified_sessions` | `study_plan_start_date` returns `null` safely |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Output length invariant

*For any* combination of weak_topics and strong_topics passed to `generate_study_plan()`, the returned `study_plan` list SHALL always contain exactly 7 items.

**Validates: Requirements 1.3, 1.4**

---

### Property 2: Simulation finale invariant

*For any* call to `generate_study_plan()` regardless of inputs, the last item (index 6) in the returned `study_plan` SHALL have `type == "simulation"` and `topic == "Simulasi Penuh"`.

**Validates: Requirements 1.5**

---

### Property 3: Day label format invariant

*For any* call to `generate_study_plan()`, every item at index `i` in the returned `study_plan` SHALL have `label == f"Hari {i + 1}"`.

**Validates: Requirements 1.6**

---

### Property 4: Score-tier day allocation

*For any* topic in `weak_topics` with a known accuracy value, if that topic appears as a study day in the output, the number of days dedicated to it and the `duration_minutes` of each day SHALL match the tier rule: accuracy < 40 → up to 4 days at 60 min, accuracy 40–59 → up to 2 days at 45 min, accuracy 60–79 → 1 day at 30 min, accuracy ≥ 80 → 0 days (topic skipped).

**Validates: Requirements 1.1, 1.2**

---

### Property 5: start_date round-trip

*For any* ISO date string (including `None`) passed as `start_date` in `plan_data` to `ExamService.save_study_plan()`, querying the session detail via `ExamService.get_session_detail()` SHALL return a `study_plan.start_date` value equal to the originally saved value (as an ISO string or `null`).

**Validates: Requirements 2.3, 2.4, 2.5**

---

### Property 6: study_plan_start_date in unified sessions

*For any* session that has an associated `StudyPlan` with any `start_date` value (including `None`), the dict returned by `ExamService.get_unified_sessions()` for that session SHALL include a `"study_plan_start_date"` key whose value equals the plan's `start_date` as an ISO string or `null`.

**Validates: Requirements 8.4**

---

### Property 7: Resources field selection

*For any* topic passed to `generate_study_plan()` when `db` and `subject_id` are provided, the `resources` field in the returned study plan item for that topic SHALL be the count-based practice question string when `question_bank` rows exist for the topic, the material-reference string when no bank rows but materials exist, and the default fallback string when neither exists.

**Validates: Requirements 9.1, 9.2, 9.3**

---

### Property 8: Progress percentage correctness

*For any* `StudyPlanTab` render state with N total items and K completed items (0 ≤ K ≤ N, N > 0), the progress bar value displayed SHALL equal `round((K / N) * 100)`, the bar color SHALL be success when K == N, and SHALL be primary when K < N.

**Validates: Requirements 6.1, 6.2, 6.3**

---

### Property 9: Real-date label calculation

*For any* non-null `start_date` and `order_number` in `StudyPlanTab`, the displayed day label SHALL equal the Indonesian-locale formatted date obtained by adding `order_number` days to `start_date`, in the format `"{DayName}, {D} {MonthAbbr}"`.

**Validates: Requirements 4.1**

---

### Property 10: HistoryCard date-range correctness

*For any* session with a non-null `study_plan_start_date`, the date range displayed on `HistoryCard` SHALL show `start_date` formatted as `"D MMM"` and `start_date + 6 days` formatted as `"D MMM"` (Indonesian locale), joined with " – ".

**Validates: Requirements 8.1**
