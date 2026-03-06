from fastapi import APIRouter, HTTPException
import httpx
from app.core.config import settings

router = APIRouter()

# Static model lists per provider (fallback + curated)
PROVIDER_MODELS = {
    "groq": [
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
        "llama3-70b-8192",
        "llama3-8b-8192",
    ],
    "openai": [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-3.5-turbo",
    ],
    "anthropic": [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
    ],
    "gemini": [
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-2.0-flash",
    ],
    "openrouter": [
        "google/gemma-3n-e2b-it:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "deepseek/deepseek-r1:free",
        "openai/gpt-4o-mini",
        "anthropic/claude-3.5-sonnet",
    ],
}

@router.post("/models")
async def get_models(body: dict):
    """
    Return available models for the given provider.
    Attempts to fetch live from the API if possible, otherwise returns a static list.
    """
    provider = body.get("provider", "ollama").lower()
    api_key = body.get("api_key", "")

    if provider == "ollama":
        # Fetch from local Ollama instance
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{settings.OLLAMA_HOST}/api/tags")
                response.raise_for_status()
                data = response.json()
                models = [m["name"] for m in data.get("models", [])]
                return models if models else ["gemma2:2b"]
        except Exception:
            return ["gemma2:2b"]

    elif provider == "groq":
        # Try to fetch live from Groq if key provided
        if api_key and len(api_key) > 10:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(
                        "https://api.groq.com/openai/v1/models",
                        headers={"Authorization": f"Bearer {api_key}"},
                    )
                    if response.status_code == 200:
                        data = response.json()
                        return sorted([m["id"] for m in data.get("data", [])])
            except Exception:
                pass
        return PROVIDER_MODELS.get("groq", [])

    elif provider == "openai":
        if api_key and len(api_key) > 10:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(
                        "https://api.openai.com/v1/models",
                        headers={"Authorization": f"Bearer {api_key}"},
                    )
                    if response.status_code == 200:
                        data = response.json()
                        # Filter for common chat models to avoid cluttering with embeddings etc.
                        models = [m["id"] for m in data.get("data", []) if "gpt" in m["id"]]
                        return sorted(models)
            except Exception:
                pass
        return PROVIDER_MODELS.get("openai", [])

    elif provider == "anthropic":
        # Anthropic doesn't have a simple public "list models" endpoint like OpenAI.
        # It's usually better to stick to the static list or use a known set.
        return PROVIDER_MODELS.get("anthropic", [])

    elif provider == "gemini":
        if api_key and len(api_key) > 10:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    # Google AI Studio / Gemini API
                    response = await client.get(
                        f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
                    )
                    if response.status_code == 200:
                        data = response.json()
                        models = [m["name"].split("/")[-1] for m in data.get("models", []) 
                                 if "generateContent" in m.get("supportedGenerationMethods", [])]
                        return sorted(models)
            except Exception:
                pass
        return PROVIDER_MODELS.get("gemini", [])

    elif provider == "openrouter":
        try:
            # OpenRouter models endpoint is public but can be filtered with key
            headers = {}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get("https://openrouter.ai/api/v1/models", headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    return sorted([m["id"] for m in data.get("data", [])])
        except Exception:
            pass
        return PROVIDER_MODELS.get("openrouter", [])

    # All other providers use static lists
    return PROVIDER_MODELS.get(provider, [])
