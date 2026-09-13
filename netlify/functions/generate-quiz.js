const AGENTROUTER_KEY = process.env.AGENTROUTER_KEY || "sk-vr8ogJCyFzmztSmFj2G1bYr223nz0nK6IDe6OGGLJ8URtvD9";
const AGENTROUTER_URL = "https://agentrouter.org/v1/chat/completions";
const MODEL_CANDIDATES = ["glm-5.3-flash", "glm-5.3"];

exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  let documentText = "";
  let fileNames = ["Study Notes"];

  try {
    const body = JSON.parse(event.body || "{}");
    documentText = body.document_text || "";
    fileNames = body.file_names || ["Study Notes"];
    const namesStr = fileNames.join(", ");
    // Compute dynamic question count based on full document size
    const textLen = (documentText || "").length;
    let questionCount = 6;
    if (textLen < 3000) {
      questionCount = 6;
    } else if (textLen <= 15000) {
      questionCount = 12;
    } else {
      questionCount = 20;
    }

    const prompt = `You are an expert university examiner. Analyze this complete academic material (${namesStr}) and generate exactly ${questionCount} multiple-choice exam questions covering all topics.

Document:
"""
${documentText}
"""

RULES:
1. Every question must test real concepts, mechanisms, principles, or formulas directly from the document.
2. Provide exactly 4 options per question.
3. Specify the correct option with correct_index (0, 1, 2, or 3).
4. Provide a 1-2 sentence academic explanation.
5. Output ONLY valid raw JSON array of objects without markdown formatting or code blocks.

Schema:
[
  {
    "id": 1,
    "question": "Clear question text?",
    "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
    "correct_index": 0,
    "explanation": "Why Choice A is correct based on the text."
  }
]`;

    let questions = null;
    for (const model of MODEL_CANDIDATES) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        const resp = await fetch(AGENTROUTER_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${AGENTROUTER_KEY}`,
            "Content-Type": "application/json",
            "User-Agent": "Cline/3.0.0"
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: "You are an expert academic examiner." },
              { role: "user", content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 3000
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json();
          const msg = data.choices && data.choices[0] && data.choices[0].message;
          let rawText = (msg && (msg.content || msg.reasoning_content)) || "";
          rawText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
          const firstBracket = rawText.indexOf("[");
          const lastBracket = rawText.lastIndexOf("]");
          if (firstBracket !== -1 && lastBracket !== -1) {
            const jsonStr = rawText.substring(firstBracket, lastBracket + 1);
            const parsedQuestions = JSON.parse(jsonStr);
            if (Array.isArray(parsedQuestions) && parsedQuestions.length > 0) {
              questions = parsedQuestions;
              break;
            }
          }
        }
      } catch (mErr) {
        console.warn(`Quiz model ${model} failed, trying next:`, mErr.message);
      }
    }

    if (questions && questions.length > 0) {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, questions: questions, total: questions.length })
      };
    }
  } catch (err) {
    console.warn("Upstream quiz generation failed, using dynamic text extractor:", err.message);
  }

  // Dynamic fallback generator: parses real lines from documentText
  const fallbackQuestions = generateDynamicQuizFallback(documentText, fileNames);
  return {
    statusCode: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, questions: fallbackQuestions, total: fallbackQuestions.length })
  };
};

function generateDynamicQuizFallback(text, fileNames) {
  const cleanLines = (text || "")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 20 && !l.startsWith("---") && !l.startsWith("[Page"));

  const title = fileNames && fileNames[0] ? fileNames[0].replace(/\.[^/.]+$/, "") : "Core Subject";
  const questions = [];

  const candidateSentences = cleanLines.slice(0, 15);
  const targetCount = Math.max(5, Math.min(candidateSentences.length, 10));

  for (let i = 0; i < targetCount; i++) {
    const line = candidateSentences[i] || `Concept ${i + 1} from ${title}`;
    const words = line.split(" ");
    const keyTerm = words.slice(0, Math.min(4, words.length)).join(" ");
    const correctOption = line.length > 80 ? line.slice(0, 80) + "..." : line;
    const distractors = [
      `It acts as an auxiliary component without direct influence on ${title} guarantees.`,
      `It replaces standard state execution in degraded network partitions.`,
      `It is deprecated in modern implementations of ${title}.`
    ];
    const correctIdx = (i * 3 + 1) % 4;
    const options = [...distractors];
    options.splice(correctIdx, 0, correctOption);

    questions.push({
      id: i + 1,
      question: `According to the ${title} material, what is the core significance of "${keyTerm}"?`,
      options: options,
      correct_index: correctIdx,
      explanation: `Directly derived from the source notes: "${line.slice(0, 120)}".`
    });
  }

  return questions;
}

exports.generateDynamicQuizFallback = generateDynamicQuizFallback;
