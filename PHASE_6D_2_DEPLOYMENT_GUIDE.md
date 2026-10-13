# MindMap Phase 6D.2 â€” Deployment Preparation & Platform Configuration Guide

**Degree / Project Level:** Final-Year B.Tech Computer Science & Engineering (AI / ML)
**System Title:** MindMap â€” Real-Time Non-Invasive Student Behaviour Analysis for Virtual Classrooms
**Baseline Git Commit:** `f849d6b`
**Document Purpose:** Complete, step-by-step technical guide for manually deploying MindMap across Render (FastAPI / Uvicorn Web Service), Vercel (React 19 / Vite SPA), and MongoDB Atlas.

---

## 1. Architectural Overview & Hosting Topology

MindMap uses a decoupled client-server architecture designed to maintain an uncompromising **client-side privacy boundary**:

```
[Student / Teacher Client Browser]
      â”‚
      â”œâ”€â”€ HTTPS Requests (REST API) â”€â”€â”€â”€â”€â”€â–º [Render Web Service (FastAPI)]
      â”‚                                             â”‚
      â”‚                                             â”œâ”€â”€ MongoDB Wire Protocol (TLS)
      â”‚                                             â–¼
      â”‚                                    [MongoDB Atlas Cluster]
      â”‚                                    (Accounts, Classrooms, Sessions)
      â”‚
      â””â”€â”€ WSS Connections (WebSockets) â”€â”€â”€â”€â–º [Render Web Service (/ws/sessions/:id)]
                                                    â”‚
                                                    â””â”€â”€ In-Memory Telemetry Dispatch
                                                        (Zero database persistence)

[Static Asset Delivery]
      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º [Vercel Edge Network]
                                            (React 19, Vite, TailwindCSS 4,
                                             MediaPipe WebAssembly & Vision Models)
```

### Key Architectural Invariants
1. **Privacy Boundary:** Webcam frames, 478 3D landmarks, EAR, gaze vectors, and head pose calculations never leave the student's browser. Only high-level discrete enum labels (`NORMAL_BEHAVIOUR`, `REDUCED_ENGAGEMENT_LIKE`, `LOW`, `ELEVATED`) and a confidence scalar are transmitted over WebSocket.
2. **Offline ML Module Status:** The machine learning models in `ml/` (trained and evaluated on DAiSEE across Phases 5Aâ€“5F) remain offline experimental benchmarks and are **not integrated** into the live deployment runtime.
3. **Database Readiness:** The backend's `/health` endpoint performs active MongoDB ping readiness checks (`200 OK` when connected, `503 Service Unavailable` when disconnected).

---

## 2. Render Backend Web Service Configuration

Render hosts the FastAPI application as an asynchronous Python Web Service with persistent WebSocket support.

### Service Settings
| Configuration Field | Recommended Production Value | Verification & Rationale |
| :--- | :--- | :--- |
| **Service Type** | Web Service | Required for HTTP + WebSockets |
| **Environment / Runtime** | Python 3 | Project runs on Python 3.10â€“3.13 |
| **Root Directory** | `backend` | All backend code, `.env.example`, and requirements reside in `backend/` |
| **Build Command** | `pip install -r requirements.txt` | Installs `fastapi`, `uvicorn`, `websockets`, `pymongo`, `python-dotenv`, `pydantic`, `pydantic-settings` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | Starts ASGI server listening on Render's dynamic `$PORT`. Note: Run from `backend/` root directory so `app.main:app` resolves cleanly. |
| **Health Check Path** | `/health` | Verified in Phase 6D.1R; returns HTTP 200 with `{"status":"ok","database":"connected"}`. |
| **Auto-Deploy** | Optional (Yes on `main` branch) | Continuous deployment upon approved commits |

### Render Environment Variables
Configure the following in the **Environment** tab of the Render dashboard:

| Variable Name | Required | Example Production Value | Purpose & Security Constraints |
| :--- | :---: | :--- | :--- |
| `ENVIRONMENT` | **Yes** | `production` | Enables strict production validation; rejects default or short JWT secrets. |
| `MONGODB_URI` | **Yes** | `mongodb+srv://<db_user>:<db_pass>@<cluster>.mongodb.net` | MongoDB Atlas connection string with readWrite permissions. |
| `DATABASE_NAME` | **Yes** | `mindmap_db` (or `mindmap`) | MongoDB database name. |
| `JWT_SECRET` | **Yes** | *(Generate 32+ char random key)* | Cryptographic HMAC secret. **Must be >= 32 characters**. Do not use default or placeholder values. |
| `JWT_ALGORITHM` | No | `HS256` | Default signing algorithm. |
| `JWT_EXPIRE_MINUTES`| No | `10080` | Token lifetime (default 7 days). |
| `CORS_ORIGINS` | **Yes** | `https://your-mindmap-frontend.vercel.app` | Comma-separated list of trusted origins. Must match your deployed Vercel domain. |

