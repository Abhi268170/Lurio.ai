import json
import re
from typing import List, Dict, AsyncGenerator
from app.agents.architect import ArchitectAgent

class ProfessorAgent:
    def __init__(self, provider: str = "ollama", model: str = None, api_key: str = None):
        self.architect = ArchitectAgent(provider=provider, model=model, api_key=api_key)

    async def generate_module_content(self, topic: str, module_title: str, module_description: str, difficulty: str, user_profile_injection: str = "") -> str:
        """
        Generate detailed educational content for a module.
        Beginner: Super simple explanations, many analogies.
        Intermediate: Simple but thorough explanations.
        Advanced: Moderate complexity, technical depth.
        """
        complexity_guide = {
            "beginner": "super simple, using very basic language and frequent analogies (like explaining to a child).",
            "intermediate": "simple and clear, but thorough and professional.",
            "advanced": "moderately complex, including technical terms and deeper conceptual depth."
        }
        complexity = complexity_guide.get(difficulty.lower(), "simple")

        system_prompt = f"""
        You are an expert Professor specialized in teaching {topic}.
        Your goal is to write a detailed lesson for the module: "{module_title}".
        The student is at a {difficulty} level, so your explanation should be {complexity}

        Formatting Rules:
        1. Use clear Markdown.
        2. Include a catchy title.
        3. Use sections with ## headings.
        4. Use bullet points for key takeaways.
        5. Include a "Summary" section at the end.
        {user_profile_injection}
        """

        prompt = f"""
        Write the lesson content for: "{module_title}"
        Context/Objectives: {module_description}

        Aim for a comprehensive explanation of about 600-1000 words.
        """

        return await self.architect.generate_content(prompt, system=system_prompt)

    async def generate_module_content_stream(self, topic: str, module_title: str, module_description: str, difficulty: str, user_profile_injection: str = ""):
        """Streaming version of generate_module_content."""
        complexity_guide = {
            "beginner": "super simple, using very basic language and frequent analogies (like explaining to a child).",
            "intermediate": "simple and clear, but thorough and professional.",
            "advanced": "moderately complex, including technical terms and deeper conceptual depth."
        }
        complexity = complexity_guide.get(difficulty.lower(), "simple")

        system_prompt = f"""
        You are an expert Professor specialized in teaching {topic}.
        Your goal is to write a detailed lesson for the module: "{module_title}".
        The student is at a {difficulty} level, so your explanation should be {complexity}

        Formatting Rules:
        1. Use clear Markdown.
        2. Include a catchy title.
        3. Use sections with ## headings.
        4. Use bullet points for key takeaways.
        5. Include a "Summary" section at the end.
        {user_profile_injection}
        """

        prompt = f"""
        Write the lesson content for: "{module_title}"
        Context/Objectives: {module_description}

        Aim for a comprehensive explanation of about 600-1000 words.
        """

        async for chunk in self.architect.generate_content_stream(prompt, system=system_prompt):
            yield chunk

    async def generate_flashcards(self, module_title: str, module_content: str) -> List[Dict]:
        """Generate 5-8 flashcards from module content."""
        system_prompt = "You are a study assistant. Extract key concepts into simple flashcards."
        prompt = f"""
        Based on the following content for "{module_title}", generate 5-8 flashcards.
        Return ONLY a JSON array of objects with "front" and "back" keys.
        
        Style Rules:
        - "front": A single key term, concept name, or short phrase. No questions.
        - "back": A simple, concise explanation of that term/concept (1-2 short sentences).
        
        Content:
        {module_content}
        """
        response = await self.architect.generate_content(prompt, system=system_prompt)
        try:
            match = re.search(r'\[\s*\{.*\}\s*\]', response, re.DOTALL)
            if match:
                return json.loads(match.group())
            return json.loads(response.strip())
        except:
            return [{"front": "What is the main takeaway?", "back": "Refer to the module summary."}]

    async def generate_recall_question(self, module_title: str, module_content: str) -> str:
        """Generate one open-ended question to test conceptual mastery (Popo Checkpoint)."""
        prompt = f"""
        Based on the module "{module_title}", generate ONE open-ended question that requires 
        the student to explain the most important concept in their own words.
        
        Content:
        {module_content}
        
        Return ONLY the question text.
        """
        return (await self.architect.generate_content(prompt)).strip()

    async def verify_recall_answer(self, question: str, answer: str, module_content: str) -> Dict:
        """Evaluate Popo Checkpoint answer."""
        prompt = f"""
        Question: {question}
        Student's Answer: {answer}
        
        Context:
        {module_content}
        
        Evaluate if the answer shows mastery of the concept.
        Return ONLY a JSON object with:
        "is_correct": true/false,
        "feedback": "A brief, encouraging explanation of why they are right or what they missed."
        """
        response = await self.architect.generate_content(prompt)
        try:
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                return json.loads(match.group())
            return json.loads(response.strip())
        except:
            return {"is_correct": True, "feedback": "Good job on completing the module!"}

    async def generate_final_quiz(self, course_topic: str, modules_data: List[Dict]) -> List[Dict]:
        """Generate a 10-question multiple choice final exam."""
        summary = "\n".join([f"Module: {m['title']}\nContent: {m.get('content', '')[:300]}..." for m in modules_data])
        prompt = f"""
        Generate a 10-question multiple-choice final exam for: "{course_topic}".
        Use this content summary:
        {summary}
        
        Each object must have:
        "question": string,
        "options": list of 4 strings,
        "correct_answer": the exact string from options that is correct.
        
        Return ONLY a JSON array of these objects.
        """
        response = await self.architect.generate_content(prompt)
        try:
            match = re.search(r'\[\s*\{.*\}\s*\]', response, re.DOTALL)
            if match:
                return json.loads(match.group())
            return json.loads(response.strip())
        except:
            return []
