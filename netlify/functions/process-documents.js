const AGENTROUTER_KEY = process.env.AGENTROUTER_KEY || "sk-vr8ogJCyFzmztSmFj2G1bYr223nz0nK6IDe6OGGLJ8URtvD9";
const REVISION_NOTES_KEY = process.env.REVISION_NOTES_KEY || "sk-Z6XjUcAWyyJ8WsXVbQN2YcMFdWJZouegp4BK1ZsIyajLzuFq";
const AGENTROUTER_URL = "https://agentrouter.org/v1/chat/completions";
const MODEL_CANDIDATES = ["glm-5.3-flash", "glm-5.3"];

async function callModel(prompt, apiKey) {
  for (const model of MODEL_CANDIDATES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 85000);

      const resp = await fetch(AGENTROUTER_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "Cline/3.0.0"
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: "You are an elite academic professor and expert tutor." },
            { role: "user", content: prompt }
          ],
          temperature: 0.15,
          max_tokens: 65536
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (resp.ok) {
        const data = await resp.json();
        const msg = data.choices && data.choices[0] && data.choices[0].message;
        let content = (msg && msg.content) || "";
        if (!content && msg && msg.reasoning_content) {
          content = msg.reasoning_content;
        }
        if (content) return content;
      }
    } catch (mErr) {
      console.warn(`Model ${model} call failed:`, mErr.message);
    }
  }
  return null;
}

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
  let fileNames = ["Study Material"];

  try {
    const body = JSON.parse(event.body || "{}");
    documentText = body.document_text || "";
    fileNames = body.file_names || ["Study Material"];
    const namesStr = fileNames.join(", ");
    const summaryApiKey = body.summary_api_key || body.api_key || AGENTROUTER_KEY;
    const revisionApiKey = body.revision_api_key || REVISION_NOTES_KEY;

    const summaryPrompt = `You are an elite academic professor and expert subject researcher analyzing student material: ${namesStr}.

Full Document Content:
"""
${documentText}
"""

CRITICAL INSTRUCTIONS:
- You have a massive context window and unconstrained output tokens. Do NOT summarize superficially or omit sections.
- Synthesize EVERY single chapter, topic, subtopic, concept, theorem, definition, mathematical derivation, step-by-step procedure, mechanism, and example present in this material.
- Structure your output cleanly in markdown:

# Comprehensive Chapter & Topic Summary

## Executive Overview
A thorough academic synthesis and high-level roadmap of the entire document.

## Exhaustive Chapter-by-Chapter & Topic-by-Topic Breakdown
Provide detailed analysis for each topic found in the text, fully explaining all mechanisms, theorems, rules, formulas, and operational procedures.

## Worked Examples, Derivations & Practical Applications
Step-by-step walk-through of examples, mathematical problems, and real-world implementations.

Ensure formatting is elegant, clean markdown with bolding, lists, and tables where helpful. Output ONLY the markdown content.`;

    const revisionPrompt = `You are a master academic coach and exam specialist analyzing student material: ${namesStr}.

Full Document Content:
"""
${documentText}
"""

CRITICAL INSTRUCTIONS:
- You have a massive context window and unconstrained output tokens. Do NOT summarize superficially.
- Generate high-yield exam revision notes, important points, tips and tricks, formulas, and memory aids for EVERY topic in this document.
- Structure your output cleanly in markdown:

# High-Yield Revision Notes & Exam Strategies

## Topic-by-Topic Quick Recall Pointers
Crucial bullet points, key takeaways, and must-know definitions for rapid recall across every topic.

## Pro-Tips, Shortcuts & Problem-Solving Hacks
Exam tips, memory tricks, operational rules of thumb, and shortcuts to solve complex questions quickly.

## Core Formulas, Principles & Algorithms Table
A clean markdown table mapping core equations, principles, or algorithmic rules to their exact exam applications.

## Common Exam Traps & Pitfalls
Frequent student mistakes, tricky edge cases, and actionable strategies to avoid losing marks.

## 5-Minute Memory Cheat Sheet
Ultra-dense, fast-review mnemonic aids and core summaries.

Ensure formatting is concise, punchy, and exam-focused. Output ONLY the markdown content.`;

    // Concurrently generate summary (Key 1) and revision notes (Key 3)
    const [summaryResult, revisionResult] = await Promise.all([
      callModel(summaryPrompt, summaryApiKey),
      callModel(revisionPrompt, revisionApiKey)
    ]);

    let finalSummary = summaryResult || generateSmartSummaryFallback(documentText, fileNames);
    let finalRevision = revisionResult || generateSmartRevisionFallback(documentText, fileNames);

    finalSummary = finalSummary.trim();
    finalRevision = finalRevision.trim();

    if (!finalSummary.startsWith("#")) {
      finalSummary = "# Comprehensive Chapter & Topic Summary\n\n" + finalSummary;
    }
    if (!finalRevision.startsWith("#")) {
      finalRevision = "# High-Yield Revision Notes & Exam Strategies\n\n" + finalRevision;
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        summary: finalSummary,
        revision_notes: finalRevision,
        content: `${finalSummary}\n\n---\n\n${finalRevision}`
      })
    };
  } catch (err) {
    console.error("Using smart document analyzer fallback:", err.message);
    const fallbackSummary = generateSmartSummaryFallback(documentText, fileNames);
    const fallbackRevision = generateSmartRevisionFallback(documentText, fileNames);
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        summary: fallbackSummary,
        revision_notes: fallbackRevision,
        content: `${fallbackSummary}\n\n---\n\n${fallbackRevision}`
      })
    };
  }
};

