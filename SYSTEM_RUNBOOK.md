# MindMap: Examiner-Ready Setup & System Runbook

**Degree / Project Level:** Final-Year B.Tech Computer Science & Engineering (AI / ML)  
**System Title:** MindMap — Real-Time Non-Invasive Student Behaviour Analysis for Virtual Classrooms  
**Current Baseline Commit:** `dbaa9d8`  
**Document Purpose:** Complete, reproducible operational guide for examiners, evaluators, and engineers to verify, configure, launch, and evaluate MindMap locally.

---

## 1. Project Overview & System Architecture

MindMap is an intelligent virtual classroom supervision and behavioural analytics system. It monitors student cognitive engagement and confusion levels during online educational sessions while enforcing an uncompromising **client-side privacy boundary**.

```
+---------------------------------------------------------------------------------------+
| STUDENT BROWSER (Chrome / Edge)                                                      |
|                                                                                       |
|   Webcam Frame (30 FPS)                                                               |
|          │                                                                            |
|          ▼                                                                            |
|   MediaPipe FaceLandmarker (478 3D Landmarks) ──[WASM / WebGL]                         |
|          │                                                                            |
|          ▼                                                                            |
|   Geometric Feature Extractor (EAR, Gaze Angle, Head Pose Yaw/Pitch/Roll)             |
|          │                                                                            |
|          ▼                                                                            |
|   Personal Baseline Calibration (20s moving resting state baseline)                   |
|          │                                                                            |
|          ▼                                                                            |
|   Rule-Based Multimodal Behavioural Inference Engine                                  |
|          │                                                                            |
|          ├──► Privacy Barrier: Raw frames & landmarks NEVER leave browser memory!     |
|          │                                                                            |
|          ▼                                                                            |
|   Derived Categorical Telemetry Only:                                                 |
|   { "engagement_state": "NORMAL_BEHAVIOUR", "confusion_signal": "LOW", "confidence": 0.85 }
+------------------------------------------┬--------------------------------------------+
                                           │
                                           │ WebSocket JSON (/ws/sessions/{session_id})
                                           ▼
+---------------------------------------------------------------------------------------+
| BACKEND SERVER (FastAPI, Python 3.13)                                                 |
|                                                                                       |
|   ConnectionManager & Telemetry Dispatcher                                            |
|          ├── 1. JWT authentication & session participant membership check             |
|          ├── 2. Biometric leak guard (rejects any frames, landmarks, EAR, gaze)       |
|          └── 3. Relays student categorical telemetry strictly to active Teachers      |
+------------------------------------------┬--------------------------------------------+
                                           │
                                           │ WebSocket Broadcast
                                           ▼
+---------------------------------------------------------------------------------------+
| TEACHER BROWSER DASHBOARD (React 19 / Vite / TailwindCSS)                             |
|                                                                                       |
|   Real-Time Classroom Monitor                                                         |
|          ├── Aggregate engagement metrics & distribution donut chart                  |
|          ├── Confusion alerts with student identification                             |
|          └── Session conclusion summary & exportable PDF performance report           |
+---------------------------------------------------------------------------------------+
```

### Architectural & Privacy Guarantees
1. **Zero Raw Video or Landmark Transmission:** Raw webcam frames, 478 3D facial landmarks, Eye Aspect Ratio (EAR), gaze vectors, 3D head pose angles, and rolling temporal buffers are computed strictly inside client browser memory (via `@mediapipe/tasks-vision` WebAssembly).
2. **Server Biometric Leak Filter:** In `backend/app/routes/ws.py`, incoming WebSocket messages pass through a strict filter (`FORBIDDEN_BIOMETRIC_FIELDS`). Any payload containing `landmarks`, `landmark`, `ear`, `gaze`, `pose`, `head_pose`, `temporal`, `baseline`, `video`, `frame`, `image`, or `raw` is instantly rejected.
3. **Database Privacy Isolation:** MongoDB stores only user accounts, classroom metadata, session records, and participation timestamps. No student telemetry or biometric values are persisted in the database.
4. **Current ML Research Module Status:** An offline machine learning experimental pipeline is implemented and documented in `ml/` (trained and evaluated on the official DAiSEE benchmark dataset across Phases 5A–5F). In accordance with Phase 5F evaluation results (severe class imbalance and low macro F1 on natural observer labels), **these ML models are deliberately kept offline and are NOT integrated into live real-time runtime inference**, avoiding uncalibrated predictions in production.

---

## 2. Verified Prerequisites & Environment Requirements

