import json
import httpx
from app.core.config import settings

PROVIDER_URLS = {
    "groq": "https://api.groq.com/openai/v1/chat/completions",
    "openai": "https://api.openai.com/v1/chat/completions",
    "openrouter": "https://openrouter.ai/api/v1/chat/completions",
    "anthropic": "https://api.anthropic.com/v1/messages",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", # OpenAI compatible endpoint
    "ollama": f"{settings.OLLAMA_HOST}/api/chat",
}

PROVIDER_KEYS = {
    "groq": settings.GROQ_API_KEY,
    "openai": settings.OPENAI_API_KEY,
    "openrouter": settings.OPENROUTER_API_KEY,
    "anthropic": settings.ANTHROPIC_API_KEY,
    "gemini": settings.GEMINI_API_KEY,
    "ollama": None,
}

class ArchitectAgent:
    def __init__(self, provider: str = "ollama", model: str = None, api_key: str = None):
        self.provider = provider or "ollama"
        self.model = model
        self.api_key = api_key or PROVIDER_KEYS.get(self.provider)

    async def generate_content(self, prompt: str, system: str = None) -> str:
        """Generate content from the selected provider."""
        provider = self.provider.lower()
        
        if provider == "ollama":
            return await self._call_ollama(prompt)
        else:
            return await self._call_openai_compat(prompt, system)

    async def _call_openai_compat(self, prompt: str, system: str = None) -> str:
        provider = self.provider.lower()
        url = PROVIDER_URLS.get(provider, PROVIDER_URLS["openrouter"])
        api_key = self.api_key or PROVIDER_KEYS.get(provider, "")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if provider == "openrouter":
            headers["HTTP-Referer"] = "https://lurio.ai"
            headers["X-Title"] = "Lurio"

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        model = self.model or {
            "groq": settings.GROQ_MODEL,
            "openrouter": settings.OPENROUTER_MODEL,
            "openai": "gpt-4o-mini",
        }.get(provider, settings.GROQ_MODEL)

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.7,
        }

        import random
        import asyncio

        max_retries = 6
        base_delay = 2.0
        retryable = {429, 503, 502, 504}

        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(url, json=payload, headers=headers)

                    if response.status_code in retryable:
                        if attempt == max_retries - 1:
                            response.raise_for_status()
                        delay = base_delay * (2 ** attempt) + random.uniform(0, 2)
                        print(f"DEBUG: {provider} {response.status_code} — retrying in {delay:.1f}s (attempt {attempt+1}/{max_retries})")
                        await asyncio.sleep(delay)
                        continue

                    response.raise_for_status()
                    data = response.json()
                    return data["choices"][0]["message"]["content"]

            except httpx.HTTPStatusError as e:
                if e.response.status_code not in retryable or attempt == max_retries - 1:
                    raise
                delay = base_delay * (2 ** attempt) + random.uniform(0, 2)
                await asyncio.sleep(delay)
            except Exception:
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(base_delay)

        return ""

    async def _call_ollama(self, prompt: str) -> str:
        url = f"{settings.OLLAMA_HOST}/api/generate"
        payload = {
            "model": self.model or settings.OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            return response.json().get("response", "")

    # --- Streaming methods (yield raw text chunks, not SSE format) ---

    async def generate_content_stream(self, prompt: str, system: str = None):
        """Stream raw text chunks from the selected provider."""
        provider = self.provider.lower()
        if provider == "ollama":
            async for chunk in self._stream_ollama_generate(prompt):
                yield chunk
        else:
            async for chunk in self._stream_openai_compat_generate(prompt, system):
                yield chunk

    async def _stream_openai_compat_generate(self, prompt: str, system: str = None):
        """Stream raw text chunks via OpenAI-compatible chat completions."""
        import random
        import asyncio

        provider = self.provider.lower()
        url = PROVIDER_URLS.get(provider, PROVIDER_URLS["openrouter"])
        api_key = self.api_key or PROVIDER_KEYS.get(provider, "")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if provider == "openrouter":
            headers["HTTP-Referer"] = "https://lurio.ai"
            headers["X-Title"] = "Lurio"

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        model = self.model or {
            "groq": settings.GROQ_MODEL,
            "openrouter": settings.OPENROUTER_MODEL,
            "openai": "gpt-4o-mini",
        }.get(provider, settings.GROQ_MODEL)

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.7,
            "stream": True,
        }

        max_retries = 6
        base_delay = 2.0
        retryable = {429, 503, 502, 504}

        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    async with client.stream("POST", url, json=payload, headers=headers) as response:
                        if response.status_code in retryable:
                            if attempt == max_retries - 1:
                                response.raise_for_status()
                            delay = base_delay * (2 ** attempt) + random.uniform(0, 2)
                            await asyncio.sleep(delay)
                            continue

                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if line.startswith("data: ") and line != "data: [DONE]":
                                try:
                                    data = json.loads(line[6:])
                                    chunk = data["choices"][0].get("delta", {}).get("content", "")
                                    if chunk:
                                        yield chunk
                                except Exception:
                                    pass
                        return

            except httpx.HTTPStatusError as e:
                if e.response.status_code not in retryable or attempt == max_retries - 1:
                    raise
                delay = base_delay * (2 ** attempt) + random.uniform(0, 2)
                await asyncio.sleep(delay)
            except Exception:
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(base_delay)

    async def _stream_ollama_generate(self, prompt: str):
        """Stream raw text chunks via Ollama /api/generate."""
        url = f"{settings.OLLAMA_HOST}/api/generate"
        payload = {
            "model": self.model or settings.OLLAMA_MODEL,
            "prompt": prompt,
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            chunk = data.get("response", "")
                            if chunk:
                                yield chunk
                        except Exception:
                            pass
