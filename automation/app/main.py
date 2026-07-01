from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.modules.auth.routers.auth import router as auth_router
from app.modules.upload.routers.upload import router as upload_router

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Auth routers
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(upload_router, prefix="/api/upload", tags=["upload"])

# Mount frontend static files at root
app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")
