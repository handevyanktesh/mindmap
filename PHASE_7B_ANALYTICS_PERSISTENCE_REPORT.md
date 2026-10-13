# MindMap Phase 7B â€” Privacy-Preserving Analytics Persistence Report

**Degree / Project Level:** Final-Year B.Tech Computer Science & Engineering (AI / ML)
**System Title:** MindMap â€” Real-Time Non-Invasive Student Behaviour Analysis for Virtual Classrooms
**Document Purpose:** Verification and architectural report on the implementation of privacy-preserving session analytics persistence, 1-minute discrete time buckets, teacher historical logging, and genuine session report rendering.
**Baseline Git Commit:** `1d74a39`
**Phase Completed:** Phase 7B

---

## 1. Executive Summary & Objective

In Phase 7A, an exhaustive audit revealed that:
1. The Teacher Dashboard displayed hardcoded synthetic rows (`Calculus I (Lecture 14)`, `82% avgAttention`, `18% peakConfusion`).
2. Concluded session reports relied exclusively on volatile browser `sessionStorage` (`mindmap_session_summary_${sessionId}`), causing charts to render empty states whenever reports were accessed in a new tab, incognito session, or from a different computer.
3. Telemetry received over WebSocket was never persisted to MongoDB, preventing instructors from analyzing longitudinal cohort engagement or historical trends.

### Phase 7B Achievements
Phase 7B successfully eliminated mock historical data and ephemeral-only reports by implementing **authoritative, server-side, privacy-preserving analytics persistence**:
- **Strict Privacy Invariant:** Zero raw webcam frames, landmark coordinates, EAR, gaze vectors, head pose data, or individual student biometric logs are transmitted or persisted to MongoDB.
- **1-Minute Time Bucketing:** Incoming student derived states are aggregated into discrete 60-second time buckets with sample counts, valid observation percentages, and explicit data quality indicators.
- **Missing vs. Zero Observations:** Missing samples are represented as `null` (`None`), never fabricated or coerced to `0%`. Conversely, true zero confusion is explicitly recorded as `0.0%`.
- **Deduplication & Staleness Guard:** WebSocket telemetry is debounced (minimum 250ms interval per student) and out-of-order/stale client timestamps (>15s deviation) are normalized against server UTC.
- **Bounded Retention:** Configured MongoDB TTL indexes enforcing a 90-day retention policy for 1-minute bucket timeseries.
- **Teacher Ownership & Authorization:** Strict server-side verification ensures teachers cannot query another teacher's sessions or classrooms (HTTP 403 Forbidden).
- **100% Test Pass Rate:** All 25 backend tests (`pytest`) passed; frontend production build (`vite build`) passed without errors.

---

## 2. Schema and Aggregation Rules

### 2.1 One-Minute Analytics Bucket Schema
*MongoDB Collection:* `session_analytics_buckets`
*Index Policy:* Compound unique index on `("session_id", 1), ("bucket_index", 1)`; TTL index on `start_time` (90 days).

```json
{
  "_id": "sess_123_b0",
  "id": "sess_123_b0",
  "session_id": "sess_123",
  "classroom_id": "cls_456",
  "bucket_index": 0,
  "start_time": "2026-10-13T10:00:00Z",
  "end_time": "2026-10-13T10:01:00Z",
  "reporting_students": 24,
  "total_samples": 72,
  "normal_count": 58,
  "reduced_count": 10,
  "uncertain_engagement_count": 4,
  "low_confusion_count": 64,
  "elevated_confusion_count": 4,
  "uncertain_confusion_count": 4,
  "normal_pct": 80.6,
  "reduced_pct": 13.9,
  "uncertain_engagement_pct": 5.6,
  "low_confusion_pct": 88.9,
  "elevated_confusion_pct": 5.6,
  "uncertain_confusion_pct": 5.6,
  "mean_confidence": 0.88,
  "data_quality": "valid"
}
```

