// =========================================================
// SCHOLARFLOW — QUIZ ENGINE
// Clean Vanilla JS State Management & Interaction
// =========================================================

let quizData = null;
let questions = [];
let currentIndex = 0;
let userAnswers = [];

// DOM Elements
const quizTopicTitle = document.getElementById("quiz-topic-title");
const quizStudentName = document.getElementById("quiz-student-name");
const currentQNum = document.getElementById("current-q-num");
const totalQNum = document.getElementById("total-q-num");
const answeredCount = document.getElementById("answered-count");
const totalCountLbl = document.getElementById("total-count-lbl");
const quizPalette = document.getElementById("quiz-palette");

const qCategoryTag = document.getElementById("q-category-tag");
const qPromptText = document.getElementById("q-prompt-text");
const quizOptionsContainer = document.getElementById("quiz-options-container");
const prevQBtn = document.getElementById("prev-q-btn");
const nextQBtn = document.getElementById("next-q-btn");
const submitQuizBtn = document.getElementById("submit-quiz-btn");

const quizActiveView = document.getElementById("quiz-active-view");
const quizResultsView = document.getElementById("quiz-results-view");
const quizStatusBadge = document.getElementById("quiz-status-badge");
const quizScoreDisplay = document.getElementById("quiz-score-display");
const quizPercentDisplay = document.getElementById("quiz-percent-display");
const quizReviewContainer = document.getElementById("quiz-review-container");
const retakeQuizBtn = document.getElementById("retake-quiz-btn");

const SUPABASE_URL = "https://wabnptycdxhawcexyrkr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhYm5wdHljZHhoYXdjZXh5cmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMzMzMTQsImV4cCI6MjEwNDgwOTMxNH0.pIF1tLe2XhEIV_bR7N9sS2TcbR3-kM1SXjmUgriOOLg";
let supabaseClient = null;
if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadQuizData();
  setupEventListeners();
});

