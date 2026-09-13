// Supabase Configuration
const SUPABASE_URL = "https://wabnptycdxhawcexyrkr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhYm5wdHljZHhoYXdjZXh5cmtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMzMzMTQsImV4cCI6MjEwNDgwOTMxNH0.pIF1tLe2XhEIV_bR7N9sS2TcbR3-kM1SXjmUgriOOLg";

let supabaseClient = null;
if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Application State
let currentStudent = null;
let selectedFiles = [];
let pendingParsedTask = null;
let activeSessionId = null;
let currentDocumentText = "";
let currentFileNames = [];
let currentQuizQuestions = null;

// DOM Elements
const onboardingModal = document.getElementById("onboarding-modal");
const onboardingForm = document.getElementById("onboarding-form");
const studentNameInput = document.getElementById("student-name-input");
const headerUserName = document.getElementById("header-user-name");
const profileName = document.getElementById("profile-name");
const profileAvatar = document.getElementById("profile-avatar");

const leftSidebar = document.getElementById("left-sidebar");
const rightSidebar = document.getElementById("right-sidebar");
const toggleLeftBtn = document.getElementById("toggle-left-sidebar-btn");
const toggleRightBtn = document.getElementById("toggle-right-sidebar-btn");
const startQuizBtn = document.getElementById("start-quiz-btn");

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const fileQueueContainer = document.getElementById("file-queue-container");
const fileQueue = document.getElementById("file-queue");
const fileCount = document.getElementById("file-count");
const clearFilesBtn = document.getElementById("clear-files-btn");
const processFilesBtn = document.getElementById("process-files-btn");
const processingIndicator = document.getElementById("processing-indicator");

const uploadStage = document.getElementById("upload-stage");
const resultsStage = document.getElementById("results-stage");
const sessionDisplayTitle = document.getElementById("session-display-title");
const sessionFileBadges = document.getElementById("session-file-badges");
const summaryContent = document.getElementById("summary-content");
const revisionContent = document.getElementById("revision-content");
const newSessionBtn = document.getElementById("new-session-btn");
const newDocBtn = document.getElementById("new-doc-btn");

const taskNlInput = document.getElementById("task-nl-input");
const addTaskBtn = document.getElementById("add-task-btn");
const parsedTaskCard = document.getElementById("parsed-task-card");
const parsedTaskTitle = document.getElementById("parsed-task-title");
const parsedTaskDue = document.getElementById("parsed-task-due");
const confirmTaskBtn = document.getElementById("confirm-task-btn");
const cancelTaskBtn = document.getElementById("cancel-task-btn");
const pendingTasksList = document.getElementById("pending-tasks-list");
const overdueCount = document.getElementById("overdue-count");
const completedCount = document.getElementById("completed-count");
const sessionsList = document.getElementById("sessions-list");

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  await initStudentProfile();
});

// Sidebar Collapsing
toggleLeftBtn.addEventListener("click", () => {
  leftSidebar.classList.toggle("collapsed");
});

toggleRightBtn.addEventListener("click", () => {
  rightSidebar.classList.toggle("collapsed");
});

