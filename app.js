/*
  Reusable Student Self-Evaluation frontend.
  Set API_URL to your deployed Google Apps Script Web App URL.
*/
const API_URL = "https://script.google.com/macros/s/AKfycbwzB8n5QI8QlFctE3_q2tMHjpHO1ZiC02zZyL4RPfguIr4jM_ICAiRcCg0Sg_UrmQY/exec";

let state = {
  config: null,
  activeUnit: null,
  questions: [],
  answers: {},
  student: {},
  submissionId: ""
};

const $ = (id) => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showAlert(message, type = "error") {
  const el = $("alert");
  el.textContent = message;
  el.classList.remove("hidden");
  el.style.background = type === "success" ? "#effbf3" : "";
  el.style.color = type === "success" ? "#237b43" : "";
  setTimeout(() => el.classList.add("hidden"), 5000);
}

function apiUrl(params) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}

async function getData(action, extra = {}) {
  if (!API_URL || API_URL.includes("PASTE_")) throw new Error("Please set API_URL in app.js.");
  const res = await fetch(apiUrl({ action, ...extra }), { method: "GET" });
  return await res.json();
}

async function loadConfig() {
  try {
    const data = await getData("getActiveSurvey");
    if (!data.ok) throw new Error(data.message || "No active survey.");
    state.config = data.subject;
    state.activeUnit = data.unit;
    state.questions = data.questions || [];

    $("collegeName").textContent = data.settings?.college_name || "Hindustan College of Science & Technology";
    $("departmentName").textContent = data.subject.department || data.settings?.department || "Department of Information Technology";
    $("subjectTitle").textContent = `${data.subject.name} (${data.subject.code})`;
    $("subjectMeta").textContent = `${data.subject.semester} Semester  |  Session ${data.subject.session}`;
    $("subjectBadge").textContent = data.unit.title;
    $("unitTitle").textContent = `Unit ${data.unit.unit_no} — ${data.unit.title}`;
    $("unitDescription").textContent = data.unit.description || "";
    $("surveyTitle").textContent = data.unit.title;
    $("surveyUnitLabel").textContent = `UNIT ${data.unit.unit_no} OF ${data.totalUnits || "—"}`;

    if (!state.questions.length) {
      throw new Error("No active questions have been added for this unit.");
    }
  } catch (err) {
    $("subjectTitle").textContent = "No active survey";
    $("subjectMeta").textContent = "";
    showAlert(err.message);
  }
}

function validateStudent() {
  const name = $("studentName").value.trim();
  const roll = $("rollNo").value.trim();
  const section = $("section").value;
  if (!name || !roll || !section) {
    showAlert("Please enter Student Name, Roll Number and Section.");
    return false;
  }
  state.student = { name, roll, section };
  return true;
}

$("continueBtn").addEventListener("click", () => {
  if (!validateStudent()) return;
  $("reviewStudent").innerHTML = `<b>${escapeHtml(state.student.name)}</b> &nbsp;|&nbsp; Roll No: <b>${escapeHtml(state.student.roll)}</b> &nbsp;|&nbsp; Section: <b>${escapeHtml(state.student.section)}</b>`;
  showScreen("screen-instructions");
});

$("startBtn").addEventListener("click", () => {
  renderQuestions();
  showScreen("screen-survey");
});

$("backToInstructions").addEventListener("click", () => showScreen("screen-instructions"));