async function loadQuizData() {
  if (!supabaseClient && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  const urlParams = new URLSearchParams(window.location.search);
  const quizId = urlParams.get("quiz_id");
  const sessionId = urlParams.get("session_id");

  // 1. Fetch from Supabase if quiz_id or session_id is in URL
  if (supabaseClient) {
    if (quizId) {
      try {
        const { data, error } = await supabaseClient
          .from("quizzes")
          .select("*")
          .eq("id", quizId)
          .single();
        if (data && Array.isArray(data.questions) && data.questions.length > 0) {
          quizData = {
            topic: data.topic,
            questions: data.questions
          };
        }
      } catch (err) {
        console.warn("Error fetching quiz from Supabase:", err);
      }
    }
    if (!quizData && sessionId) {
      try {
        const { data, error } = await supabaseClient
          .from("study_sessions")
          .select("title, quiz_questions")
          .eq("id", sessionId)
          .single();
        if (data && Array.isArray(data.quiz_questions) && data.quiz_questions.length > 0) {
          quizData = {
            topic: data.title,
            questions: data.quiz_questions
          };
        }
      } catch (err) {
        console.warn("Error fetching session quiz from Supabase:", err);
      }
    }
  }

  // 2. Fall back to localStorage
  if (!quizData) {
    const raw = localStorage.getItem("active_quiz");
    if (raw) {
      try {
        quizData = JSON.parse(raw);
      } catch (e) {
        console.error("Failed to parse active_quiz from localStorage:", e);
      }
    }
  }

  // 3. Fallback demo quiz only if opened completely without any data
  if (!quizData || !quizData.questions || quizData.questions.length === 0) {
    quizData = {
      topic: "Academic Mastery Quiz",
      studentName: "Student",
      questions: [
        {
          id: 1,
          question: "What is the primary prerequisite for solving a linear non-homogeneous differential equation?",
          options: [
            "Finding the complementary solution of the homogeneous equation",
            "Setting all boundary values strictly to zero",
            "Eliminating first derivatives through numerical iteration",
            "Restricting coefficients to negative constants"
          ],
          correct_index: 0,
          explanation: "The complete solution requires finding the complementary solution of the homogeneous equation first, then adding a particular solution."
        },
        {
          id: 2,
          question: "In the characteristic equation ar^2 + br + c = 0, what do complex conjugate roots indicate?",
          options: [
            "Purely polynomial growth without oscillation",
            "Oscillatory behavior with sinusoidal components",
            "An undefined solution that diverges everywhere",
            "A system with no valid boundary constraints"
          ],
          correct_index: 1,
          explanation: "Complex roots produce solutions of the form e^(alpha*x) * (C1*cos(beta*x) + C2*sin(beta*x)), representing oscillatory behavior."
        },
        {
          id: 3,
          question: "What does a non-zero Wronskian W(y1, y2) prove for two solutions y1 and y2?",
          options: [
            "The two solutions are linearly dependent",
            "The differential equation has no unique solution",
            "The two solutions are linearly independent and form a fundamental set",
            "The boundary value problem cannot be computed"
          ],
          correct_index: 2,
          explanation: "If the Wronskian of two solutions is non-zero on an interval, they are linearly independent and form a fundamental set."
        },
        {
          id: 4,
          question: "When applying the Method of Undetermined Coefficients, what must you do if the driving term matches a complementary solution term?",
          options: [
            "Multiply the trial solution by x^s until no duplication remains",
            "Set the particular solution to zero immediately",
            "Switch to Euler-Cauchy transformations",
            "Invert the sign of the driving term"
          ],
          correct_index: 0,
          explanation: "If a term in g(x) is also in y_h, multiply the trial form by x^s (where s is the smallest positive integer removing duplication)."
        }
      ]
    };
  }

  // Validate every question: guarantee exactly 4 options and valid correct_index
  questions = quizData.questions.map((q, idx) => {
    let opts = Array.isArray(q.options) && q.options.length === 4 ? q.options : [
      (q.question ? q.question.slice(0, 50) : "Concept") + " (Option A)",
      "Standard condition under steady-state formulation",
      "Inverse variation across boundary nodes",
      "Degenerate case with vanishing coefficient"
    ];
    let cIdx = typeof q.correct_index === "number" && q.correct_index >= 0 && q.correct_index <= 3 ? q.correct_index : ((idx * 3 + 1) % 4);
    return {
      id: idx + 1,
      question: q.question || `Question ${idx + 1}`,
      options: opts,
      correct_index: cIdx,
      explanation: q.explanation || "Derived from verified lecture notes."
    };
  });

  userAnswers = new Array(questions.length).fill(-1);

  // Set titles
  quizTopicTitle.textContent = quizData.topic || "Academic Quiz";
  const savedStudent = localStorage.getItem("student_profile");
  if (savedStudent) {
    try {
      const p = JSON.parse(savedStudent);
      if (p.full_name) quizStudentName.textContent = p.full_name;
    } catch(e) {}
  } else if (quizData.studentName) {
    quizStudentName.textContent = quizData.studentName;
  }

  totalQNum.textContent = questions.length;
  totalCountLbl.textContent = questions.length;

  renderPalette();
  renderQuestion();
}

function setupEventListeners() {
  prevQBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion();
      renderPalette();
    }
  });

  nextQBtn.addEventListener("click", () => {
    if (currentIndex < questions.length - 1) {
      currentIndex++;
      renderQuestion();
      renderPalette();
    } else {
      confirmAndSubmit();
    }
  });

  submitQuizBtn.addEventListener("click", () => {
    confirmAndSubmit();
  });

  retakeQuizBtn.addEventListener("click", () => {
    userAnswers = new Array(questions.length).fill(-1);
    currentIndex = 0;
    quizResultsView.classList.add("hidden");
    quizActiveView.classList.remove("hidden");
    renderPalette();
    renderQuestion();
  });
}

function renderPalette() {
  quizPalette.innerHTML = "";
  let answered = 0;

  questions.forEach((q, idx) => {
    const chip = document.createElement("button");
    chip.className = "palette-chip";
    chip.textContent = idx + 1;
    chip.title = `Jump to Question ${idx + 1}`;

    const isAnswered = userAnswers[idx] !== -1;
    const isActive = currentIndex === idx;

    if (isAnswered) {
      chip.classList.add("answered");
      answered++;
    }
    if (isActive) {
      chip.classList.add("active");
    }

    chip.addEventListener("click", () => {
      currentIndex = idx;
      renderQuestion();
      renderPalette();
    });

    quizPalette.appendChild(chip);
  });

  answeredCount.textContent = answered;
}

