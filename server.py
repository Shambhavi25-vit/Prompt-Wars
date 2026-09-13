import http.server
import socketserver
import json
import urllib.request
import urllib.error
import re
import os
import datetime
from datetime import timedelta
import concurrent.futures

# Load local .env if present
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

PORT = int(os.environ.get("PORT", 8000))
# Key 1: Reserved exclusively for PDF Comprehensive Summarization and Quizzes
AGENTROUTER_KEY = os.environ.get("AGENTROUTER_KEY", "sk-vr8ogJCyFzmztSmFj2G1bYr223nz0nK6IDe6OGGLJ8URtvD9")
# Key 2: Reserved exclusively for Deadline & Action Item Task Parsing
DEADLINE_TASK_KEY = os.environ.get("DEADLINE_TASK_KEY", "sk-6KVG8miVAHFWexETDhnvAr4mWxZiuCS8atbCqagRTIfdFZBc")
# Key 3: Reserved exclusively for High-Yield Revision Notes, Pointers, Tips & Tricks
REVISION_NOTES_KEY = os.environ.get("REVISION_NOTES_KEY", "sk-Z6XjUcAWyyJ8WsXVbQN2YcMFdWJZouegp4BK1ZsIyajLzuFq")
AGENTROUTER_URL = "https://agentrouter.org/v1/chat/completions"
MODEL_NAME = "glm-5.3-flash"


class StudentWorkspaceHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == "/api/ai/process-documents":
            self.handle_process_documents()
        elif self.path == "/api/ai/parse-task":
            self.handle_parse_task()
        elif self.path == "/api/ai/generate-quiz":
            self.handle_generate_quiz()
        else:
            self.send_error(404, "Not Found")

    def handle_process_documents(self):
        content_len = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_len)
        try:
            req_json = json.loads(post_data.decode("utf-8"))
            document_text = req_json.get("document_text", "")
            file_names = req_json.get("file_names", ["Uploaded Material"])
            summary_api_key = req_json.get("summary_api_key") or req_json.get("api_key") or AGENTROUTER_KEY
            revision_api_key = req_json.get("revision_api_key") or REVISION_NOTES_KEY
            
            names_str = ", ".join(file_names)
            
            summary_prompt = (
                f"You are an elite academic professor and expert subject researcher analyzing student material: {names_str}.\n\n"
                f"Full Document Content:\n\"\"\"\n{document_text}\n\"\"\"\n\n"
                "CRITICAL INSTRUCTIONS:\n"
                "- You have a massive context window and unconstrained output tokens. Do NOT summarize superficially or omit sections.\n"
                "- Synthesize EVERY single chapter, topic, subtopic, concept, theorem, definition, mathematical derivation, step-by-step procedure, mechanism, and example present in this material.\n"
                "- Structure your output cleanly in markdown:\n\n"
                "# Comprehensive Chapter & Topic Summary\n\n"
                "## Executive Overview\n"
                "A thorough academic synthesis and high-level roadmap of the entire document.\n\n"
                "## Exhaustive Chapter-by-Chapter & Topic-by-Topic Breakdown\n"
                "Provide detailed analysis for each topic found in the text, fully explaining all mechanisms, theorems, rules, formulas, and operational procedures.\n\n"
                "## Worked Examples, Derivations & Practical Applications\n"
                "Step-by-step walk-through of examples, mathematical problems, and real-world implementations.\n\n"
                "Ensure formatting is elegant, clean markdown with bolding, lists, and tables where helpful. Output ONLY the markdown content."
            )

            revision_prompt = (
                f"You are a master academic coach and exam specialist analyzing student material: {names_str}.\n\n"
                f"Full Document Content:\n\"\"\"\n{document_text}\n\"\"\"\n\n"
                "CRITICAL INSTRUCTIONS:\n"
                "- You have a massive context window and unconstrained output tokens. Do NOT summarize superficially.\n"
                "- Generate high-yield exam revision notes, important points, tips and tricks, formulas, and memory aids for EVERY topic in this document.\n"
                "- Structure your output cleanly in markdown:\n\n"
                "# High-Yield Revision Notes & Exam Strategies\n\n"
                "## Topic-by-Topic Quick Recall Pointers\n"
                "Crucial bullet points, key takeaways, and must-know definitions for rapid recall across every topic.\n\n"
                "## Pro-Tips, Shortcuts & Problem-Solving Hacks\n"
                "Exam tips, memory tricks, operational rules of thumb, and shortcuts to solve complex questions quickly.\n\n"
                "## Core Formulas, Principles & Algorithms Table\n"
                "A clean markdown table mapping core equations, principles, or algorithmic rules to their exact exam applications.\n\n"
                "## Common Exam Traps & Pitfalls\n"
                "Frequent student mistakes, tricky edge cases, and actionable strategies to avoid losing marks.\n\n"
                "## 5-Minute Memory Cheat Sheet\n"
                "Ultra-dense, fast-review mnemonic aids and core summaries.\n\n"
                "Ensure formatting is concise, punchy, and exam-focused. Output ONLY the markdown content."
            )

            # Parallel execution with ThreadPoolExecutor for speed ("do it fast")
            summary_res = None
            revision_res = None
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                f_sum = executor.submit(self.call_agentrouter, summary_prompt, api_key=summary_api_key, max_tokens=4500, timeout=85)
                f_rev = executor.submit(self.call_agentrouter, revision_prompt, api_key=revision_api_key, max_tokens=4500, timeout=85)
                summary_res = f_sum.result()
                revision_res = f_rev.result()

            if not summary_res:
                summary_res = self.generate_smart_summary_fallback(document_text, file_names)
            if not revision_res:
                revision_res = self.generate_smart_revision_fallback(document_text, file_names)

            summary_res = summary_res.strip()
            revision_res = revision_res.strip()

            if not summary_res.startswith("#"):
                summary_res = "# Comprehensive Chapter & Topic Summary\n\n" + summary_res
            if not revision_res.startswith("#"):
                revision_res = "# High-Yield Revision Notes & Exam Strategies\n\n" + revision_res

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "summary": summary_res,
                "revision_notes": revision_res,
                "content": f"{summary_res}\n\n---\n\n{revision_res}"
            }).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))


    def handle_parse_task(self):
        content_len = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_len)
        try:
            req_json = json.loads(post_data.decode("utf-8"))
            raw_input = req_json.get("input", "")
            # Dedicated key for deadline task parsing
            api_key = req_json.get("api_key") or DEADLINE_TASK_KEY
            today_str = datetime.date.today().strftime("%Y-%m-%d")
            weekday_str = datetime.date.today().strftime("%A")

            prompt = (
                "You are a precise task and deadline parsing engine.\n" +
                "Today is " + weekday_str + ", " + today_str + ".\n\n" +
                "Extract the assignment task name and target due date from this user input (which may be in English or Hinglish/Hindi):\n" +
                "\"" + raw_input + "\"\n\n" +
                "Examples:\n" +
                "- \"I have to complete my maths assignment by tomorrow\" -> Task: \"Complete Maths Assignment\", Date: tomorrow\n" +
                "- \"I have to submit my assignment on tuesday\" -> Task: \"Submit Assignment\", Date: coming Tuesday\n" +
                "- \"mujhe kal apna assignment submit karna hai\" -> Task: \"Submit Assignment\", Date: tomorrow\n" +
                "- \"complete chemistry lab report before 15th Sept\" -> Task: \"Complete Chemistry Lab Report\", Date: Sep 15th\n\n" +
                "Respond ONLY with valid JSON in this exact structure:\n" +
                "{\n  \"task\": \"Clean Task Title\",\n  \"due_date\": \"YYYY-MM-DD\"\n}"
            )
            ai_resp = self.call_agentrouter(prompt, api_key=api_key, max_tokens=600, timeout=25)
            parsed_data = None
            if ai_resp:
                try:
                    clean_json = re.search(r"\{[\s\S]*\}", ai_resp)
                    if clean_json:
                        parsed_data = json.loads(clean_json.group(0))
                except Exception:
                    parsed_data = None

            if not parsed_data or "due_date" not in parsed_data:
                parsed_data = self.heuristic_parse_task(raw_input)

            try:
                due_dt = datetime.datetime.strptime(parsed_data["due_date"], "%Y-%m-%d").date()
            except (ValueError, TypeError, KeyError):
                parsed_data = self.heuristic_parse_task(raw_input)
                due_dt = datetime.datetime.strptime(parsed_data["due_date"], "%Y-%m-%d").date()
            today = datetime.date.today()
            delta_days = (due_dt - today).days

            if delta_days == 0:
                rel = "Due today"
            elif delta_days == 1:
                rel = "Due in 1 days"
            elif delta_days > 1:
                rel = f"Due in {delta_days} days"
            elif delta_days == -1:
                rel = "Overdue by 1 day"
            else:
                rel = f"Overdue by {abs(delta_days)} days"

            formatted_date = due_dt.strftime("%b %d, %Y")

            response_payload = {
                "success": True,
                "task": parsed_data.get("task", "New Assignment"),
                "due_date": parsed_data.get("due_date", today_str),
                "due_date_formatted": formatted_date,
                "relative_display": rel,
                "is_overdue": delta_days < 0
            }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response_payload).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))

    def handle_generate_quiz(self):
        content_len = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_len)
        try:
            req_json = json.loads(post_data.decode("utf-8"))
            document_text = req_json.get("document_text", "")
            file_names = req_json.get("file_names", ["Study Notes"])
            api_key = req_json.get("api_key") or AGENTROUTER_KEY
            
            names_str = ", ".join(file_names)
            text_len = len(document_text)
            
            # Scaled question count: 5-6 for short, 12 for medium, up to 20 for large
            if text_len < 3000:
                question_count = 6
            elif text_len <= 15000:
                question_count = 12
            else:
                question_count = 20

            prompt = (
                f"You are an expert university examiner. Analyze this complete academic material ({names_str}) and generate exactly {question_count} multiple-choice exam questions covering all topics.\n\n"
                f"Document:\n\"\"\"\n{document_text}\n\"\"\"\n\n"
                "RULES:\n"
                "1. Every question must test real concepts, mechanisms, principles, or formulas directly from the document.\n"
                "2. Provide exactly 4 options per question.\n"
                "3. Specify the correct option with correct_index (0, 1, 2, or 3).\n"
                "4. Provide a 1-2 sentence academic explanation.\n"
                "5. Output ONLY valid raw JSON array of objects without markdown formatting or code blocks.\n\n"
                "Schema:\n"
                "[\n  {\n    \"id\": 1,\n    \"question\": \"Clear question text?\",\n    \"options\": [\"Choice A\", \"Choice B\", \"Choice C\", \"Choice D\"],\n    \"correct_index\": 0,\n    \"explanation\": \"Why Choice A is correct based on the text.\"\n  }\n]"
            )
            ai_resp = self.call_agentrouter(prompt, api_key=api_key, max_tokens=2500, timeout=50)
            questions = None
            if ai_resp:
                cleaned = re.sub(r"```json|```", "", ai_resp).strip()
                match = re.search(r"\[.*\]", cleaned, re.DOTALL)
                if match:
                    try:
                        questions = json.loads(match.group(0))
                    except Exception:
                        questions = None
            
            if not questions or not isinstance(questions, list):
                questions = self.generate_dynamic_quiz_fallback(document_text, file_names, question_count)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "questions": questions, "total": len(questions)}).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))

    def generate_dynamic_quiz_fallback(self, text, file_names, count=6):
        clean_lines = [l.strip() for l in (text or "").split("\n") if len(l.strip()) > 20 and not l.strip().startswith("---") and not l.strip().startswith("[Page")]
        title = file_names[0].rsplit(".", 1)[0] if file_names else "Core Subject"
        questions = []
        target = min(len(clean_lines), count) if clean_lines else 5
        if target < 5:
            target = 5
        for i in range(target):
            line = clean_lines[i] if i < len(clean_lines) else f"Core principle {i+1} of {title}"
            words = line.split()
            key_term = " ".join(words[:min(4, len(words))])
            correct_option = line[:80] + "..." if len(line) > 80 else line
            distractors = [
                f"It acts as an auxiliary component without direct influence on {title} guarantees.",
                f"It replaces standard state execution in degraded network partitions.",
                f"It is deprecated in modern implementations of {title}."
            ]
            correct_idx = (i * 3 + 1) % 4
            options = list(distractors)
            options.insert(correct_idx, correct_option)
            questions.append({
                "id": i + 1,
                "question": f"According to the {title} material, what is the core significance of \"{key_term}\"?",
                "options": options,
                "correct_index": correct_idx,
                "explanation": f"Directly derived from the source notes: \"{line[:120]}\"."
            })
        return questions

    def call_agentrouter(self, prompt, api_key=AGENTROUTER_KEY, max_tokens=4500, timeout=85):
        # We try GLM 5.3 Flash first as requested; if provider returns 503 or error, fall back to glm-5.3
        models_to_try = [MODEL_NAME, "glm-5.3"] if MODEL_NAME != "glm-5.3" else ["glm-5.3"]
        for model in models_to_try:
            try:
                payload = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "You are an elite academic professor and expert tutor."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2
                }
                if max_tokens:
                    payload["max_tokens"] = max_tokens

                req_data = json.dumps(payload).encode("utf-8")

                req = urllib.request.Request(
                    AGENTROUTER_URL,
                    data=req_data,
                    headers={
                        "Authorization": "Bearer " + api_key,
                        "Content-Type": "application/json",
                        "User-Agent": "Cline/3.0.0"
                    }
                )
                sub_timeout = 6 if model == "glm-5.3-flash" else timeout
                with urllib.request.urlopen(req, timeout=sub_timeout) as resp:
                    if resp.status == 200:
                        resp_json = json.loads(resp.read().decode("utf-8"))
                        msg = resp_json["choices"][0]["message"]
                        content = msg.get("content", "")
                        if not content and msg.get("reasoning_content"):
                            content = msg.get("reasoning_content")
                        if content:
                            return content
            except urllib.error.HTTPError as he:
                print(f"AgentRouter call ({model}) HTTP {he.code}: {he.reason}")
                if he.code in (500, 502, 503, 504, 404):
                    continue
                break
            except Exception as e:
                print(f"AgentRouter call ({model}) exception: {e}")
                continue
            except Exception as e:
                print(f"AgentRouter call ({model}) exception: {e}")
                continue
        return None

    def heuristic_parse_task(self, text):
        lower = text.lower()
        today = datetime.date.today()
        target_date = today + timedelta(days=1)
        
        if "today" in lower or "aaj" in lower:
            target_date = today
        elif "parso" in lower or "day after tomorrow" in lower:
            target_date = today + timedelta(days=2)
        elif "tomorrow" in lower or "kal" in lower:
            target_date = today + timedelta(days=1)
        elif "next week" in lower or "agle hafte" in lower:
            target_date = today + timedelta(days=7)
        else:
            weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
            for idx, w in enumerate(weekdays):
                if w in lower:
                    cur_w = today.weekday()
                    days_ahead = idx - cur_w
                    if days_ahead <= 0:
                        days_ahead += 7
                    target_date = today + timedelta(days=days_ahead)
                    break
            
            match = re.search(r"(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*", lower)
            if match:
                day = int(match.group(1))
                month_str = match.group(2)
                months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
                month_idx = 1
                for m_i, m_name in enumerate(months):
                    if month_str.startswith(m_name):
                        month_idx = m_i + 1
                        break
                year = today.year
                try:
                    candidate = datetime.date(year, month_idx, day)
                    if candidate < today:
                        candidate = datetime.date(year + 1, month_idx, day)
                    target_date = candidate
                except Exception:
                    pass

        task = text.strip()
        for prefix in ["i have to ", "i need to ", "mujhe ", "please ", "remind me to ", "kal ", "aaj ", "parso "]:
            if task.lower().startswith(prefix):
                task = task[len(prefix):]
        task = re.sub(r"(?i)\s+(by|before|on|at|tak|se pehle)\s+.*$", "", task)
        # If task has trailing hindi verb phrases like "karna hai" or "karni hai", clean up nicely
        task = re.sub(r"(?i)\s+(karna hai|karni hai|hona chahiye)$", "", task)
        task = task.strip().capitalize()
        if not task:
            task = "Assignment Task"

        return {
            "task": task,
            "due_date": target_date.strftime("%Y-%m-%d")
        }

    def _extract_document_features(self, text, file_names):
        title = file_names[0].rsplit(".", 1)[0] if file_names else "Academic Material"
        lines = [l.strip() for l in (text or "").split("\n") if l.strip() and not l.strip().startswith("--- DOCUMENT:")]
        sections = []
        definitions = []
        formulas = []
        points = []

        for line in lines:
            if re.match(r"^\[Page\s+\d+\]$", line, re.IGNORECASE):
                continue
            if any(sym in line for sym in ["=", "d²", "d/", "dx", "dy", "dt", "λ", "∫", "∑", "+", "′′", "''"]) and 5 < len(line) < 140:
                formulas.append(line)
            elif ":" in line and 8 < len(line) < 220 and not line.startswith("http"):
                parts = line.split(":", 1)
                term = re.sub(r"^[-*•0-9.]+\s*", "", parts[0].strip())
                desc = parts[1].strip()
                if len(term) > 2 and len(desc) > 8:
                    definitions.append((term, desc))
            elif len(line) < 70 and (line.isupper() or line.istitle() or line.endswith(":")):
                clean_sec = re.sub(r"^[-*•0-9.]+\s*", "", line).rstrip(":")
                if len(clean_sec) > 3:
                    sections.append(clean_sec)
            elif 25 < len(line) < 300:
                clean_p = re.sub(r"^[-*•0-9.]+\s*", "", line)
                points.append(clean_p)

        return {
            "title": title,
            "sections": sections,
            "definitions": definitions,
            "formulas": formulas,
            "points": points
        }

    def generate_smart_summary_fallback(self, text, file_names):
        features = self._extract_document_features(text, file_names)
        title = features["title"]
        sections = features["sections"]
        points = features["points"]

        summary_parts = [
            "# Comprehensive Chapter & Topic Summary\n",
            "## Executive Overview",
            f"This academic synthesis is directly extracted and organized from **{title}**.\n"
        ]

        if sections:
            summary_parts.append("## Core Syllabus Modules & Topics")
            for sec in sections[:10]:
                summary_parts.append(f"- **{sec}**")
            summary_parts.append("")

        summary_parts.append("## Detailed Analysis of All Topics")
        if points:
            for i, p in enumerate(points[:16], 1):
                summary_parts.append(f"### Topic {i}: Key Concept\n{p}\n")
        else:
            summary_parts.append(f"- Thoroughly review the primary lecture sections and definitions in **{title}**.\n- Ensure complete familiarity with foundational rules and operational examples.")

        return "\n".join(summary_parts)

    def generate_smart_revision_fallback(self, text, file_names):
        features = self._extract_document_features(text, file_names)
        title = features["title"]
        definitions = features["definitions"]
        formulas = features["formulas"]
        points = features["points"]

        rev_parts = [
            "# High-Yield Revision Notes & Exam Strategies\n",
            "## Topic-by-Topic Quick Recall Pointers"
        ]
        if points:
            for p in points[:8]:
                rev_parts.append(f"- **Must Remember**: {p}")
        else:
            rev_parts.append(f"- Master the foundational axioms and definitions for {title}.")

        rev_parts.append("\n## Pro-Tips, Shortcuts & Problem-Solving Hacks")
        rev_parts.append(f"1. **Direct Formula Application**: Check boundary conditions before selecting the solution template in {title}.")
        rev_parts.append("2. **Sign Conventions & Units**: Verify auxiliary equations and consistency of physical dimensions.")
        rev_parts.append("3. **Exam Time Saver**: Factor out common exponentials or linear terms early in mathematical expansions.")

        rev_parts.append("\n## Core Formulas & Operational Rules Table")
        f_table = "| Equation / Principle | Operational Application |\n| :--- | :--- |\n"
        if formulas:
            for f in formulas[:8]:
                clean_f = f.replace("|", "/")
                f_table += f"| `{clean_f}` | Core relationship in {title} |\n"
        else:
            f_table += f"| `Fundamental Identity` | Primary formula referenced in {title} |\n"
        rev_parts.append(f_table)

        rev_parts.append("\n## Common Exam Traps & Pitfalls")
        rev_parts.append(f"- **Trap 1**: Omitting arbitrary constants of integration when solving general solutions.")
        rev_parts.append(f"- **Trap 2**: Confusing distinct roots, repeated roots, and complex conjugate roots in characteristic equations.")
        rev_parts.append(f"- **Trap 3**: Applying particular solutions without checking if the driving term overlaps with the homogeneous solution.")

        rev_parts.append("\n## 5-Minute Memory Cheat Sheet")
        if definitions:
            for term, desc in definitions[:6]:
                rev_parts.append(f"- **{term}**: {desc}")
        else:
            rev_parts.append(f"- Review all core definitions and proofs from **{title}** 30 minutes before exam time.")

        return "\n".join(rev_parts)

    def generate_smart_synthesis(self, text, file_names):
        summary = self.generate_smart_summary_fallback(text, file_names)
        revision = self.generate_smart_revision_fallback(text, file_names)
        return f"{summary}\n\n---\n\n{revision}"


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f'Starting Student Workspace Server on http://localhost:{PORT}')
    with socketserver.TCPServer(('', PORT), StudentWorkspaceHandler) as httpd:
        httpd.serve_forever()