| Component | Minimum Version | Verified Version in Repo | Purpose |
| :--- | :--- | :--- | :--- |
| **Operating System** | Windows 10/11, macOS, Linux | Windows 11 (PowerShell 5.1 / 7+) | System Host |
| **Python** | 3.10+ | 3.13.0 | FastAPI Backend & ML Pipeline |
| **Node.js** | 18.0+ | 22.20.0 (LTS) | React Frontend Runtime |
| **npm** | 9.0+ | 10.9.3 | Node Package Manager |
| **MongoDB** | 6.0+ or MongoDB Atlas (Free M0) | Atlas Cluster / Local `mongod` | Relational & Session State Store |
| **Web Browser** | Chrome 110+ or Edge 110+ | Google Chrome / Microsoft Edge | MediaPipe WebAssembly & Camera API |

### Port Allocation
- **Backend (FastAPI):** Port `8000` (`http://localhost:8000` / `ws://localhost:8000`)
- **Frontend (Vite):** Port `5173` (`http://localhost:5173`)
- Ensure ports `8000` and `5173` are free before starting.

---

## 3. Environment Variable Configuration

Both frontend and backend are configured using root-level or directory-level `.env` files. Templates are provided in the repository.

### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:
```powershell
cp backend/.env.example backend/.env
```

Default configuration contents:
```env
# Application Environment ('development' or 'production')
ENVIRONMENT=development

# MongoDB Connection String (Atlas URI or local instance)
# Local instance default:
MONGODB_URI=mongodb://localhost:27017

# MongoDB database name
DATABASE_NAME=mindmap_db

# Secret key for signing JWT tokens
# Development allows default fallback; production strictly requires min 32-char random string
JWT_SECRET=supersecretkey_dev_testing_only

# Algorithm for JWT signing
JWT_ALGORITHM=HS256

# Expiry duration for JWT tokens in minutes (10080 = 7 days)
JWT_EXPIRE_MINUTES=10080

# Allowed CORS Origins (comma-separated list of trusted origins)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000
```

> **Note on MongoDB URI:** If using MongoDB Atlas, replace `MONGODB_URI` with your connection string:
> `mongodb+srv://<username>:<password>@<cluster>.mongodb.net`
>
> **Note on Production Deployment:** When setting `ENVIRONMENT=production` on hosting platforms (such as Render), `JWT_SECRET` must be set to a cryptographically secure string of at least 32 characters, and `CORS_ORIGINS` must include your production frontend URL (e.g. `https://your-mindmap-frontend.vercel.app`).


### Frontend (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:
```powershell
cp frontend/.env.example frontend/.env
```

Default configuration contents:
```env
# FastAPI HTTP/REST backend base URL (no trailing slash)
VITE_API_BASE_URL=http://localhost:8000

# FastAPI WebSocket backend base URL (optional, derived from VITE_API_BASE_URL if omitted)
VITE_WS_BASE_URL=ws://localhost:8000
```

---

## 4. Database Setup & Initialization

MindMap requires a running MongoDB database (either local Community Edition or MongoDB Atlas cloud).

### Automatic Index Creation
There are **no manual database migrations or schema scripts** needed. When the FastAPI application starts (`lifespan` in `backend/app/main.py`), `connect_to_mongo()` in `backend/app/core/database.py` automatically initializes all required unique and composite indexes:
- `users`: `email` (unique)
- `classrooms`: `join_code` (unique), `teacher_id`
- `sessions`: `classroom_id`, `teacher_id`, `status`, `[classroom_id, created_at]`
- `participants`: `session_id`, `student_id`, `classroom_id`, unique partial index on `[session_id, student_id]` where `status == "joined"`

### Verifying Database Connectivity
To verify that your MongoDB connection string in `backend/.env` is active and responsive, execute the included verification script:

```powershell
# From repository root:
.\backend\.venv\Scripts\python.exe backend/verify_mongo.py
```

Expected successful output:
```
Starting verification...
Checking MongoDB Connection...
MongoDB Atlas connection successful
Database: mindmap_db
PyMongo ping result: OK
Testing /health endpoint...
/health endpoint is working.
```

---

## 5. Step-by-Step PowerShell Startup Instructions

Open **two separate PowerShell terminals** at the repository root `C:\GitHub\mindmap`.