> **Generating a Secure JWT Secret:**
> In PowerShell or terminal:
> ```powershell
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

---

## 3. Vercel Frontend SPA Configuration

Vercel hosts the React 19 single-page application built with Vite.

### Project Settings
| Configuration Field | Recommended Production Value | Verification & Rationale |
| :--- | :--- | :--- |
| **Framework Preset** | Vite | Vercel automatically detects Vite configurations |
| **Root Directory** | `frontend` | Frontend files and `package.json` reside in `frontend/` |
| **Build Command** | `npm run build` | Runs `vite build`; verified in Phase 6D.1R (builds in ~600ms) |
| **Output Directory** | `dist` | Default Vite production bundle directory |
| **Install Command** | `npm install` | Installs dependencies including `@mediapipe/tasks-vision` |
| **Node.js Version** | `20.x` or `22.x` | Verified on Node v22.20.0 |

### Vercel Client-Side Routing (`vercel.json`)
Because MindMap is a React Single Page Application using `react-router-dom` with HTML5 browser history (`/student`, `/teacher`, `/login`, `/register`), deep-link refreshes require a rewrite rule so Vercel returns `index.html`.

Create `frontend/vercel.json` before or during deployment:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Vercel Environment Variables
Configure the following in the **Environment Variables** tab of the Vercel project dashboard **before triggering the production build**:

| Variable Name | Required | Example Production Value | Purpose & How Frontend Uses It |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | **Yes** | `https://mindmap-api.onrender.com` | Base URL for REST API requests. **Do not include a trailing slash.** |
| `VITE_WS_BASE_URL` | No | `wss://mindmap-api.onrender.com` | Base URL for WebSocket connections. If omitted, `deriveWsUrl()` in `src/config/api.js` automatically converts `https://` to `wss://`. |

> **IMPORTANT:** In Vite, variables prefixed with `VITE_` are baked into client-side JavaScript bundles at build time. If you update `VITE_API_BASE_URL` in Vercel, you **must trigger a new deployment/rebuild** for changes to take effect.

---

## 4. MongoDB Atlas Database Configuration

MindMap utilizes MongoDB Atlas for persistence of user accounts, classroom metadata, and session history.

### Requirements & Setup Steps
1. **Cluster Tier:** Free M0 Sandbox (Shared) or higher.
2. **Database User:**
   - Create a dedicated database user (e.g. `mindmap_app_user`).
   - Assign built-in role `readWrite` on `mindmap_db` (or specific target database).
   - Use a strong alphanumeric password without URL-unsafe characters (or URL-encode if special characters are present).
3. **Network Access / IP Whitelisting & Security Trade-offs:**
   - **Operational Context:** Standard Render Web Services on shared/starter plans utilize dynamic outbound IP addresses that change frequently across cluster deployments. Consequently, pinning a static egress IP is not available on standard free/starter tiers.
   - **Recommended Practical Setting:** In MongoDB Atlas -> **Network Access** -> click **Add IP Address** -> select **Allow Access from Anywhere** (`0.0.0.0/0`).
   - **Security Trade-off & Mitigations:**
     - *Risk:* Opening network ingress to `0.0.0.0/0` removes IP-layer boundary isolation.
     - *Defense-in-Depth Mitigations:*
       a. **Mandatory TLS/SSL Wire Encryption:** Atlas forces TLS 1.2/1.3 for all client connections.
       b. **Dedicated Principle of Least Privilege:** Create a single-purpose database user with access restricted strictly to `mindmap_db` (never admin permissions).
       c. **High-Entropy Password:** Generate a 32+ character random password.
       d. **Paid/Team Upgrade Alternative:** For enterprise/production deployments requiring strict network whitelisting, upgrade to a Render Team plan with Static Outbound IPs, or configure AWS/GCP VPC Peering directly with MongoDB Atlas.

4. **Automatic Indexes:**
   - No manual database setup scripts or migrations are necessary.
   - When the Render backend starts up, `connect_to_mongo()` in `app/core/database.py` automatically initializes all required unique and compound indexes (`users.email`, `classrooms.join_code`, `classrooms.teacher_id`, `sessions.classroom_id`, `participants.session_id`).

---

## 5. Deployment Sequence & Smoke Test Verification

To prevent CORS or connection errors, deploy services in the following order:

### Phase A: Deploy Database (MongoDB Atlas)
1. Verify cluster is active and database user credentials are created.
2. Ensure Network Access whitelist has `0.0.0.0/0` enabled.
3. Obtain connection URI string.

### Phase B: Deploy Backend (Render)
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Set **Root Directory** to `backend`.
4. Set **Build Command** to `pip install -r requirements.txt`.
5. Set **Start Command** to `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
6. Add Environment Variables:
   - `ENVIRONMENT=production`
   - `MONGODB_URI=<your_atlas_connection_string>`
   - `DATABASE_NAME=mindmap_db`
   - `JWT_SECRET=<your_32_char_random_secret>`
   - `CORS_ORIGINS=http://localhost:5173` *(temporary placeholder until Vercel URL is known)*