async function initStudentProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const demoMode = urlParams.get("demo");
  if (demoMode) {
    currentStudent = { id: "demo-student-1", full_name: "Ramesh" };
    updateUserUI("Ramesh");
    onboardingModal.classList.add("hidden");

    // Clean light theme enforcement
    document.documentElement.classList.remove("dark");

    renderActionItems([
      { id: "1", task: "Submit Operating Systems Lab 4", due_date: "2026-09-15", is_completed: false },
      { id: "2", task: "Revise Distributed Systems Chapter 3", due_date: "2026-09-18", is_completed: false },
      { id: "3", task: "Computer Networks Assignment 2", due_date: "2026-09-10", is_completed: false },
      { id: "4", task: "Algorithms Problem Set 1", due_date: "2026-09-08", is_completed: true }
    ]);

    renderSessionsList([
      { id: "s1", title: "Distributed Consensus & Raft", source_files: ["raft_paper.pdf"] },
      { id: "s2", title: "OS Memory Virtualization", source_files: ["ch13_memory.pdf", "ch14_paging.pdf"] }
    ]);

    if (demoMode === "results" || demoMode === "dark") {
      displayResults(
        "Distributed Consensus & Raft",
        ["raft_paper.pdf", "consensus_notes.docx"],
        `# Distributed Consensus & Raft

## 1. Core Mechanics & State Machine Replication
Distributed consensus ensures multiple independent machines reach agreement on shared state even when individual nodes crash or drop messages.

- **Leader Election**: Heartbeat timeouts trigger randomized timer elections.
- **Log Matching Property**: If two logs contain an entry with the same index and term, they are identical up to that index.

| Role | Responsibilities | Failure Recovery |
| :--- | :--- | :--- |
| **Leader** | Ingests client writes, appends to log, broadcasts AppendEntries | Re-elected upon heartbeat timeout |
| **Follower** | Replicates leader log entries, responds to RPCs | Drops to Candidate state if heartbeat ceases |
| **Candidate** | Solicits votes across quorum | Steps down if higher term detected |`,
        `# High-Yield Revision Notes

### Key Invariants to Memorize for Exams
- **Election Safety**: At most one leader per term.
- **Leader Append-Only**: A leader never overwrites or truncates its own log.
- **Quorum Requirement**: Majority write quorum (N/2 + 1) guarantees overlap with any future election quorum.

> **Exam Tip**: In Byzantine fault tolerance, 3f+1 nodes are needed; in Raft (fail-stop crash models), 2f+1 nodes suffice.`
      );
    }
    return;
  }

  const saved = localStorage.getItem("student_profile");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Ensure it is not the old dummy default
      if (parsed && parsed.id && parsed.id !== "11111111-1111-1111-1111-111111111111" && parsed.full_name) {
        currentStudent = parsed;
        updateUserUI(currentStudent.full_name);
        await loadUserData();
        return;
      }
    } catch (e) {
      console.error(e);
    }
  }

  // First time or unconfigured: clear any bad state & prompt onboarding modal
  localStorage.removeItem("student_profile");
  currentStudent = null;
  updateUserUI("");
  onboardingModal.classList.remove("hidden");
  studentNameInput.value = "";
  studentNameInput.focus();
  await loadUserData();
}

// Allow user to click on profile to change name or switch account
const profileContainer = document.getElementById("profile-container");
if (profileContainer) {
  profileContainer.addEventListener("click", () => {
    studentNameInput.value = currentStudent ? currentStudent.full_name : "";
    onboardingModal.classList.remove("hidden");
    studentNameInput.focus();
  });
}

onboardingForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = studentNameInput.value.trim();
  if (!name) return;

  const btn = onboardingForm.querySelector("button");
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Setting up Workspace...";

  try {
    let studentRecord = null;
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from("students")
        .insert([{ full_name: name }])
        .select()
        .single();
      if (!error && data) {
        studentRecord = data;
      }
    }

    if (!studentRecord) {
      studentRecord = {
        id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "std-" + Date.now(),
        full_name: name
      };
    }

    currentStudent = studentRecord;
    localStorage.setItem("student_profile", JSON.stringify(currentStudent));
    onboardingModal.classList.add("hidden");
    updateUserUI(name);
    await loadUserData();
  } catch (err) {
    console.error("Error creating student:", err);
    currentStudent = { id: "local-" + Date.now(), full_name: name };
    localStorage.setItem("student_profile", JSON.stringify(currentStudent));
    onboardingModal.classList.add("hidden");
    updateUserUI(name);
    await loadUserData();
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
});

function updateUserUI(name) {
  const cleanName = (name && name.trim()) || "Student";
  headerUserName.textContent = cleanName;
  profileName.textContent = cleanName;
  profileAvatar.textContent = name && name.trim() ? name.trim().charAt(0).toUpperCase() : "?";
}

async function loadUserData() {
  await Promise.all([loadPastSessions(), loadActionItems()]);
}

// ---------------- ACTION ITEMS & DEADLINE HUB ---------------- //