### Terminal 1: Backend Server (FastAPI)
```powershell
# 1. Navigate to the backend directory
cd C:\GitHub\mindmap\backend

# 2. Activate Python virtual environment (if not using direct executable)
.\.venv\Scripts\Activate.ps1

# 3. (Optional) Install/verify dependencies
pip install -r requirements.txt

# 4. Start the Uvicorn ASGI server
uvicorn app.main:app --reload --port 8000
```
*Expected terminal output:*
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
Connected to MongoDB Atlas database: mindmap_db
INFO:     Application startup complete.
```
*Health verification in browser or curl:* `http://localhost:8000/health` returns `{"status":"ok"}`.  
*Interactive Swagger API Docs:* `http://localhost:8000/docs`.

### Terminal 2: Frontend Server (Vite / React)
```powershell
# 1. Navigate to the frontend directory
cd C:\GitHub\mindmap\frontend

# 2. (Optional) Verify dependencies
npm install

# 3. Start Vite development server
npm run dev
```
*Expected terminal output:*
```
  VITE v8.2.0  ready in 220 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

---

## 6. Live Demonstration Checklist & Viva Script

For an examiner walkthrough or demonstration, execute the following workflow in order:

### Step 1: Open Application & Register Teacher
1. Open Google Chrome and visit `http://localhost:5173`.
2. Click **Get Started** or **Register**.
3. Register a Teacher account:
   - **Full Name:** `Prof. Alan Turing`
   - **Email:** `turing@mindmap.edu`
   - **Password:** `Admin@123`
   - **Role:** Select `Teacher`
4. The system automatically redirects to `/teacher` (Teacher Dashboard).

### Step 2: Create Classroom & Launch Live Session
1. On Teacher Dashboard, click **Create Classroom**.
2. Enter:
   - **Classroom Name:** `CS401: Deep Learning Seminar`
   - **Description:** `Neural Networks and Real-Time Cognitive Vision`
3. Click **Create Classroom**.
4. A unique **6-character Join Code** (e.g., `DL401X`) is generated and displayed on the card.
5. Click **Open Classroom**.
6. Click **Start Live Session**. Confirm the prompt.
7. The status transitions to **LIVE** and the Teacher enters the real-time monitoring view with WebSocket telemetry listener enabled.

### Step 3: Student Registration & Device Permission Check (Incognito / 2nd Window)
1. Open a new **Incognito Window** (to maintain a separate session cookie/token) and visit `http://localhost:5173`.
2. Register a Student account:
   - **Full Name:** `Ada Lovelace`
   - **Email:** `ada@student.edu`
   - **Password:** `Student@123`
   - **Role:** Select `Student`
3. Redirects to `/student` (Student Dashboard).
4. Click **Join Classroom**.
5. Enter the Teacher's **6-character Join Code** (e.g., `DL401X`).
6. Click **Find Classroom** -> **Proceed to Session**.
7. The browser navigates to `/student/check` (Device Check):
   - Browser requests camera permission. Click **Allow**.
   - Webcam feed renders locally.
   - Click **Calibrate & Enter Classroom**.

### Step 4: Live Calibration & Real-Time Behaviour Telemetry
1. The student enters `/student/classroom/:id`.
2. **Client-Side Baseline Calibration:** During the first 15–20 seconds, the client baseline tracker accumulates personal resting EAR and head pose metrics.
3. Switch to the **Teacher window**:
   - The Teacher view updates in real time: `Ada Lovelace` appears in the participant roster.
   - Aggregate engagement donut chart shows live status (`NORMAL_BEHAVIOUR`).
4. **Demonstrating Behavioural Signals (Student Window):**
   - *Simulate Inattention / Drowsiness:* Look away from the screen or close eyes for 3+ seconds.
   - *Observation:* Student UI indicates state change. Teacher dashboard receives telemetry over WebSocket and logs `REDUCED_ENGAGEMENT_LIKE`.
   - *Simulate Confusion:* Tilt head sideways and furrow brows (reduced EAR + head pose deviation).
   - *Observation:* Confusion signal counter updates on Teacher panel (`ELEVATED`).

### Step 5: Session Termination & Summary Analytics Report
1. On the Teacher window, click **End Session**.
2. WebSocket transmits `session_ended` event; student interface gracefully notifies participant that the session has concluded.
3. Teacher view transitions to `/teacher/session/:sessionId/report`:
   - Summary statistics: Total Duration, Peak Attendance, Engagement Index percentage, Confusion Incident count.
   - Student Attendance Breakdown list.
   - Click **Export PDF Report** to verify client-side printable report generation.

---

## 7. Key Viva Defense Talking Points & Examiner Q&A

