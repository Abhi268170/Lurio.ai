import json
from typing import AsyncGenerator, List, Dict
import httpx
from app.agents.architect import PROVIDER_URLS, PROVIDER_KEYS
from app.core.config import settings

class PopoAgent:
    def __init__(self, provider: str = "ollama", model: str = None, api_key: str = None):
        self.provider = provider or "ollama"
        self.model = model
        self.api_key = api_key or PROVIDER_KEYS.get(self.provider)

    async def chat_stream(self, text: str, history: List[Dict], topic: str, module_title: str) -> AsyncGenerator[str, None]:
        system_prompt = f"""
        You are Popo, a friendly AI tutor assisting a student with their course on "{topic}".
        Specifically, they are currently in the lesson titled "{module_title}".
        Your job is to clarify doubts and explain concepts simply.
        Be encouraging, concise, and helpful. 
        Note that you have a limit of 2 follow-ups per thread on the frontend to keep the student focused.
        """
        
        provider = self.provider.lower()
        
        # Prepare messages
        messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        
        # We append the newest text reference as the user message if it's the very first request
        if not history:
            messages.append({"role": "user", "content": f"Can you explain this excerpt to me?\n\nExcerpt:\n{text}"})
        else:
            # If there's history, text is the latest user utterance
            messages.append({"role": "user", "content": text})

        if provider == "ollama":
            async for chunk in self._stream_ollama(messages):
                yield chunk
        else:
            async for chunk in self._stream_openai_compat(messages):
                yield chunk

    async def _stream_openai_compat(self, messages: List[Dict]) -> AsyncGenerator[str, None]:
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

        # Retry logic with exponential backoff
        max_retries = 5
        base_delay = 1.0  # seconds
        
        import random
        import asyncio

        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    async with client.stream("POST", url, json=payload, headers=headers) as response:
                        if response.status_code == 429:
                            if attempt == max_retries - 1:
                                response.raise_for_status()
                            
                            delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                            print(f"DEBUG: Popo stream 429 detected. Retrying in {delay:.2f}s (Attempt {attempt+1}/{max_retries})")
                            await asyncio.sleep(delay)
                            continue

                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if line.startswith("data: ") and line != "data: [DONE]":
                                try:
                                    data = json.loads(line[6:])
                                    chunk = data["choices"][0].get("delta", {}).get("content", "")
                                    if chunk:
                                        yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                                except Exception:
                                    pass
                        return # Success
            
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                if isinstance(e, httpx.HTTPStatusError) and e.response.status_code != 429:
                    raise
                if attempt == max_retries - 1:
                    raise
                await asyncio.sleep(base_delay * (2 ** attempt))

    async def _stream_ollama(self, messages: List[Dict]) -> AsyncGenerator[str, None]:
        url = f"{settings.OLLAMA_HOST}/api/chat"
        payload = {
            "model": self.model or settings.OLLAMA_MODEL,
            "messages": messages,
            "stream": True,
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            chunk = data.get("message", {}).get("content", "")
                            if chunk:
                                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                        except Exception:
                            pass