addTaskBtn.addEventListener("click", async () => {
  const input = taskNlInput.value.trim();
  if (!input) return;

  addTaskBtn.disabled = true;
  addTaskBtn.textContent = "Parsing...";

  try {
    const res = await fetch("/api/ai/parse-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: input })
    });
    const data = await res.json();
    if (data.success) {
      pendingParsedTask = data;
      parsedTaskTitle.textContent = data.task;
      parsedTaskDue.textContent = data.due_date_formatted;
      parsedTaskCard.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Failed to parse task:", err);
  } finally {
    addTaskBtn.disabled = false;
    addTaskBtn.textContent = "Add Task";
  }
});

confirmTaskBtn.addEventListener("click", async () => {
  if (!pendingParsedTask) return;

  confirmTaskBtn.disabled = true;
  confirmTaskBtn.textContent = "Saving...";

  try {
    const localTask = {
      id: "task-" + Date.now(),
      task: pendingParsedTask.task,
      due_date: pendingParsedTask.due_date,
      is_completed: false
    };
    if (currentStudent && currentStudent.id) {
      localTask.student_id = currentStudent.id;
    }

    const currentTasks = getStoredTasks();
    saveStoredTasks([...currentTasks, localTask]);

    if (supabaseClient && currentStudent) {
      try {
        const { data: insertedTask, error } = await supabaseClient
          .from("action_items")
          .insert([{
            student_id: currentStudent.id,
            task: pendingParsedTask.task,
            due_date: pendingParsedTask.due_date,
            is_completed: false
          }])
          .select()
          .single();

        if (!error && insertedTask) {
          const updatedTasks = getStoredTasks();
          const tIdx = updatedTasks.findIndex(t => t.id === localTask.id);
          if (tIdx !== -1) {
            updatedTasks[tIdx].id = insertedTask.id;
            saveStoredTasks(updatedTasks);
          }
        }
      } catch (dbErr) {
        console.warn("Supabase action item insert error, saved locally:", dbErr);
      }
    }

    taskNlInput.value = "";
    parsedTaskCard.classList.add("hidden");
    pendingParsedTask = null;
    await loadActionItems();
  } catch (err) {
    console.error("Failed to save action item:", err);
  } finally {
    confirmTaskBtn.disabled = false;
    confirmTaskBtn.textContent = "Confirm";
  }
});

cancelTaskBtn.addEventListener("click", () => {
  parsedTaskCard.classList.add("hidden");
  pendingParsedTask = null;
});

async function loadActionItems() {
  const localTasks = getStoredTasks();
  renderActionItems(localTasks);

  if (supabaseClient && currentStudent) {
    try {
      const { data: items, error } = await supabaseClient
        .from("action_items")
        .select("*")
        .eq("student_id", currentStudent.id)
        .order("due_date", { ascending: true });

      if (!error && items) {
        const remoteMap = new Map(items.map(item => [item.id, item]));
        const merged = [...items];
        for (const lt of localTasks) {
          if (!remoteMap.has(lt.id)) {
            merged.push(lt);
          }
        }
        merged.sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));
        saveStoredTasks(merged);
        renderActionItems(merged);
      }
    } catch (err) {
      console.error("Error loading action items from Supabase:", err);
    }
  }
}