### Q1: "How do you protect student biometric privacy under GDPR / FERPA?"
> **Answer:** *"MindMap enforces privacy by architecture, not just by policy. Video frames and 478 MediaPipe facial landmarks never leave the student's browser. Geometric feature extraction (Eye Aspect Ratio, Gaze, Head Pose) and 20-second rolling personal baseline calibration occur entirely in WebAssembly/WebGL inside client RAM. Only high-level discrete enum labels (`NORMAL_BEHAVIOUR`, `REDUCED_ENGAGEMENT_LIKE`, `LOW`, `ELEVATED`) and a confidence scalar are transmitted over WebSocket. The backend explicitly rejects any packet containing biometric keywords."*

### Q2: "Why is the offline DAiSEE ML pipeline not running live in the browser?"
> **Answer:** *"In Phases 5A through 5F, we trained and rigorously evaluated Logistic Regression and Random Forest models on the official DAiSEE benchmark dataset. Because DAiSEE exhibits severe natural class imbalance (over 90% engaged, under 3% confused/disengaged) and relies on subjective third-party video annotations, the models achieved strong overall accuracy (85–90%) solely by predicting majority classes, resulting in low macro F1 for minority classes. Rather than deploying an unreliable or misleading ML model into a classroom setting, we preserved scientific integrity: we kept the ML evaluation as an offline benchmark and used a robust, calibrated multimodal rule engine in the browser for live inference."*

### Q3: "What happens if a student has naturally smaller eyes or sits at an unusual camera angle?"
> **Answer:** *"MindMap features an adaptive **Personal Baseline Calibration** phase. During the first 15–20 seconds of session entry, the student's personal resting EAR, eye openness, and neutral head tilt are measured. Subsequent behavioural inferences evaluate deviations from the student's personal baseline rather than using hardcoded global thresholds."*

---

## 8. Troubleshooting & Common Pitfalls

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **MongoDB Connection Failure (`ServerSelectionTimeoutError`)** | MongoDB service is not running locally or IP address not whitelisted in Atlas. | 1. If using local MongoDB, run `net start MongoDB` or verify `mongod` is running.<br>2. If using Atlas, add your current IP address to the Network Access whitelist in MongoDB Atlas dashboard.<br>3. Verify URI in `backend/.env` using `python backend/verify_mongo.py`. |
| **WebSocket Connection Closes Immediately with Code 1008** | Policy violation: Missing JWT token, student not joined to session in DB, or session is not active. | Ensure the teacher clicked **Start Live Session** before the student joined, and both users are logged in with valid accounts. |
| **Webcam Feed Blank or Black** | Camera permission denied or webcam is in use by another application (Zoom, Teams). | Close other applications accessing the webcam. Click the lock/tune icon in the browser URL bar, ensure Camera is set to **Allow**, and refresh. |
| **MediaPipe WASM Load Error** | CDN / network block preventing download of `@mediapipe/tasks-vision` binary assets. | Ensure internet access is available to download the vision tasks model asset on first initialization. |
| **CORS Error on REST Endpoints** | Frontend port mismatch or missing CORS middleware. | Verify backend `app/main.py` has `CORSMiddleware` enabled (already configured with wildcard for development) and backend is listening on `http://localhost:8000`. |

---

## 9. Verification & Automated Test Commands

To prove system integrity before the viva, run these verified automated tests:

### 1. ML Pipeline Offline Tests (27 passed)
```powershell
# From repository root:
$env:PYTHONPATH = "C:\Users\G15\AppData\Local\Programs\Python\Python313\Lib\site-packages;backend\.venv\Lib\site-packages;."
.\backend\.venv\Scripts\python.exe -m pytest ml/tests -v
```

### 2. Frontend Algorithmic & Unit Tests (11 test suites passed)
```powershell
# From repository root:
node frontend/src/config/test_apiConfig.js
node frontend/src/features/analytics/test_sessionAnalytics.js
node frontend/src/features/baseline/test_baselineTracker.js
node frontend/src/features/classroom/test_classroomAggregation.js
node frontend/src/features/facial/test_eyeFeatures.js
node frontend/src/features/facial/test_gazeFeatures.js
node frontend/src/features/facial/test_headPoseFeatures.js
node frontend/src/features/fusion/test_fusionFeatures.js
node frontend/src/features/inference/test_inference.js
node frontend/src/features/temporal/test_temporalFeatures.js
node frontend/src/hooks/test_useSessionWebSocket.js
```

### 3. Frontend Production Build & Linting (Clean)
```powershell
# From frontend directory:
cd frontend
npm run lint
npm run build
```
*(Confirms Vite bundle compilation in < 500ms with 0 errors).*
