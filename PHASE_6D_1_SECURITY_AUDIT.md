# MindMap Phase 6D.1 — Production Configuration and Security Audit Report

**Degree / Project Level:** Final-Year B.Tech Computer Science & Engineering (AI / ML)  
**System Title:** MindMap — Real-Time Non-Invasive Student Behaviour Analysis for Virtual Classrooms  
**Baseline Git Commit:** `5dda02c`  
**Audit Date:** 2026-10-12  
**Target Deployment Platforms:** Vercel (Frontend SPA) + Render (FastAPI / Uvicorn Web Service) + MongoDB Atlas (Database)  
**Audit Purpose:** Comprehensive production readiness, environment variable validation, and security posture audit prior to creating deployment configuration files.

---

## 1. Executive Summary & Recommendation

### Deployment Gate Decision: **CONDITIONAL GO** (Go after addressing 2 Critical Configuration Fixes)

The core application demonstrates exceptional privacy engineering and authorization architecture:
- **Zero biometric leak invariant verified:** Facial landmarks, raw video frames, Eye Aspect Ratio (EAR), gaze angles, head pose matrices, and personal calibration baselines are strictly confined to client WebAssembly/WebGL memory.
- **WebSocket server filter verified:** The backend explicitly rejects payloads containing biometric keywords and isolates student telemetry to authorized teachers.
- **Strict Role-Based Authorization verified:** 403 Forbidden checks protect classroom creation, session management, and participant summaries against privilege escalation.

However, **two critical configuration issues must be addressed before live deployment on Render and Vercel**:
1. **Critical:** In `backend/app/main.py`, CORS is configured with `allow_origins=["*"]` combined with `allow_credentials=True`. In production, browsers will reject credentialed requests with wildcard CORS, and opening all origins to authenticated REST requests presents a security vulnerability.
2. **Critical:** In `backend/app/core/config.py`, `JWT_SECRET` defaults to `"supersecretkey"` if the environment variable is omitted or blank. Production startup must fail fast if a cryptographically secure `JWT_SECRET` is not provided in environment settings.

---

## 2. Audit Scope & Files Inspected

The following source files across frontend, backend, and build configurations were inspected in detail:

| Area | Inspected Files | Scope of Inspection |
| :--- | :--- | :--- |
| **Frontend Configuration** | `frontend/src/config/api.js`, `frontend/.env.example` | Dynamic base URL derivation, trailing slash handling, HTTPS->WSS transformation, production fallbacks. |
| **Backend Configuration & Settings** | `backend/app/core/config.py`, `backend/app/core/security.py`, `backend/app/core/database.py` | Pydantic Settings validation, default values, JWT secret handling, connection pooling, Atlas SSL/TLS timeouts. |
| **CORS & Middleware** | `backend/app/main.py` | Allowed origins, methods, headers, credentials flag, OpenAPI exposure. |
| **Authentication & Authorization** | `backend/app/api/deps.py`, `backend/app/routes/auth.py`, `backend/app/services/auth_service.py` | Bearer token verification, expired token rejection, role enforcement (`require_teacher`, `require_student`). |
| **WebSocket Security & Telemetry** | `backend/app/routes/ws.py`, `backend/app/services/connection_manager.py`, `frontend/src/hooks/useSessionWebSocket.js` | WS token authentication, 1008 policy rejection, room isolation, biometric payload filtering, exponential backoff with jitter. |
| **Session & Participant Isolation** | `backend/app/routes/classrooms.py`, `backend/app/routes/sessions.py`, `backend/app/services/session_service.py` | Ownership checks, join code verification, session status gating (`scheduled`, `active`, `ended`). |
| **Client Privacy Boundary** | `frontend/src/features/inference/inferenceEngine.js`, `frontend/src/pages/student/StudentClassroom.jsx`, `frontend/src/features/baseline/baselineTracker.js` | Telemetry payload schema, avoidance of landmark persistence, client-side only calibration. |
| **Dependencies & Build Scripts** | `backend/requirements.txt`, `frontend/package.json`, `frontend/vite.config.js` | Dependency pinning, production build scripts, WASM asset delivery. |

---

## 3. Systematic Inspection & Verification Findings

