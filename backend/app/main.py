from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import connect_to_mongo, close_mongo_connection
from app.routes import auth, classrooms, sessions
import contextlib

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup event
    connect_to_mongo()
    yield
    # Shutdown event
    close_mongo_connection()

app = FastAPI(title="MindMap API", lifespan=lifespan)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(classrooms.router, prefix="/api/classrooms", tags=["classrooms"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