function renderActionItems(items) {
  pendingTasksList.innerHTML = "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let overdue = 0;
  let completed = 0;

  const pending = items.filter(item => {
    if (item.is_completed) {
      completed++;
      return false;
    }
    const due = new Date(item.due_date);
    due.setHours(0, 0, 0, 0);
    if (due < today) {
      overdue++;
    }
    return true;
  });

  overdueCount.textContent = overdue;
  completedCount.textContent = completed;

  if (pending.length === 0) {
    pendingTasksList.innerHTML = `
      <div style="text-align: center; padding: 24px 0; font-family: var(--font-mono); color: var(--muted-foreground);">
        <div style="width: 36px; height: 36px; margin: 0 auto 8px; background: var(--secondary); color: var(--secondary-foreground); border: 2px solid var(--border); box-shadow: 2px 2px 0px var(--border); display: flex; align-items: center; justify-content: center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="m9 12 2 2 4-4"/>
          </svg>
        </div>
        <p style="font-size: 12px; font-weight: 700; color: var(--foreground); text-transform: uppercase;">All caught up!</p>
      </div>
    `;
    return;
  }

  pending.forEach(item => {
    const due = new Date(item.due_date);
    due.setHours(0, 0, 0, 0);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let countdownBadge = "";
    if (diffDays < 0) {
      countdownBadge = `<span class="task-due-badge overdue"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Overdue by ${Math.abs(diffDays)}d</span>`;
    } else if (diffDays === 0) {
      countdownBadge = `<span class="task-due-badge normal"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Due today</span>`;
    } else {
      countdownBadge = `<span class="task-due-badge normal"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Due in ${diffDays}d</span>`;
    }

    const itemEl = document.createElement("div");
    itemEl.className = "task-item-card";
    itemEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 1;">
        <input type="checkbox" class="task-checkbox" data-id="${item.id}">
        <div style="overflow: hidden; flex: 1;">
          <div style="font-size: 13px; font-weight: 700; color: var(--card-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.task)}</div>
          <div style="font-size: 11px; margin-top: 4px;">${countdownBadge}</div>
        </div>
      </div>
      <button class="icon-btn delete-task-btn" data-id="${item.id}" title="Delete task" style="width: 26px; height: 26px; box-shadow: 1px 1px 0px var(--border);">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      </button>
    `;

    itemEl.querySelector(".task-checkbox").addEventListener("change", async (e) => {
      await toggleTaskCompleted(item.id, e.target.checked);
    });

    itemEl.querySelector(".delete-task-btn").addEventListener("click", async () => {
      await deleteTask(item.id);
    });

    pendingTasksList.appendChild(itemEl);
  });
}

async function toggleTaskCompleted(id, completed) {
  try {
    const tasks = getStoredTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.is_completed = completed;
      saveStoredTasks(tasks);
    }

    if (supabaseClient) {
      await supabaseClient
        .from("action_items")
        .update({ is_completed: completed })
        .eq("id", id);
    }
    await loadActionItems();
  } catch (err) {
    console.error(err);
    await loadActionItems();
  }
}

async function deleteTask(id) {
  try {
    const tasks = getStoredTasks().filter(t => t.id !== id);
    saveStoredTasks(tasks);

    if (supabaseClient) {
      await supabaseClient
        .from("action_items")
        .delete()
        .eq("id", id);
    }
    await loadActionItems();
  } catch (err) {
    console.error(err);
    await loadActionItems();
  }
}

// ---------------- MULTI-DOCUMENT FILE PROCESSING ---------------- //

function setupEventListeners() {
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  });

  clearFilesBtn.addEventListener("click", () => {
    selectedFiles = [];
    renderFileQueue();
  });

  processFilesBtn.addEventListener("click", processDocuments);

  newSessionBtn.addEventListener("click", resetToNewSession);
  newDocBtn.addEventListener("click", resetToNewSession);

  document.getElementById("export-summary-pdf").addEventListener("click", () => {
    exportToPDF(summaryContent, "Comprehensive_Topic_Summary.pdf");
  });

  document.getElementById("export-revision-pdf").addEventListener("click", () => {
    exportToPDF(revisionContent, "High_Yield_Revision_Notes.pdf");
  });

  document.getElementById("share-summary-btn").addEventListener("click", () => {
    copyToClipboard(summaryContent.innerText, "Summary copied to clipboard!");
  });

  document.getElementById("share-revision-btn").addEventListener("click", () => {
    copyToClipboard(revisionContent.innerText, "Revision Notes copied to clipboard!");
  });

  if (startQuizBtn) {
    startQuizBtn.addEventListener("click", handleStartQuiz);
  }
}

function addFiles(files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
      selectedFiles.push(file);
    }
  }
  renderFileQueue();
}

function renderFileQueue() {
  fileQueue.innerHTML = "";
  fileCount.textContent = selectedFiles.length;

  if (selectedFiles.length === 0) {
    fileQueueContainer.classList.add("hidden");
    return;
  }

  fileQueueContainer.classList.remove("hidden");

  selectedFiles.forEach((file, index) => {
    const card = document.createElement("div");
    card.className = "file-item-card";

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; color: var(--accent);">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        <div style="overflow: hidden;">
          <div style="font-size: 12px; font-weight: 700; color: var(--card-foreground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(file.name)}</div>
          <div style="font-size: 10.5px; font-family: var(--font-mono); color: var(--muted-foreground);">${(file.size / 1024).toFixed(1)} KB</div>
        </div>
      </div>
      <button class="icon-btn" onclick="removeFile(${index})" title="Remove file" style="width: 26px; height: 26px; box-shadow: 1px 1px 0px var(--border);">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      </button>
    `;
    fileQueue.appendChild(card);
  });
}

