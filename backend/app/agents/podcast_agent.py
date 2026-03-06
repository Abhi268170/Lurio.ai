import json
from typing import List, Dict
from app.agents.architect import ArchitectAgent

class PodcastAgent:
    def __init__(self, provider="groq", model=None, api_key=None):
        self.architect = ArchitectAgent(provider=provider, model=model, api_key=api_key)

    async def generate_script(self, course_topic: str, modules: List[Dict]) -> List[Dict]:
        """
        Generate a conversational podcast script for a course.
        Returns a list of turns: [{"speaker": "A", "text": "..."}, ...]
        """
        content_summary = "\n".join([f"- {m['title']}: {m.get('content', '')[:200]}..." for m in modules])
        
        prompt = f"""
        Create a conversational podcast script between two hosts, Alex (A) and Jamie (B), about the course topic: {course_topic}.
        
        Alex is the expert/teacher, and Jamie is the curious/insightful student.
        The podcast should be engaging, natural, and summarize the key points from these course modules.
        Keep the entire podcast concise, aiming for about 10-15 total dialogue turns in the script.
        
        Rules:
        1. Alex (A) should lead the conversation.
        2. Jamie (B) should ask questions and provide analogies.
        3. Keep it conversational - use "um", "wow", "interesting".
        4. Focus on making complex topics simple.
        5. Return ONLY a JSON list of objects with "speaker" (A or B) and "text" keys.
        
        Example format:
        [
          {{"speaker": "A", "text": "Welcome to the podcast! Today we're talking about {course_topic}."}},
          {{"speaker": "B", "text": "I've been looking forward to this one, Alex."}}
        ]
        """
        
        response = await self.architect.generate_content(prompt)
        
        # Parse JSON from response
        try:
            # Look for JSON code block or raw JSON
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0].strip()
            else:
                json_str = response.strip()
            
            script = json.loads(json_str)
            return script
        except Exception as e:
            print(f"Error parsing podcast script: {e}")
            # Fallback script
            return [
                {"speaker": "A", "text": f"Welcome! Today we're learning about {course_topic}."},
                {"speaker": "B", "text": "That's right, Alex. Let's dive in."}
            ]
