from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

# Allow specific origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api import courses, auth, users, modules, journeys, websocket, flashcards, revisions, providers, chat

app.include_router(auth.router, prefix=settings.API_V1_STR + "/auth", tags=["auth"])
app.include_router(users.router, prefix=settings.API_V1_STR + "/users", tags=["users"])
app.include_router(courses.router, prefix=settings.API_V1_STR + "/courses", tags=["courses"])
app.include_router(modules.router, prefix=settings.API_V1_STR + "/courses/{course_id}/modules", tags=["modules"])
app.include_router(journeys.router, prefix=settings.API_V1_STR + "/journeys", tags=["journeys"])
app.include_router(websocket.router, tags=["websocket"])  # Mounted at root: /ws/courses/{id}
app.include_router(flashcards.router, prefix=settings.API_V1_STR + "/courses/{course_id}/modules/{module_id}/flashcards", tags=["flashcards"])
app.include_router(revisions.router, prefix=settings.API_V1_STR + "/courses/{course_id}/final-revision", tags=["revisions"])
app.include_router(chat.router, prefix=settings.API_V1_STR, tags=["chat"])
app.include_router(providers.router, prefix=settings.API_V1_STR + "/providers", tags=["providers"])

@app.get("/")
async def root():
    return {"message": "Welcome to Lurio API"}
