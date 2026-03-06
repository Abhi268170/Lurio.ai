# Lurio — AI-Powered EdTech Platform

Lurio is an intelligent learning platform that transforms any topic into a comprehensive course with lessons, quizzes, and even its own podcast.

## 🚀 Monorepo Structure

- **`backend/`**: FastAPI server handling course generation, AI orchestration, and user authentication.
- **`frontend/`**: React (Vite) application with a modern, glassmorphic UI.
- **`docker-compose.yml`**: Orchestrates the entire stack (Postgres, Redis, Celery, Ollama, Backend, Frontend).

## 🎙️ Key Feature: Podcast Generation
Lurio can generate natural, human-like podcasts for every course using **ElevenLabs TTS**. Listen to a two-host conversation about your learning material on the go!

## 🛠️ Setup & Running

### Prerequisites
- Docker & Docker Compose
- ElevenLabs API Key (for podcasts)
- Groq/OpenRouter/OpenAI API Key (for content)

### Quick Start
1. Clone the repository.
2. Update `docker-compose.yml` with your API keys.
3. Run the stack:
   ```bash
   docker compose up --build
   ```
4. Access the app at `http://localhost:3000`.

## 📂 Internal Resources
- `docs/`: PRDs, Architecture specs, and legacy documentation (ignored from git).
- `legacy_archive/`: Archived prototypes and old assets (ignored from git).