function renderQuestions() {
  const groups = {};
  state.questions.forEach((q, index) => {
    const co = q.co || "General";
    if (!groups[co]) groups[co] = [];
    groups[co].push({ ...q, index });
  });

  let html = "";
  Object.entries(groups).forEach(([co, qs]) => {
    html += `<div class="question-group"><div class="co-title">${escapeHtml(co)}</div>`;
    qs.forEach(q => {
      html += `
      <div class="question-card">
        <div class="question-number">QUESTION ${q.index + 1}</div>
        <div class="question-text">${escapeHtml(q.text)}</div>
        <div class="ratings">
          ${ratingHtml(q.id, 1, "Least Able")}
          ${ratingHtml(q.id, 2, "Moderately Able")}
          ${ratingHtml(q.id, 3, "Strongly Able")}
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  $("questionContainer").innerHTML = html;

  document.querySelectorAll(".rating").forEach(btn => {
    btn.addEventListener("click", () => {
      const qid = btn.dataset.qid;
      state.answers[qid] = Number(btn.dataset.value);
      document.querySelectorAll(`.rating[data-qid="${cssEscape(qid)}"]`).forEach(x => x.classList.remove("selected"));
      btn.classList.add("selected");
      updateProgress();
    });
  });
  updateProgress();
}

function ratingHtml(qid, value, label) {
  const selected = state.answers[qid] === value ? "selected" : "";
  return `<button type="button" class="rating ${selected}" data-qid="${escapeAttr(qid)}" data-value="${value}"><strong>${value}</strong><span>${label}</span></button>`;
}

function updateProgress() {
  const total = state.questions.length;
  const answered = state.questions.filter(q => state.answers[q.id]).length;
  const pct = total ? Math.round(answered / total * 100) : 0;
  $("progressBar").style.width = pct + "%";
  $("progressNumber").textContent = `${answered}/${total} answered`;
}

$("reviewBtn").addEventListener("click", () => {
  const unanswered = state.questions.filter(q => !state.answers[q.id]);
  if (unanswered.length) {
    showAlert(`Please answer all questions. ${unanswered.length} question(s) are still unanswered.`);
    return;
  }
  renderReview();
  showScreen("screen-review");
});

function renderReview() {
  const groups = {};
  state.questions.forEach(q => {
    const co = q.co || "General";
    if (!groups[co]) groups[co] = [];
    groups[co].push(q);
  });
  let html = "";
  Object.entries(groups).forEach(([co, qs]) => {
    html += `<div class="review-group"><div class="review-co">${escapeHtml(co)}</div>`;
    qs.forEach((q, i) => {
      html += `<div class="review-row"><span>${escapeHtml(q.text)}</span><span class="score-pill">${state.answers[q.id]}</span></div>`;
    });
    html += `</div>`;
  });
  $("reviewContainer").innerHTML = html;
}

$("editBtn").addEventListener("click", () => showScreen("screen-survey"));

$("submitBtn").addEventListener("click", async () => {
  if (!state.config || !state.activeUnit) return;

  $("submitBtn").disabled = true;
  $("submitBtn").textContent = "Submitting...";

  const submissionId = `${state.config.code || state.config.id}-${state.activeUnit.unit_no}-${Date.now().toString().slice(-6)}`;
  state.submissionId = submissionId;

  const answers = state.questions.map(q => ({
    question_id: q.id,
    co: q.co || "",
    score: state.answers[q.id]
  }));
  const average = answers.reduce((a, b) => a + b.score, 0) / answers.length;

  try {
    const data = await getData("checkDuplicate", {
      subject_id: state.config.id,
      unit_id: state.activeUnit.id,
      roll_no: state.student.roll
    });
    if (data.exists) {
      showAlert("You have already submitted this unit. Duplicate submissions are not allowed.");
      $("submitBtn").disabled = false;
      $("submitBtn").textContent = "Submit Evaluation ✓";
      return;
    }

    // Use a normal URL request for maximum simplicity and compatibility with GitHub Pages.
    // Apps Script records the submission. The ID is generated here and stored with it.
    const payload = encodeURIComponent(JSON.stringify(answers));
    const submitData = await getData("submit", {
      submission_id: submissionId,
      subject_id: state.config.id,
      unit_id: state.activeUnit.id,
      roll_no: state.student.roll,
      student_name: state.student.name,
      section: state.student.section,
      answers_json: payload,
      average_score: average.toFixed(2)
    });

    if (!submitData.ok) throw new Error(submitData.message || "Submission failed.");

    $("submissionId").textContent = submissionId;
    showScreen("screen-success");
  } catch (err) {
    showAlert(err.message);
  } finally {
    $("submitBtn").disabled = false;
    $("submitBtn").textContent = "Submit Evaluation ✓";
  }
});

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s) }
function cssEscape(s) { return String(s).replace(/"/g, '\\"') }

loadConfig();