window.removeFile = function(index) {
  selectedFiles.splice(index, 1);
  renderFileQueue();
};

async function processDocuments() {
  if (selectedFiles.length === 0) return;

  fileQueueContainer.classList.add("hidden");
  dropZone.classList.add("hidden");
  processingIndicator.classList.remove("hidden");

  try {
    let combinedText = "";
    const fileNames = selectedFiles.map(f => f.name);

    for (const file of selectedFiles) {
      combinedText += "\n\n--- DOCUMENT: " + file.name + " ---\n";
      const text = await extractFileText(file);
      combinedText += text;
    }

    currentDocumentText = combinedText;
    currentFileNames = fileNames;
    currentQuizQuestions = null;

    const res = await fetch("/api/ai/process-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_text: combinedText,
        file_names: fileNames
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    let summaryMd = (data.summary || "").trim();
    let revisionMd = (data.revision_notes || "").trim();

    // Fallback if older response structure or if one field is missing
    if (!summaryMd || !revisionMd) {
      let fullContent = data.content || summaryMd || revisionMd || "";
      const headerIdx = fullContent.search(/#+\s*Comprehensive Chapter/i);
      if (headerIdx !== -1) {
        fullContent = fullContent.slice(headerIdx);
      }
      const splitParts = fullContent.split(/(?:^|\n)(?:---\s*\n+)?(?=#+\s*High-Yield Revision Notes)/i);
      if (splitParts.length > 1) {
        summaryMd = summaryMd || splitParts[0].trim();
        revisionMd = revisionMd || splitParts.slice(1).join("\n\n").trim();
      } else {
        summaryMd = summaryMd || fullContent;
        revisionMd = revisionMd || fullContent;
      }
    }

    if (summaryMd && !summaryMd.startsWith("#")) {
      summaryMd = "# Comprehensive Chapter & Topic Summary\n\n" + summaryMd;
    }
    if (revisionMd && !revisionMd.startsWith("#")) {
      revisionMd = "# High-Yield Revision Notes & Exam Strategies\n\n" + revisionMd;
    }

    const sessionTitle = fileNames.length === 1 ? fileNames[0] : `${fileNames[0]} & ${fileNames.length - 1} more`;


    // Create local session object and save immediately
    let localSession = {
      id: "sess-" + Date.now(),
      title: sessionTitle,
      source_files: fileNames,
      summary_markdown: summaryMd,
      revision_notes_markdown: revisionMd,
      created_at: new Date().toISOString()
    };
    if (currentStudent && currentStudent.id) {
      localSession.student_id = currentStudent.id;
    }
    activeSessionId = localSession.id;

    const currentSessions = getStoredSessions();
    saveStoredSessions([localSession, ...currentSessions.filter(s => s.id !== localSession.id)]);
    renderSessionsList(getStoredSessions());

    // If Supabase is available, insert to Supabase and update the ID
    if (supabaseClient && currentStudent) {
      try {
        const { data: sessionData, error } = await supabaseClient
          .from("study_sessions")
          .insert([{
            student_id: currentStudent.id,
            title: sessionTitle,
            source_files: fileNames,
            summary_markdown: summaryMd,
            revision_notes_markdown: revisionMd
          }])
          .select()
          .single();

        if (!error && sessionData) {
          const sessions = getStoredSessions();
          const idx = sessions.findIndex(s => s.id === localSession.id);
          if (idx !== -1) {
            sessions[idx].id = sessionData.id;
            saveStoredSessions(sessions);
          }
          activeSessionId = sessionData.id;
          localSession.id = sessionData.id;
          await loadPastSessions();
        }
      } catch (dbErr) {
        console.warn("Supabase session insert failed, kept in local storage:", dbErr);
      }
    }

    displayResults(sessionTitle, fileNames, summaryMd, revisionMd);
  } catch (err) {
    console.error("Error processing documents:", err);
    alert("Error processing documents: " + err.message);
    dropZone.classList.remove("hidden");
    fileQueueContainer.classList.remove("hidden");
  } finally {
    processingIndicator.classList.add("hidden");
  }
}

// Client-Side Text Extractors with Canvas & OCR Fallback
async function extractFileText(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  try {
    if (ext === "pdf" && window.pdfjsLib) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        let lastY = null;
        let pageLines = [];
        let currentLine = "";

        for (const item of content.items) {
          if (!item.str) continue;
          const currentY = (item.transform && item.transform.length > 5) ? item.transform[5] : null;
          if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 6) {
            if (currentLine.trim()) {
              pageLines.push(currentLine.trim());
            }
            currentLine = item.str;
          } else {
            currentLine += (currentLine ? " " : "") + item.str;
          }
          lastY = currentY;
        }
        if (currentLine.trim()) {
          pageLines.push(currentLine.trim());
        }

        let pageText = pageLines.join("\n").trim();

        // If page has minimal native text (e.g. scanned page or slide), render to canvas and OCR
        if (pageText.length < 35 && window.Tesseract) {
          try {
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            const ocrRes = await Tesseract.recognize(canvas, "eng");
            if (ocrRes && ocrRes.data && ocrRes.data.text.trim()) {
              pageText = (pageText ? pageText + "\n" : "") + ocrRes.data.text.trim();
            }
          } catch (ocrErr) {
            console.warn("Page " + i + " OCR fallback notice:", ocrErr);
          }
        }

        text += `\n[Page ${i}]\n` + (pageText || "(Visual diagram or formula slide)");
      }

      return text;
    } else if (ext === "docx" && window.mammoth) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
      return result.value;
    } else if (file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) {
      if (window.Tesseract) {
        try {
          const ocrRes = await Tesseract.recognize(file, "eng");
          if (ocrRes && ocrRes.data && ocrRes.data.text.trim()) {
            return `--- IMAGE NOTES: ${file.name} ---\n` + ocrRes.data.text.trim();
          }
        } catch (imgOcrErr) {
          console.warn("Image OCR notice:", imgOcrErr);
        }
      }
      return `[Attached Image: ${file.name}]`;
    } else {
      return await file.text();
    }
  } catch (e) {
    console.warn("Text extract fallback for " + file.name, e);
    return `[Attached Document: ${file.name}]`;
  }
}