### 2.2 Session Analytics Summary Schema
*MongoDB Collection:* `session_analytics_summaries`
*Index Policy:* Unique index on `session_id`; secondary indexes on `("teacher_id", 1), ("created_at", -1)` and `("classroom_id", 1), ("created_at", -1)`.

```json
{
  "_id": "sess_123",
  "id": "sess_123",
  "session_id": "sess_123",
  "classroom_id": "cls_456",
  "teacher_id": "tch_789",
  "session_title": "Distributed Systems: Consensus",
  "started_at": "2026-10-13T10:00:00Z",
  "ended_at": "2026-10-13T10:45:00Z",
  "duration_seconds": 2700,
  "total_students_enrolled": 28,
  "peak_reporting_students": 25,
  "total_observations": 3240,
  "engagement_distribution": {
    "normal_count": 2600,
    "reduced_count": 450,
    "uncertain_count": 190,
    "normal_pct": 80.2,
    "reduced_pct": 13.9,
    "uncertain_pct": 5.9
  },
  "confusion_distribution": {
    "low_count": 2850,
    "elevated_count": 230,
    "uncertain_count": 160,
    "low_pct": 88.0,
    "elevated_pct": 7.1,
    "uncertain_pct": 4.9
  },
  "mean_confidence": 0.87,
  "total_buckets": 45,
  "valid_buckets": 44,
  "telemetry_status": "persisted",
  "data_quality": "reliable",
  "created_at": "2026-10-13T10:45:05Z"
}
```