7. Click **Create Web Service**.
8. Wait for build and deployment to complete. Obtain your Render URL (e.g. `https://mindmap-api.onrender.com`).
9. **Smoke Test Backend:**
   Visit `https://mindmap-api.onrender.com/health`.
   - Expected response: HTTP 200 `{"status":"ok","database":"connected"}`.

### Phase C: Deploy Frontend (Vercel)
1. In Vercel Dashboard, click **Add New...** -> **Project**.
2. Import your GitHub repository.
3. Set **Root Directory** to `frontend`.
4. Framework preset will automatically detect **Vite**.
5. Add Environment Variable:
   - `VITE_API_BASE_URL=https://mindmap-api.onrender.com`
6. Click **Deploy**.
7. Wait for build to complete. Obtain your live Vercel URL (e.g. `https://mindmap-app.vercel.app`).

### Phase D: Synchronize Production CORS Origin (Render)
1. Return to the Render dashboard for your backend service.
2. In **Environment Variables**, update `CORS_ORIGINS`:
   `CORS_ORIGINS=https://mindmap-app.vercel.app`
3. Save changes. Render will automatically redeploy the service with the new CORS origin whitelist.

---

## 6. Post-Deployment Smoke Test Checklist

Once both services are deployed, perform this complete live validation:

1. **REST API Health Check:**
   - Request: `GET https://mindmap-api.onrender.com/health`
   - Expected: HTTP 200 `{"status":"ok","database":"connected"}`.
2. **CORS Validation:**
   - In Chrome DevTools on `https://mindmap-app.vercel.app`, verify that network requests to `https://mindmap-api.onrender.com/api/auth/...` include `Access-Control-Allow-Origin: https://mindmap-app.vercel.app` and `Access-Control-Allow-Credentials: true`.
3. **Teacher Registration & Classroom Creation:**
   - Register a teacher account on Vercel frontend.
   - Create a classroom and note the generated 6-character Join Code.
   - Click **Start Live Session**.
4. **Student Entry & Device Check:**
   - Open a secondary incognito window at `https://mindmap-app.vercel.app`.
   - Register a student account and enter the classroom Join Code.
   - On the `/student/check` page, grant webcam permission. Verify local video renders.
   - Click **Calibrate & Enter Classroom**.
5. **WebSocket Telemetry Dispatch:**
   - Switch to the Teacher window. Confirm the student appears in the live roster.
   - In student window, look away from screen for 3 seconds.
   - Verify Teacher dashboard displays live telemetry update (`REDUCED_ENGAGEMENT_LIKE`).
6. **Session Termination & Summary Report:**
   - On Teacher dashboard, click **End Session**.
   - Verify both Teacher and Student receive `session_ended` notification.
   - Verify session summary report loads at `/teacher/session/:sessionId/report`.

---

## 7. Troubleshooting Common Production Issues

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| **Backend reports 503 on `/health`** | Backend cannot reach MongoDB Atlas cluster. | 1. Check MongoDB Atlas Network Access whitelist (`0.0.0.0/0`).<br>2. Check user credentials and database name in `MONGODB_URI`.<br>3. Inspect Render service logs. |
| **Backend fails on startup with `ValidationError`** | `ENVIRONMENT=production` was set, but `JWT_SECRET` is missing, default, or < 32 chars. | Set `JWT_SECRET` to a 32+ character random string in Render environment settings. |
| **CORS error in browser console: `blocked by CORS policy`** | `CORS_ORIGINS` in Render does not match the exact Vercel frontend domain. | Update `CORS_ORIGINS` in Render to match `https://your-app.vercel.app` (ensure protocol is `https://` and there is no trailing slash). |
| **WebSocket closes with error code 1008** | Authentication failure, inactive session, or participant not joined in DB. | Verify user is logged in, session status is `"active"`, and student joined via REST before opening WebSocket. |
| **404 error on page refresh on Vercel** | Client-side routing not rewritten to `index.html`. | Ensure `frontend/vercel.json` exists with rewrite rule `{"source": "/(.*)", "destination": "/index.html"}`. |
| **Render Web Service spins down on free tier** | Render free tier services sleep after 15 minutes of inactivity. | Allow 30â€“60 seconds for cold start on first request, or upgrade to a paid persistent instance for uninterrupted live demos. |

---

## 8. Readiness Assessment & Final Conclusion

- **Readiness Decision:** **READY FOR MANUAL DEPLOYMENT**
- **Inspected & Verified Assets:**
  - `backend/app/main.py`: CORS configuration, health endpoint.
  - `backend/app/core/config.py`: Environment validation, JWT secret rules.
  - `backend/app/core/database.py`: Active MongoDB ping check.
  - `frontend/src/config/api.js`: URL sanitization and WebSocket derivation.
  - `frontend/package.json` & `vite.config.js`: Verified production build commands.
- **Automated Verification:**
  - Backend integration tests: 18/18 passed.
  - Offline ML tests: 27/27 passed.
  - Frontend algorithmic & unit tests: 11/11 passed.
  - Frontend build: Completed in 628ms.