function displayResults(title, files, summaryMd, revisionMd) {
  sessionDisplayTitle.textContent = title;
  sessionFileBadges.innerHTML = "";

  currentFileNames = (files && files.length > 0) ? files : [title];
  if (!currentDocumentText || currentDocumentText.trim().length === 0) {
    currentDocumentText = (summaryMd || "") + "\n\n" + (revisionMd || "");
  }
  currentQuizQuestions = null;

  files.forEach(name => {
    const badge = document.createElement("span");
    badge.className = "session-file-badge";
    badge.textContent = name;
    sessionFileBadges.appendChild(badge);
  });

  summaryContent.innerHTML = safeRenderMarkdown(summaryMd);
  revisionContent.innerHTML = safeRenderMarkdown(revisionMd);

  uploadStage.classList.add("hidden");
  resultsStage.classList.remove("hidden");
}

function resetToNewSession() {
  selectedFiles = [];
  currentDocumentText = "";
  currentFileNames = [];
  currentQuizQuestions = null;
  renderFileQueue();
  dropZone.classList.remove("hidden");
  uploadStage.classList.remove("hidden");
  resultsStage.classList.add("hidden");
  activeSessionId = null;
}

// ---------------- INTERACTIVE QUIZ LAUNCHER ---------------- //

async function handleStartQuiz() {
  if (!startQuizBtn) return;
  const originalHtml = startQuizBtn.innerHTML;

  startQuizBtn.disabled = true;
  startQuizBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.8s linear infinite;">
      <circle cx="12" cy="12" r="10" stroke-dasharray="35" stroke-dashoffset="10"/>
    </svg>
    <span>Generating Exam Quiz...</span>
  `;

  try {
    const textToSend = currentDocumentText || (summaryContent.innerText + "\n\n" + revisionContent.innerText);
    const filesToSend = (currentFileNames && currentFileNames.length > 0) ? currentFileNames : [sessionDisplayTitle.textContent || "Study Material"];
    const topicTitle = sessionDisplayTitle.textContent || filesToSend[0] || "Exam Readiness Quiz";
    const studentName = currentStudent ? currentStudent.full_name : (headerUserName ? headerUserName.textContent : "Student");

    let questions = currentQuizQuestions;

    if (!questions || questions.length === 0) {
      try {
        const res = await fetch("/api/ai/generate-quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_text: textToSend,
            file_names: filesToSend
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
            questions = data.questions;
          }
        }
      } catch (apiErr) {
        console.warn("Quiz API endpoint warning:", apiErr);
      }
    }

    if (!questions || questions.length === 0) {
      questions = generateClientFallbackQuiz(textToSend, filesToSend[0]);
    }

    currentQuizQuestions = questions;

    const payload = {
      topic: topicTitle,
      studentName: studentName,
      questions: questions
    };

    localStorage.setItem("active_quiz", JSON.stringify(payload));
    window.open("quiz.html", "_blank");
  } catch (err) {
    console.error("Failed to launch quiz:", err);
    alert("Could not start quiz: " + err.message);
  } finally {
    startQuizBtn.disabled = false;
    startQuizBtn.innerHTML = originalHtml;
  }
}

function generateClientFallbackQuiz(text, topicName) {
  const lines = (text || "").split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 25 && !l.startsWith("#") && !l.startsWith("---") && !l.startsWith("|") && !l.startsWith("[Page"));

  const title = (topicName || "Study Material").replace(/\.[^/.]+$/, "");
  const targetCount = Math.max(5, Math.min(lines.length, 10));
  const questions = [];

  for (let i = 0; i < targetCount; i++) {
    const line = lines[i] || `Fundamental principle ${i + 1} of ${title}`;
    const words = line.split(" ");
    const keyTerm = words.slice(0, Math.min(4, words.length)).join(" ");

    const correctOpt = line.length > 80 ? line.slice(0, 80) + "..." : line;
    const distractors = [
      `It acts as an auxiliary component without direct influence on ${title} guarantees.`,
      `It replaces standard state execution in degraded network partitions.`,
      `It is deprecated in modern implementations of ${title}.`
    ];

    const correctIdx = (i * 3 + 1) % 4;
    const options = [...distractors];
    options.splice(correctIdx, 0, correctOpt);

    questions.push({
      id: i + 1,
      question: `According to ${title}, what is the core significance of "${keyTerm}"?`,
      options: options,
      correct_index: correctIdx,
      explanation: `Directly derived from the source notes: "${line.slice(0, 120)}".`
    });
  }

  return questions;
}

// ---------------- SESSIONS HISTORY (LEFT SIDEBAR) ---------------- //

async function loadPastSessions() {
  const localSessions = getStoredSessions();
  renderSessionsList(localSessions);

  if (supabaseClient && currentStudent) {
    try {
      const { data: sessions, error } = await supabaseClient
        .from("study_sessions")
        .select("*")
        .eq("student_id", currentStudent.id)
        .order("created_at", { ascending: false });

      if (!error && sessions) {
        const remoteMap = new Map(sessions.map(s => [s.id, s]));
        const merged = [...sessions];
        for (const ls of localSessions) {
          if (!remoteMap.has(ls.id)) {
            merged.push(ls);
          }
        }
        merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        saveStoredSessions(merged);
        renderSessionsList(merged);
      }
    } catch (err) {
      console.error("Error loading sessions from Supabase:", err);
    }
  }
}

function renderSessionsList(sessions) {
  sessionsList.innerHTML = "";

  if (sessions.length === 0) {
    sessionsList.innerHTML = `
      <div style="font-size: 11px; color: var(--text-dim); text-align: center; padding: 16px 8px;">
        No past sessions yet. Upload notes to create one!
      </div>
    `;
    return;
  }

  sessions.forEach(session => {
    const item = document.createElement("div");
    const isActive = activeSessionId === session.id;
    item.className = "session-item" + (isActive ? " active" : "");

    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; flex: 1;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; color: var(--accent);">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/>
        </svg>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700;">${escapeHtml(session.title)}</span>
      </div>
      <button class="icon-btn delete-session-btn" style="width: 24px; height: 24px; box-shadow: 1px 1px 0px var(--border);" title="Delete session">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
        </svg>
      </button>
    `;

    item.addEventListener("click", (e) => {
      if (e.target.closest(".delete-session-btn")) return;
      activeSessionId = session.id;
      displayResults(session.title, session.source_files || [], session.summary_markdown, session.revision_notes_markdown);
      renderSessionsList(sessions);
    });

    item.querySelector(".delete-session-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm(`Delete session "${session.title}"?`)) {
        await deleteSession(session.id);
      }
    });

    sessionsList.appendChild(item);
  });
}

