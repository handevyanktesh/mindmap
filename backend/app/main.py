from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection, check_mongo_health
from app.routes import auth, classrooms, sessions, ws, reflections, chat
import contextlib

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup event
    connect_to_mongo()
    yield
    # Shutdown event
    close_mongo_connection()

app = FastAPI(title="MindMap API", lifespan=lifespan)

# Configurable CORS with explicitly trusted origins, regex patterns, and credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(classrooms.router, prefix="/api/classrooms", tags=["classrooms"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(reflections.router, prefix="/api/reflections", tags=["reflections"])
app.include_router(chat.router, prefix="/api/sessions", tags=["chat"])
app.include_router(ws.router, prefix="/ws", tags=["websocket"])

@app.get("/health")
def health_check(response: Response):
    is_healthy = check_mongo_health()
    if is_healthy:
        return {"status": "ok", "database": "connected"}
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "unhealthy", "database": "disconnected"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=(settings.ENVIRONMENT == "development"),
    )