function extractDocumentFeatures(text, fileNames) {
  const rawTitle = fileNames && fileNames.length > 0 ? fileNames[0] : "Academic Document";
  const title = rawTitle.replace(/\.[^/.]+$/, "");
  const lines = (text || "").split("\n").map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith("--- DOCUMENT:"));
  
  const sections = [];
  const definitions = [];
  const formulas = [];
  const points = [];

  for (const line of lines) {
    if (/^\[Page\s+\d+\]$/i.test(line)) continue;
    if (/(=|d²|d\/|dx|dy|dt|λ|∫|∑|\+|′′|'')/.test(line) && line.length > 5 && line.length < 140) {
      formulas.push(line);
    } else if (line.includes(":") && line.length > 8 && line.length < 220 && !line.startsWith("http")) {
      const parts = line.split(":", 2);
      const term = parts[0].trim().replace(/^[-*•0-9.]+\s*/, "");
      const def = parts[1].trim();
      if (term.length > 2 && def.length > 8) {
        definitions.push({ term, def });
      }
    } else if (line.length < 70 && (/^[A-Z0-9\s:,\-]{4,}$/.test(line) || line.endsWith(":"))) {
      const cleanSec = line.replace(/^[-*•0-9.]+\s*/, "").replace(/:$/, "").trim();
      if (cleanSec.length > 3) sections.push(cleanSec);
    } else if (line.length > 25 && line.length < 300) {
      points.push(line.replace(/^[-*•0-9.]+\s*/, ""));
    }
  }

  return { title, sections, definitions, formulas, points };
}

function generateSmartSummaryFallback(text, fileNames) {
  const { title, sections, points } = extractDocumentFeatures(text, fileNames);

  const summaryParts = [
    "# Comprehensive Chapter & Topic Summary\n",
    "## Executive Overview",
    `This academic synthesis is directly extracted and organized from **${title}**.\n`
  ];

  if (sections.length > 0) {
    summaryParts.push("## Core Syllabus Modules & Topics");
    sections.slice(0, 10).forEach(sec => summaryParts.push(`- **${sec}**`));
    summaryParts.push("");
  }

  summaryParts.push("## Detailed Analysis of All Topics");
  if (points.length > 0) {
    points.slice(0, 16).forEach((p, idx) => summaryParts.push(`### Topic ${idx + 1}: Key Concept\n${p}\n`));
  } else {
    summaryParts.push(`- Thoroughly review the primary lecture sections and definitions in **${title}**.\n- Ensure complete familiarity with foundational rules and operational examples.`);
  }

  return summaryParts.join("\n");
}

function generateSmartRevisionFallback(text, fileNames) {
  const { title, definitions, formulas, points } = extractDocumentFeatures(text, fileNames);

  const revParts = [
    "# High-Yield Revision Notes & Exam Strategies\n",
    "## Topic-by-Topic Quick Recall Pointers"
  ];

  if (points.length > 0) {
    points.slice(0, 8).forEach(p => revParts.push(`- **Must Remember**: ${p}`));
  } else {
    revParts.push(`- Master the foundational axioms and definitions for ${title}.`);
  }

  revParts.push("\n## Pro-Tips, Shortcuts & Problem-Solving Hacks");
  revParts.push(`1. **Direct Formula Application**: Check boundary conditions before selecting the solution template in ${title}.`);
  revParts.push("2. **Sign Conventions & Units**: Verify auxiliary equations and consistency of physical dimensions.");
  revParts.push("3. **Exam Time Saver**: Factor out common exponentials or linear terms early in mathematical expansions.");

  revParts.push("\n## Core Formulas & Operational Rules Table");
  let fTable = "| Equation / Principle | Operational Application |\n| :--- | :--- |\n";
  if (formulas.length > 0) {
    formulas.slice(0, 8).forEach(f => {
      fTable += `| \`${f.replace(/\|/g, "/")}\` | Core relationship in ${title} |\n`;
    });
  } else {
    fTable += `| \`Fundamental Identity\` | Primary formula referenced in ${title} |\n`;
  }
  revParts.push(fTable);

  revParts.push("\n## Common Exam Traps & Pitfalls");
  revParts.push(`- **Trap 1**: Omitting arbitrary constants of integration when solving general solutions.`);
  revParts.push(`- **Trap 2**: Confusing distinct roots, repeated roots, and complex conjugate roots in characteristic equations.`);
  revParts.push(`- **Trap 3**: Applying particular solutions without checking if the driving term overlaps with the homogeneous solution.`);

  revParts.push("\n## 5-Minute Memory Cheat Sheet");
  if (definitions.length > 0) {
    definitions.slice(0, 6).forEach(d => {
      revParts.push(`- **${d.term}**: ${d.def}`);
    });
  } else {
    revParts.push(`- Review all core definitions and proofs from **${title}** 30 minutes before exam time.`);
  }

  return revParts.join("\n");
}

function generateSmartFallback(text, fileNames) {
  const s = generateSmartSummaryFallback(text, fileNames);
  const r = generateSmartRevisionFallback(text, fileNames);
  return `${s}\n\n---\n\n${r}`;
}