### 3.1 Frontend API & WebSocket URL Configuration
- **Inspected File:** `frontend/src/config/api.js`
- **Mechanism:**
  - Reads `import.meta.env.VITE_API_BASE_URL` with fallback to `http://localhost:8000`.
  - Reads `import.meta.env.VITE_WS_BASE_URL`. If unset, dynamically computes `deriveWsUrl(API_BASE_URL)`.
  - Converts `https://` base URLs to secure WebSockets `wss://` automatically.
  - Automatically sanitizes trailing slashes (`trimTrailingSlash`).
- **Audit Assessment:** **PASS (Low Risk on Fallback)**.
  - *Observation:* The local fallback `http://localhost:8000` is benign in development. On Vercel, if `VITE_API_BASE_URL` is omitted at build time, the frontend bundle will silently bake in `http://localhost:8000`.
  - *Mitigation:* Ensure Vercel deployment instructions specify `VITE_API_BASE_URL` in environment variables before building.

### 3.2 Backend Environment Variable Loading & Validation
- **Inspected File:** `backend/app/core/config.py`
- **Mechanism:**
  - Uses `pydantic-settings.BaseSettings` reading from `.env` or system environment variables.
  - Defines `MONGODB_URI: str = ""`, `DATABASE_NAME: str = "mindmap_db"`, `JWT_SECRET: str = "supersecretkey"`, `JWT_ALGORITHM: str = "HS256"`, `JWT_EXPIRE_MINUTES: int = 10080`.
- **Audit Assessment:** **MEDIUM (Needs Strict Validation)**.
  - If `MONGODB_URI` is empty, backend starts in a disconnected state rather than failing fast on boot.
  - In production on Render, the service should immediately raise an error on startup if `MONGODB_URI` or `JWT_SECRET` is unset or set to weak defaults.

### 3.3 JWT Signing Secret Configuration & Token Validation
- **Inspected Files:** `backend/app/core/security.py`, `backend/app/core/config.py`, `backend/app/api/deps.py`
- **Mechanism:**
  - JWT tokens signed with `PyJWT` using `HS256`.
  - Expiry set to 7 days (`10080` minutes).
  - Secret key default is `"supersecretkey"`.
- **Audit Assessment:** **CRITICAL (Hardcoded Default Secret)**.
  - *Impact:* PyJWT emitted `InsecureKeyLengthWarning: The HMAC key is 14 bytes long, which is below the minimum recommended length of 32 bytes for SHA256`. If `JWT_SECRET` is not overridden in production, anyone could forge tokens and gain teacher/admin privileges.
  - *Recommendation:* Require `JWT_SECRET` to be provided in environment variables with minimum 32 characters in production; disallow default in production mode.

### 3.4 CORS Configuration & Allowed Origins
- **Inspected File:** `backend/app/main.py`
- **Current Code:**
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
- **Audit Assessment:** **CRITICAL (Invalid / Insecure Production CORS)**.
  - *Impact:* The Fetch standard disallows `allow_origins=["*"]` when `allow_credentials=True`. Browsers will block authenticated frontend requests from the Vercel domain. Furthermore, allowing all origins enables CSRF-like data exfiltration against authenticated sessions.
  - *Recommendation:* Make allowed origins configurable via an environment variable `CORS_ORIGINS` (comma-separated list), with default fallback to `http://localhost:5173` for development and the specific Vercel production frontend URL for deployment.

### 3.5 Authentication & Authorization for REST & WebSockets
- **Inspected Files:** `backend/app/api/deps.py`, `backend/app/routes/ws.py`, `backend/app/routes/sessions.py`
- **Mechanism:**
  - REST endpoints use dependency injection `get_current_user`, `require_teacher`, `require_student`.
  - WebSocket endpoint `/ws/sessions/{session_id}` extracts token from query parameter or `Authorization` header.
  - Validates active session status and verifies participant membership for students or ownership for teachers.
- **Audit Assessment:** **PASS**.
  - Verified with automated tests: Students attempting teacher endpoints receive `403 Forbidden`. Non-owner teachers attempting access receive `403 Forbidden`. Unauthenticated or invalid token WebSocket connections close with `code 1008 Policy Violation`.

### 3.6 MongoDB Atlas Configuration & Connection Handling
- **Inspected File:** `backend/app/core/database.py`
- **Mechanism:**
  - Connects using `MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)`.
  - Automatically pings admin database on startup and creates required unique and compound indexes.
  - Closes connection cleanly during FastAPI lifespan shutdown.