### 2.3 Aggregation & Mathematical Rules
1. **Time Alignment:** Buckets are indexed relative to session start ($t_{\text{elapsed}} // 60$). Each bucket represents exactly 60 seconds of classroom time.
2. **Missing vs. Zero Observations:**
   - If a bucket contains 0 samples: `normal_pct = null`, `elevated_confusion_pct = null`, `data_quality = "empty"`.
   - If a bucket contains samples and 0 students experienced elevated confusion: `elevated_confusion_pct = 0.0`.
   - Percentages are computed strictly against valid categorical counts:
     $$\text{normal\_pct} = \text{round}\left(\frac{\text{normal\_count}}{\text{normal\_count} + \text{reduced\_count} + \text{uncertain\_engagement\_count}} \times 100, 1\right)$$
3. **Burst Debouncing:** If a student client emits telemetry messages faster than 250ms apart, duplicate packets are discarded.
4. **Non-Blocking Persistence:** In-memory aggregation operates synchronously with WebSocket messaging; bucket writes and session finalization are isolated with try/except guards and error flags to guarantee the live WebSocket loop is never blocked by database latency.

---

## 3. Privacy Boundary and Retention Policy

| Artifact / Signal | Storage Location | Persisted to Database? | Retention Period | Rationale & Privacy Guarantee |
| :--- | :--- | :--- | :--- | :--- |
| **Raw Camera Frames** | Student browser RAM only | **NEVER** | 0 ms | Complete client-side privacy isolation. |
| **478 Facial Landmarks** | Student browser RAM only | **NEVER** | 0 ms | Discarded immediately after EAR/gaze/pose extraction. |
| **EAR, Gaze Vectors, Head Pose** | Student browser buffer (30 frames) | **NEVER** | <1 s | Only used for temporal state machine classification. |
| **Individual Student Biometric Logs** | In-memory during active session only | **NEVER** | Destroyed on disconnect | Teachers see only anonymous classroom cohort signals. |
| **1-Minute Cohort Buckets** | MongoDB Atlas (`session_analytics_buckets`) | **YES (Aggregated)** | **90 Days (TTL)** | Time-series progression of classroom engagement. Automatic TTL deletion. |
| **Session Analytics Summaries** | MongoDB Atlas (`session_analytics_summaries`) | **YES (Aggregated)** | **Permanent (or 365 Days)** | High-level curriculum and pedagogical effectiveness trends. |

---

## 4. Authenticated Backend Endpoints

All analytics endpoints require a verified JWT `Bearer` token with `role: "teacher"`. Server-side validation guarantees teachers can only query sessions and classrooms they own.

| HTTP Method | Route Path | Authorization Policy | Description & Contract |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sessions/teacher/history` | `require_teacher` | Returns past concluded sessions owned by the authenticated teacher, populated with duration, participant counts, engagement %, confusion %, and `telemetry_status`. |
| `GET` | `/api/classrooms/{classroom_id}/sessions/history` | `require_teacher` (ownership check) | Returns concluded session history for a specific classroom. Rejects cross-teacher access with HTTP 403 Forbidden. |
| `GET` | `/api/sessions/{session_id}/analytics/summary` | `require_teacher` (ownership check) | Returns the comprehensive session summary. Returns `telemetry_status: "persisted"` for completed sessions, `"in_memory_live_only"` for active sessions, or `"unavailable"` for sessions without recorded telemetry. |
| `GET` | `/api/sessions/{session_id}/analytics/buckets` | `require_teacher` (ownership check) | Returns the chronological array of 1-minute buckets for timeline chart visualization. |

---

## 5. Frontend Enhancements

### 5.1 Teacher Dashboard (`TeacherDashboard.jsx`)
- **Removed:** All synthetic demo data (`Calculus I (Lecture 14)`, `82% avgAttention`, `18% peakConfusion`).
- **Added:** Dynamic loading from `GET /api/sessions/teacher/history`.
- **States Handled:**
  - `Loading`: Clean inline loading indicator.
  - `Error`: Error message with interactive Retry button.
  - `Empty`: Contextual card: *"No completed sessions found. Start and end a classroom session with connected students to begin generating historical analytics logs."*
  - `Populated`: Real dates, topics, classrooms, duration, student counts, average engagement %, peak confusion %, and "View Report" action buttons.
  - `Honest Unavailable States`: If a session had no telemetry recorded, displays italicized *"Unavailable"* rather than fabricated numbers.

### 5.2 Session Report (`SessionReport.jsx`)
- **Integrated Data Loading:** Fetches `GET /api/sessions/{id}/summary`, `GET /api/sessions/{id}/analytics/summary`, and `GET /api/sessions/{id}/analytics/buckets` concurrently.
- **Source Badging:** Clearly distinguishes between:
  - `Persisted Analytics (MongoDB)` (Green badge)
  - `Live In-Memory Snapshot` (Amber badge)
  - `Historical Telemetry Unavailable` (Muted banner for pre-persistence or empty sessions)
- **Data Quality Indicators:** Renders verification banner showing aggregation interval (1 min), valid bucket ratio, and data quality level (`reliable`, `partial`, `degraded`).
- **Missing Value Handling:** Missing observation buckets are not coerced to `0%` normal engagement; metric cards display `â€”` when telemetry is unavailable.

---

## 6. Testing & Verification Results

### 6.1 Backend Automated Test Suite (`pytest`)
A dedicated test suite `backend/tests/test_analytics.py` was created to validate all requirements.

```
============================= test session starts =============================
platform win32 -- Python 3.13.0, pytest-9.1.1
rootdir: C:\GitHub\mindmap\backend
collected 25 items

test_health.py::test_health PASSED                                       [  4%]
tests/test_analytics.py::test_unit_bucket_boundaries_and_aggregates PASSED [  8%]
tests/test_analytics.py::test_unit_zero_vs_missing_observations PASSED   [ 12%]
tests/test_analytics.py::test_unit_debounce_and_stale_telemetry PASSED   [ 16%]
tests/test_analytics.py::test_session_lifecycle_and_analytics_persistence PASSED [ 20%]
tests/test_analytics.py::test_teacher_authorization_and_cross_classroom_denial PASSED [ 24%]
tests/test_analytics.py::test_empty_and_legacy_session_analytics PASSED  [ 28%]
tests/test_auth.py::test_register_success PASSED                         [ 32%]
tests/test_auth.py::test_register_duplicate_email PASSED                 [ 36%]
tests/test_auth.py::test_login_success PASSED                            [ 40%]
tests/test_auth.py::test_login_incorrect_password PASSED                 [ 44%]
tests/test_auth.py::test_login_unknown_email PASSED                      [ 48%]
tests/test_auth.py::test_get_me_success PASSED                           [ 52%]
tests/test_auth.py::test_get_me_invalid_token PASSED                     [ 56%]
tests/test_classrooms.py::test_create_classroom_unauthenticated PASSED   [ 60%]
tests/test_classrooms.py::test_student_cannot_create_classroom PASSED    [ 64%]
tests/test_classrooms.py::test_teacher_classroom_flow PASSED             [ 68%]
tests/test_participants.py::test_authorization_checks PASSED             [ 72%]
tests/test_participants.py::test_participant_join_leave_and_integrity PASSED [ 76%]
tests/test_sessions.py::test_unauthenticated_cannot_create_session PASSED [ 80%]
tests/test_sessions.py::test_student_cannot_create_session PASSED        [ 84%]
tests/test_sessions.py::test_session_lifecycle_and_ownership PASSED      [ 88%]
tests/test_websocket.py::test_websocket_authorization_and_lifecycle PASSED [ 92%]
tests/test_websocket.py::test_websocket_session_isolation PASSED         [ 96%]
tests/test_websocket.py::test_phase3c_behavioural_telemetry PASSED       [100%]

================= 25 passed, 102 warnings in 82.07s (0:01:22) =================
```

### 6.2 Frontend Production Build & Linter
- **Linter (`oxlint`):** Executed cleanly across 57 files with 0 errors.
- **Production Build (`vite build`):** Compiled client bundle successfully in 283ms:
  - `dist/index.html`: 0.45 kB
  - `dist/assets/index-ByJv6s4j.css`: 44.67 kB
  - `dist/assets/index-BuKJboEm.js`: 529.45 kB

---

## 7. Known Limitations & Migration Implications

1. **Pre-Phase 7B Historical Sessions:** Concluded sessions conducted prior to Phase 7B do not have persisted telemetry buckets. These sessions accurately and honestly display `telemetry_status: "unavailable"` with `â€”` indicators. Synthetic historical records are deliberately **not** backfilled.
2. **Offline ML Models:** As documented throughout Phases 5 and 6, the DAiSEE training pipeline in `ml/` remains an offline experimental benchmark and does not interact with live session persistence.

---

## 8. Working Tree Status

```
Changes not staged for commit:
	modified:   backend/app/core/database.py
	modified:   backend/app/routes/classrooms.py
	modified:   backend/app/routes/sessions.py
	modified:   backend/app/routes/ws.py
	modified:   backend/app/services/session_service.py
	modified:   backend/test_health.py
	modified:   backend/tests/conftest.py
	modified:   frontend/src/pages/teacher/SessionReport.jsx
	modified:   frontend/src/pages/teacher/TeacherDashboard.jsx

Untracked files:
	PHASE_6D_2_DEPLOYMENT_GUIDE.md
	PHASE_7A_PRODUCT_AUDIT.md
	PHASE_7B_ANALYTICS_PERSISTENCE_REPORT.md
	backend/app/models/analytics.py
	backend/app/schemas/analytics.py
	backend/app/services/analytics_service.py
	backend/tests/test_analytics.py
	frontend/vercel.json
```

---

## 9. GO / NO-GO Recommendation for Phase 7C

**Recommendation: GO for Phase 7C (Student Learning Dashboard & Self-Reflection).**

- **Rationale:**
  1. All mock data in the teacher workflow has been replaced with authentic, server-side persisted analytics.
  2. The 1-minute discrete aggregation contract preserves student privacy without saving any biometrics or individual trajectories.
  3. Authorization boundaries are thoroughly tested against cross-teacher data leakage.
  4. The codebase is clean, builds with 0 errors, and all 25 backend integration tests pass.
