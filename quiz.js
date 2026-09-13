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

document.addEventListener("DOMContentLoaded", () => {
  loadQuizData();
  setupEventListeners();
});

function loadQuizData() {
  const raw = localStorage.getItem("active_quiz");
  if (raw) {
    try {
      quizData = JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse active_quiz from localStorage:", e);
    }
  }

  // Fallback demo quiz if opened directly without session
  if (!quizData || !quizData.questions || quizData.questions.length === 0) {
    quizData = {
      topic: "Distributed Consensus & Raft",
      studentName: "Student",
      questions: [
        {
          id: 1,
          question: "In the Raft consensus algorithm, what primary mechanism ensures Leader Safety?",
          options: [
            "At most one leader can be elected in a given term",
            "Followers can process and commit client requests independently",
            "Logs are replicated backwards from followers to the leader",
            "Candidates must obtain a unanimous 100% vote from all nodes"
          ],
          correct_index: 0,
          explanation: "Election Safety invariant dictates that at most one leader can be elected in a given term through majority quorum."
        },
        {
          id: 2,
          question: "What triggers a Follower node to transition into the Candidate state in Raft?",
          options: [
            "Receiving an AppendEntries RPC from the current leader",
            "An election timeout expiring without receiving a heartbeat",
            "A client directly submitting a transaction to the follower",
            "The node crashing and rebooting into read-only mode"
          ],
          correct_index: 1,
          explanation: "If a follower receives no communication over an election timeout, it assumes the leader is down and starts an election."
        },
        {
          id: 3,
          question: "What is the minimum quorum requirement for committing a log entry in an N-node Raft cluster?",
          options: [
            "N / 4 + 1 nodes",
            "Strictly 100% of all nodes",
            "Majority quorum: (N / 2) + 1 nodes",
            "Any two adjacent nodes"
          ],
          correct_index: 2,
          explanation: "A majority of nodes ((N/2) + 1) must acknowledge receipt of a log entry before it can be safely committed."
        },
        {
          id: 4,
          question: "Which of the following statements about Raft log entries is TRUE?",
          options: [
            "A leader can overwrite its own committed entries",
            "A leader never overwrites or truncates its own log; it only appends new entries",
            "Followers can freely commit entries before the leader does",
            "Uncommitted entries are permanently immutable"
          ],
          correct_index: 1,
          explanation: "The Leader Append-Only property guarantees that a leader never truncates or overwrites its own log entries."
        },
        {
          id: 5,
          question: "How does Raft solve split-vote situations where multiple candidates run concurrently?",
          options: [
            "By choosing the candidate with the lowest IP address",
            "Using randomized election timeouts (e.g., 150ms-300ms)",
            "By consulting an external centralized coordinator",
            "By restarting the entire cluster from scratch"
          ],
          correct_index: 1,
          explanation: "Randomized election timeouts ensure split votes are rare and resolved quickly on subsequent election terms."
        }
      ]
    };
  }

  questions = quizData.questions;
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