- **Audit Assessment:** **PASS (with Low suggestion)**.
  - Verified live connection to Atlas cluster.
  - Exception handling in `connect_to_mongo()` catches `ConnectionFailure` and logs the error, setting `client = None`.
  - *Improvement:* If MongoDB fails to connect on Render startup, the app should fail fast (`sys.exit(1)`) so the container restart policy triggers an alert instead of serving disconnected endpoints that return 500.

### 3.7 Error Responses, Logging & Secret Exposure
- **Inspected Files:** `backend/app/core/database.py`, `frontend/src/hooks/useSessionWebSocket.js`, `frontend/src/context/AuthContext.jsx`
- **Mechanism:**
  - Audited all print statements in backend: only database names and connection states are logged (`settings.DATABASE_NAME`), never connection URIs or passwords.
  - Frontend WebSocket logs (`console.warn`) redact URLs and query parameters containing tokens.
- **Audit Assessment:** **PASS**. No secret leakage found in source code or client bundles.

### 3.8 WebSocket Reconnect, Session Termination & Cleanup
- **Inspected Files:** `frontend/src/hooks/useSessionWebSocket.js`, `backend/app/services/connection_manager.py`
- **Mechanism:**
  - Client implements exponential backoff (`computeReconnectDelay`) with random jitter up to 5 attempts.
  - Immediately ceases reconnection attempts upon:
    - Normal closure (`code 1000`)
    - Terminal policy violation (`code 1008`)
    - Server `session_ended` broadcast event
    - Component unmount
  - Backend `SessionConnectionManager` cleans up dead sockets from room sets automatically.
- **Audit Assessment:** **PASS**. All 11 automated unit tests and live end-to-end multi-role tests passed.

### 3.9 Dependency Completeness & Startup Commands
- **Backend:** `requirements.txt` contains: `fastapi`, `uvicorn`, `websockets`, `pymongo`, `python-dotenv`, `pydantic`, `pydantic-settings`.
  - Verified: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` works out of the box on Render.
- **Frontend:** `package.json` contains: React 19, React Router DOM 7, Vite 8, TailwindCSS 4, `@mediapipe/tasks-vision` 1.0.1.
  - Verified: `npm run build` runs in 548ms, creating standard static output in `dist/`. Suitable for Vercel static hosting.
- **Audit Assessment:** **PASS**.

### 3.10 Privacy Invariants: Biometric Confinement
- **Inspected Files:** `frontend/src/features/inference/inferenceEngine.js`, `frontend/src/pages/student/StudentClassroom.jsx`, `backend/app/routes/ws.py`
- **Data Flow Analysis:**
  - Webcam video feeds into `FaceLandmarker` inside the browser using WebAssembly.
  - 478 3D landmarks, EAR, Gaze coordinates, Head Pose angles, and baseline buffers reside only in component state / React refs.
  - Transmitted payload over WebSocket contains ONLY:
    `{ "type": "student_behaviour_update", "payload": { "engagement_state": "NORMAL_BEHAVIOUR", "confusion_signal": "LOW", "confidence": 0.88 } }`
  - Backend enforces `FORBIDDEN_BIOMETRIC_FIELDS` filter.
- **Audit Assessment:** **PASS (Architecture Fully Compliant)**.

---

## 4. Classification of Findings & Remediation Status (Phase 6D.1R)

| ID | Category | Severity | Finding | Remediation Status | Verification |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **SEC-01** | CORS Configuration | **CRITICAL** | `allow_origins=["*"]` with `allow_credentials=True` in `backend/app/main.py`. | **RESOLVED in 6D.1R**: Replaced wildcard with configurable `CORS_ORIGINS` via `settings.cors_origins_list`. | Automated test verified: trusted origin (`http://localhost:5173`) returns exact header and `credentials: true`. Untrusted origin (`evil-attacker.com`) receives no CORS allow header. |
| **SEC-02** | Cryptographic Secrets | **CRITICAL** | Hardcoded weak default `JWT_SECRET = "supersecretkey"` (< 32 bytes) in `backend/app/core/config.py`. | **RESOLVED in 6D.1R**: Added `ENVIRONMENT` validator. In production, startup strictly rejects missing, default, or < 32 character secrets. Development maintains explicit fallback. | Automated test verified: production startup fails on default or short secrets, and succeeds on 32-char cryptographically strong secret. |
| **SEC-03** | Startup Fail-Fast / Health | **MEDIUM** | Backend `/health` reported healthy even when database was disconnected. | **RESOLVED in 6D.1R**: Added active `check_mongo_health()` ping check to `database.py`. `/health` responds with `503 Service Unavailable` (`status: "unhealthy"`) during DB outage. | Automated test verified: returns 200 `connected` when DB is reachable, returns 503 `disconnected` during simulated DB outage. |
| **SEC-04** | Static Asset Warning | **LOW** | Vite build warns `dist/assets/index-*.js` is 522 kB (exceeds 500 kB chunk limit). | **ACCEPTED**: Expected bundle size for bundled `@mediapipe/tasks-vision` WASM/WebGL runtime. | Build completes in < 700ms with zero errors. |
| **SEC-05** | Fallback URLs | **INFORMATIONAL**| Frontend defaults to `http://localhost:8000` if `VITE_API_BASE_URL` is omitted. | **DOCUMENTED**: Documented in `frontend/.env.example` and `SYSTEM_RUNBOOK.md` for Vercel deployment. | Verified `api.js` configuration. |

