// Dedicated API key for deadline & task parsing (isolated from document summarization)
const DEADLINE_TASK_KEY = process.env.DEADLINE_TASK_KEY || "sk-6KVG8miVAHFWexETDhnvAr4mWxZiuCS8atbCqagRTIfdFZBc";
const AGENTROUTER_URL = "https://agentrouter.org/v1/chat/completions";
const MODEL_CANDIDATES = ["glm-5.3-flash", "glm-5.3", "deepseek-v4-flash"];

exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const rawInput = body.input || "";
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const weekdayStr = today.toLocaleDateString("en-US", { weekday: "long" });

    const prompt = `You are a precise deadline parsing engine.
Today is ${weekdayStr}, ${todayStr}.

Extract the assignment task name and target due date from this user prompt (which may be in English or Hinglish/Hindi):
"${rawInput}"

Examples:
- "I have to complete my maths assignment by tomorrow" -> Task: "Complete Maths Assignment", Date: tomorrow
- "I have to submit my assignment on tuesday" -> Task: "Submit Assignment", Date: coming Tuesday
- "mujhe kal apna assignment submit karna hai" -> Task: "Submit Assignment", Date: tomorrow
- "complete chemistry lab report before 15th Sept" -> Task: "Complete Chemistry Lab Report", Date: Sep 15th

Respond ONLY with valid JSON in this exact structure:
{
  "task": "Clean Task Title",
  "due_date": "YYYY-MM-DD"
}`;

    let parsed = null;
    for (const model of MODEL_CANDIDATES) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const resp = await fetch(AGENTROUTER_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${DEADLINE_TASK_KEY}`,
            "Content-Type": "application/json",
            "User-Agent": "Cline/3.0.0"
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: "You are a precise task and deadline parsing assistant." },
              { role: "user", content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 600
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json();
          const msg = data.choices && data.choices[0] && data.choices[0].message;
          const text = (msg && (msg.content || msg.reasoning_content)) || "";
          const jsonMatch = text.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
            break;
          }
        }
      } catch (e) {
        // try next model candidate
      }
    }

    if (!parsed || !parsed.due_date || isNaN(new Date(parsed.due_date + "T00:00:00").getTime())) {
      parsed = heuristicParseTask(rawInput);
    }

    const dueDt = new Date(parsed.due_date + "T00:00:00");
    const todayMidnight = new Date();
    todayMidnight.setHours(0,0,0,0);
    const diffMs = dueDt - todayMidnight;
    const deltaDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    let rel = "";
    if (deltaDays === 0) rel = "Due today";
    else if (deltaDays === 1) rel = "Due in 1 days";
    else if (deltaDays > 1) rel = `Due in ${deltaDays} days`;
    else if (deltaDays === -1) rel = "Overdue by 1 day";
    else rel = `Overdue by ${Math.abs(deltaDays)} days`;

    const formattedDate = dueDt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        task: parsed.task || "New Assignment",
        due_date: parsed.due_date || todayStr,
        due_date_formatted: formattedDate,
        relative_display: rel,
        is_overdue: deltaDays < 0
      })
    };
  } catch (err) {
    console.error("Error in parse-task function:", err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

function heuristicParseTask(text) {
  const lower = text.toLowerCase();
  const today = new Date();
  let target = new Date();
  target.setDate(today.getDate() + 1); // default tomorrow

  if (lower.includes("today") || lower.includes("aaj")) {
    target = new Date();
  } else if (lower.includes("parso") || lower.includes("day after tomorrow")) {
    target.setDate(today.getDate() + 2);
  } else if (lower.includes("tomorrow") || lower.includes("kal")) {
    target.setDate(today.getDate() + 1);
  } else if (lower.includes("next week") || lower.includes("agle hafte")) {
    target.setDate(today.getDate() + 7);
  } else {
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    for (let idx = 0; idx < weekdays.length; idx++) {
      if (lower.includes(weekdays[idx])) {
        const curDay = today.getDay();
        let daysAhead = idx - curDay;
        if (daysAhead <= 0) daysAhead += 7;
        target.setDate(today.getDate() + daysAhead);
        break;
      }
    }
  }

  let task = text.trim();
  const prefixes = ["i have to ", "i need to ", "mujhe ", "please ", "remind me to ", "kal ", "aaj ", "parso "];
  for (const p of prefixes) {
    if (task.toLowerCase().startsWith(p)) {
      task = task.substring(p.length);
    }
  }
  task = task.replace(/\s+(by|before|on|at|tak|se pehle)\s+.*$/i, "");
  task = task.replace(/\s+(karna hai|karni hai|hona chahiye)$/i, "").trim();
  if (task.length > 0) {
    task = task.charAt(0).toUpperCase() + task.slice(1);
  } else {
    task = "Assignment Task";
  }

  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const d = String(target.getDate()).padStart(2, "0");

  return { task, due_date: `${y}-${m}-${d}` };
}