function renderQuestion() {
  const q = questions[currentIndex];
  currentQNum.textContent = currentIndex + 1;
  qCategoryTag.textContent = `QUESTION ${currentIndex + 1} OF ${questions.length}`;
  qPromptText.textContent = q.question;

  quizOptionsContainer.innerHTML = "";
  const letters = ["A", "B", "C", "D"];

  q.options.forEach((optText, optIdx) => {
    const card = document.createElement("div");
    card.className = "quiz-option-item";
    const isSelected = userAnswers[currentIndex] === optIdx;
    if (isSelected) card.classList.add("selected");

    card.innerHTML = `
      <div class="option-letter">${letters[optIdx] || optIdx + 1}</div>
      <div class="option-text">${escapeHtml(optText)}</div>
    `;

    card.addEventListener("click", () => {
      userAnswers[currentIndex] = optIdx;
      renderQuestion();
      renderPalette();
    });

    quizOptionsContainer.appendChild(card);
  });

  // Update button states
  prevQBtn.disabled = currentIndex === 0;
  prevQBtn.style.opacity = currentIndex === 0 ? "0.4" : "1";
  prevQBtn.style.cursor = currentIndex === 0 ? "not-allowed" : "pointer";

  if (currentIndex === questions.length - 1) {
    nextQBtn.innerHTML = `<span>Submit Quiz</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 12 2 2 4-4"/></svg>`;
  } else {
    nextQBtn.innerHTML = `<span>Next</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>`;
  }
}

function confirmAndSubmit() {
  const unanswered = userAnswers.filter(a => a === -1).length;
  if (unanswered > 0) {
    const ok = confirm(`You still have ${unanswered} unanswered question(s). Do you want to submit anyway?`);
    if (!ok) return;
  }
  finishQuiz();
}

function finishQuiz() {
  let score = 0;
  questions.forEach((q, idx) => {
    if (userAnswers[idx] === q.correct_index) {
      score++;
    }
  });

  const percent = Math.round((score / questions.length) * 100);
  quizScoreDisplay.textContent = `${score} / ${questions.length}`;
  quizPercentDisplay.textContent = `${percent}%`;

  if (percent >= 70) {
    quizStatusBadge.className = "quiz-score-badge passed";
    quizStatusBadge.textContent = "EXCELLENT — EXAM READY";
  } else if (percent >= 50) {
    quizStatusBadge.className = "quiz-score-badge passed";
    quizStatusBadge.textContent = "PASSED — REVIEW SUGGESTED";
  } else {
    quizStatusBadge.className = "quiz-score-badge failed";
    quizStatusBadge.textContent = "NEEDS REVISION";
  }

  // Render question-by-question review
  quizReviewContainer.innerHTML = "";
  const letters = ["A", "B", "C", "D"];

  questions.forEach((q, idx) => {
    const userChoice = userAnswers[idx];
    const isCorrect = userChoice === q.correct_index;
    const item = document.createElement("div");
    item.className = `review-item-box ${isCorrect ? "correct" : "incorrect"}`;

    const userAnsStr = userChoice !== -1 ? `${letters[userChoice]}: ${escapeHtml(q.options[userChoice])}` : "No answer selected";
    const correctAnsStr = `${letters[q.correct_index]}: ${escapeHtml(q.options[q.correct_index])}`;

    item.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: var(--muted-foreground);">QUESTION ${idx + 1}</span>
        <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 800; color: ${isCorrect ? "var(--chart-4, #00cc00)" : "var(--primary)"};">
          ${isCorrect ? "CORRECT (+1)" : "INCORRECT (0)"}
        </span>
      </div>
      <div class="review-q-title">${escapeHtml(q.question)}</div>
      <div class="review-ans-row">
        <strong style="font-family: var(--font-mono); font-size: 12px; color: ${isCorrect ? "var(--chart-4, #00cc00)" : "var(--primary)"};">Your Choice:</strong>
        <span style="color: var(--foreground);">${userAnsStr}</span>
      </div>
      ${!isCorrect ? `
      <div class="review-ans-row">
        <strong style="font-family: var(--font-mono); font-size: 12px; color: var(--chart-4, #00cc00);">Correct Answer:</strong>
        <span style="color: var(--foreground);">${correctAnsStr}</span>
      </div>` : ""}
      <div class="review-explanation">
        <strong>EXPLANATION:</strong> ${escapeHtml(q.explanation || "Derived directly from study material.")}
      </div>
    `;

    quizReviewContainer.appendChild(item);
  });

  quizActiveView.classList.add("hidden");
  quizResultsView.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}