---

## 5. Remediation Details (Phase 6D.1R)

1. **Configurable CORS (`backend/app/core/config.py` & `backend/app/main.py`):**
   - Added `CORS_ORIGINS` settings property defaulting to local development ports.
   - Configured `CORSMiddleware` with `settings.cors_origins_list`. Wildcard origin with credentials completely eliminated.
2. **Production JWT Secret Guard (`backend/app/core/config.py`):**
   - Added Pydantic `model_validator` enforcing that when `ENVIRONMENT=production`, `JWT_SECRET` must not match known placeholder defaults and must have a length of at least 32 characters.
3. **Database Health Reporting (`backend/app/core/database.py` & `backend/app/main.py`):**
   - Implemented `check_mongo_health()` using PyMongo ping command.
   - `/health` dynamically reports `status: "ok", database: "connected"` (HTTP 200) or `status: "unhealthy", database: "disconnected"` (HTTP 503).

---

## 6. Items Safe to Defer

1. **Vite Dynamic Code-Splitting:** The 522 kB chunk warning from Rollup is due to the vision tasks SDK. It works reliably in production and does not block deployment.
2. **Offline ML Pipeline Deployment:** Offline training on DAiSEE in `ml/` is intentionally kept offline as an experimental benchmark (preserving the privacy boundary and avoiding uncalibrated predictions in production).
3. **Database Migration Tooling:** Schema indexing is already automated on FastAPI lifespan startup; manual migrations are not required for MongoDB.

---

## 7. Verification Test Execution Summary

The following test suites were executed to verify system integrity following Phase 6D.1R remediation:

| Test Suite | Commands Executed | Result | Notes |
| :--- | :--- | :---: | :--- |
| **Backend Unit & Integration Tests** | `pytest tests/ -v` (backend) | **18/18 PASSED** | All auth, classroom, participant, session, and WebSocket tests passed. |
| **Offline ML Benchmark Tests** | `python -m pytest ml/tests -q` | **27/27 PASSED** | Clean pass in 5.22s (1 scipy deprecation warning). |
| **Frontend Algorithmic & Unit Tests** | 11 Node.js test scripts in `frontend/src` | **11/11 PASSED** | 100% assertions satisfied for EAR, Gaze, HeadPose, Fusion, WebSocket, Baseline. |
| **Frontend Production Build** | `npm run build` | **PASSED** | Built in 625ms, valid `dist/` directory generated. |
| **Frontend Linter** | `npm run lint` | **PASSED** | 0 errors, 54 code style/hook warnings. |
| **CORS Security Verification** | Custom test script against `/api/auth/login` | **PASSED** | Trusted origin accepted, untrusted origin rejected, wildcard eliminated. |
| **JWT Secret Validation** | Custom test script simulating prod startup | **PASSED** | Insecure/default secrets rejected with ValidationError. |
| **Database Health Ping Verification** | Custom test script against `/health` | **PASSED** | Connected returns 200, outage returns 503. |

---

## 8. Final Conclusion & Recommendation

**Deployment Gate Decision: FULL GO FOR PHASE 6D.2 DEPLOYMENT PREPARATION**  
All identified critical (SEC-01, SEC-02) and medium (SEC-03) security findings have been resolved in code, thoroughly verified with automated test suites, and documented. The codebase is now ready for deployment descriptor authoring (Vercel and Render).