async function deleteSession(id) {
  try {
    const updated = getStoredSessions().filter(s => s.id !== id);
    saveStoredSessions(updated);

    if (supabaseClient) {
      await supabaseClient
        .from("study_sessions")
        .delete()
        .eq("id", id);
    }
    if (activeSessionId === id) {
      resetToNewSession();
    }
    await loadPastSessions();
  } catch (err) {
    console.error("Error deleting session:", err);
    await loadPastSessions();
  }
}

// ---------------- EXPORT & SHARE ---------------- //

function exportToPDF(element, filename) {
  if (window.html2pdf) {
    const opt = {
      margin: [10, 10, 10, 10],
      filename: filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };
    html2pdf().set(opt).from(element).save();
  } else {
    window.print();
  }
}

function copyToClipboard(text, message) {
  navigator.clipboard.writeText(text).then(() => {
    alert(message || "Copied to clipboard!");
  }).catch(err => {
    console.error("Clipboard error:", err);
  });
}

// ---------------- STORAGE & RENDERING HELPERS ---------------- //

function getStoredSessions() {
  try {
    const raw = localStorage.getItem("scholarflow_sessions");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error reading stored sessions:", e);
    return [];
  }
}

function saveStoredSessions(sessions) {
  try {
    localStorage.setItem("scholarflow_sessions", JSON.stringify(sessions || []));
  } catch (e) {
    console.error("Error saving stored sessions:", e);
  }
}

function getStoredTasks() {
  try {
    const raw = localStorage.getItem("scholarflow_tasks");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error reading stored tasks:", e);
    return [];
  }
}

function saveStoredTasks(tasks) {
  try {
    localStorage.setItem("scholarflow_tasks", JSON.stringify(tasks || []));
  } catch (e) {
    console.error("Error saving stored tasks:", e);
  }
}

function safeRenderMarkdown(md) {
  if (!md) return "";
  const rawHtml = window.marked ? marked.parse(md) : escapeHtml(md);
  if (window.DOMPurify) {
    return DOMPurify.sanitize(rawHtml);
  }
  return rawHtml;
}

function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    safeRenderMarkdown,
    generateClientFallbackQuiz,
    getStoredSessions,
    saveStoredSessions,
    getStoredTasks,
    saveStoredTasks,
    escapeHtml
  };
}
