const API_URL = "https://script.google.com/macros/s/AKfycbwzB8n5QI8QlFctE3_q2tMHjpHO1ZiC02zZyL4RPfguIr4jM_ICAiRcCg0Sg_UrmQY/exec";

let db = { subjects: [], units: [], questions: [], responses: [], reports: null };

const $ = id => document.getElementById(id);

function apiUrl(params) {
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}
async function api(action, extra = {}) {
  if (!API_URL || API_URL.includes("PASTE_")) throw new Error("Please set API_URL in admin.js.");
  const res = await fetch(apiUrl({ action, ...extra }));
  return await res.json();
}
function alertAdmin(msg, success = false) {
  const el = $("adminAlert"); el.textContent = msg; el.classList.remove("hidden");
  el.style.background = success ? "#effbf3" : "";
  el.style.color = success ? "#237b43" : "";
  setTimeout(() => el.classList.add("hidden"), 4000);
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
function statusBadge(status) { const s = String(status || "").toLowerCase(); return `<span class="status ${s}">${esc(status)}</span>` }

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".admin-tab").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    $("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "dashboard") loadDashboard();
    if (btn.dataset.tab === "subjects") renderSubjects();
    if (btn.dataset.tab === "units") renderUnits();
    if (btn.dataset.tab === "questions") renderQuestions();
    if (btn.dataset.tab === "responses") renderResponses();
    if (btn.dataset.tab === "reports") renderReports();
  });
});

async function loadAll() {
  try {
    const data = await api("getAdminData");
    if (!data.ok) throw new Error(data.message);
    db = data;
    loadDashboard();
    renderSubjects(); renderUnits(); renderQuestions(); renderResponses(); renderReports();
  } catch (e) { alertAdmin(e.message) }
}

function loadDashboard() {
  const responses = db.responses || [];
  $("statResponses").textContent = responses.length;
  $("statStudents").textContent = new Set(responses.map(r => r.roll_no)).size;
  const av = responses.length ? responses.reduce((a, r) => a + Number(r.average_score || 0), 0) / responses.length : 0;
  $("statAverage").textContent = av.toFixed(2);
  const activeUnit = (db.units || []).find(u => String(u.status).toUpperCase() === "ACTIVE");
  $("statUnit").textContent = activeUnit ? `U${activeUnit.unit_no}` : "—";
  const subject = activeUnit ? (db.subjects || []).find(s => String(s.id) === String(activeUnit.subject_id)) : null;
  $("activeSurveyBox").innerHTML = activeUnit ? `<b>${esc(subject?.name || "Subject")}</b> (${esc(subject?.code || "")})<br>Unit ${esc(activeUnit.unit_no)} — ${esc(activeUnit.title)}<br><br>${statusBadge("ACTIVE")}` : `<div class="empty">No active unit. Activate a unit from Units.</div>`;
}
$("refreshDashboard").onclick = loadAll;

function renderSubjects() {
  $("subjectsTable").innerHTML = (db.subjects || []).map(s => `<tr>
    <td><b>${esc(s.code)}</b></td><td>${esc(s.name)}</td><td>${esc(s.semester)}</td><td>${esc(s.session)}</td>
    <td>${s.active ? statusBadge("ACTIVE") : statusBadge("CLOSED")}</td>
    <td><button class="mini-btn" onclick="editSubject('${esc(s.id)}')">Edit</button></td></tr>`).join("") || `<tr><td colspan="6">No subjects.</td></tr>`;
}
function renderUnits() {
  $("unitsTable").innerHTML = (db.units || []).map(u => {
    const s = db.subjects.find(x => String(x.id) === String(u.subject_id));
    const action = String(u.status).toUpperCase() === "ACTIVE" ? `<button class="mini-btn" onclick="setUnitStatus('${u.id}','CLOSED')">Close</button>` : `<button class="mini-btn" onclick="setUnitStatus('${u.id}','ACTIVE')">Activate</button>`;
    return `<tr><td>${esc(s?.code || "")}</td><td>U${esc(u.unit_no)}</td><td>${esc(u.title)}</td><td>${statusBadge(u.status)}</td><td>${action} <button class="mini-btn" onclick="editUnit('${esc(u.id)}')">Edit</button></td></tr>`
  }).join("") || `<tr><td colspan="5">No units.</td></tr>`;
}
function renderQuestions() {
  $("questionsTable").innerHTML = (db.questions || []).map(q => {
    const u = db.units.find(x => String(x.id) === String(q.unit_id)); const s = db.subjects.find(x => String(x.id) === String(u?.subject_id));
    return `<tr><td>${esc(s?.code || "")}</td><td>U${esc(u?.unit_no || "")}</td><td>${esc(q.co)}</td><td>${esc(q.text)}</td><td>${q.active ? statusBadge("ACTIVE") : statusBadge("CLOSED")}</td><td><button class="mini-btn" onclick="editQuestion('${esc(q.id)}')">Edit</button> <button class="mini-btn" onclick="toggleQuestion('${esc(q.id)}',${!q.active})">${q.active ? "Disable" : "Enable"}</button></td></tr>`
  }).join("") || `<tr><td colspan="6">No questions.</td></tr>`;
}
function renderResponses() {
  $("responsesTable").innerHTML = (db.responses || []).slice().reverse().map(r => `<tr>
    <td>${esc(r.timestamp)}</td><td>${esc(r.subject_code)}</td><td>U${esc(r.unit_no)}</td><td>${esc(r.roll_no)}</td><td>${esc(r.student_name)}</td><td>${esc(r.section)}</td><td><b>${Number(r.average_score || 0).toFixed(2)}</b></td>
  </tr>`).join("") || `<tr><td colspan="7">No responses.</td></tr>`;
}
function renderReports() {
  const rows = db.reports?.student_unit || [];
  const units = [...new Set(rows.map(r => r.unit_label))];
  $("reportHead").innerHTML = `<tr><th>Roll No</th><th>Student</th>${units.map(u => `<th>${esc(u)}</th>`).join("")}<th>Overall</th></tr>`;
  const by = {};
  rows.forEach(r => { const k = r.roll_no; if (!by[k]) by[k] = { roll_no: k, name: r.student_name, scores: {} }; by[k].scores[r.unit_label] = Number(r.average).toFixed(2) });
  $("reportBody").innerHTML = Object.values(by).map(r => {
    const vals = units.map(u => r.scores[u] ? Number(r.scores[u]) : null).filter(v => v !== null);
    const overall = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : "—";
    return `<tr><td>${esc(r.roll_no)}</td><td>${esc(r.name)}</td>${units.map(u => `<td>${r.scores[u] || "—"}</td>`).join("")}<td><b>${overall}</b></td></tr>`
  }).join("") || `<tr><td colspan="4">No report data.</td></tr>`;
  $("coReportBody").innerHTML = (db.reports?.co || []).map(r => `<tr><td>${esc(r.subject_code)}</td><td>${esc(r.co)}</td><td><b>${Number(r.average).toFixed(2)}</b></td><td>${r.count}</td></tr>`).join("") || `<tr><td colspan="4">No CO data.</td></tr>`;
}
$("refreshResponses").onclick = loadAll; $("refreshReports").onclick = loadAll;

function openModal(title, body) {
  $("modalTitle").textContent = title; $("modalBody").innerHTML = body; $("modal").classList.remove("hidden");
}
function closeModal() { $("modal").classList.add("hidden") }
$("modalClose").onclick = closeModal;
$("modal").addEventListener("click", e => { if (e.target === $("modal")) closeModal() });

$("addSubjectBtn").onclick = () => openModal("Add Subject", subjectForm());
$("addUnitBtn").onclick = () => openModal("Add Unit", unitForm());
$("addQuestionBtn").onclick = () => openModal("Add Question", questionForm());

function subjectForm(s = {}) {
  return `<form class="modal-form" id="subjectForm">
 <label>Subject Code<input name="code" value="${esc(s.code || "")}" required></label>
 <label>Subject Name<input name="name" value="${esc(s.name || "")}" required></label>
 <label>Semester<input name="semester" value="${esc(s.semester || "")}" placeholder="III"></label>
 <label>Academic Session<input name="session" value="${esc(s.session || "")}" placeholder="2026-27"></label>
 <label>Department<input name="department" value="${esc(s.department || "Department of Information Technology")}"></label>
 <label class="checkbox-row"><input type="checkbox" name="active" ${s.active ? "checked" : ""}> Active subject</label>
 <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary">Save</button></div></form>`;
}
function unitForm(u = {}) {
  const opts = db.subjects.map(s => `<option value="${s.id}" ${String(s.id) === String(u.subject_id) ? "selected" : ""}>${esc(s.code)} — ${esc(s.name)}</option>`).join("");
  return `<form class="modal-form" id="unitForm">
 <label>Subject<select name="subject_id" required>${opts}</select></label>
 <label>Unit Number<input name="unit_no" type="number" min="1" value="${esc(u.unit_no || "1")}" required></label>
 <label>Unit Title<input name="title" value="${esc(u.title || "")}" required></label>
 <label>Description<textarea name="description" rows="3">${esc(u.description || "")}</textarea></label>
 <label>Status<select name="status"><option ${u.status === "UPCOMING" || !u.status ? "selected" : ""}>UPCOMING</option><option ${u.status === "ACTIVE" ? "selected" : ""}>ACTIVE</option><option ${u.status === "CLOSED" ? "selected" : ""}>CLOSED</option></select></label>
 <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary">Save</button></div></form>`;
}
function questionForm(q = {}) {
  const opts = db.units.map(u => { const s = db.subjects.find(x => String(x.id) === String(u.subject_id)); return `<option value="${u.id}" ${String(u.id) === String(q.unit_id) ? "selected" : ""}>${esc(s?.code || "")} — U${esc(u.unit_no)} ${esc(u.title)}</option>` }).join("");
  return `<form class="modal-form" id="questionForm">
 <label>Unit<select name="unit_id" required>${opts}</select></label>
 <label>Course Outcome (CO)<input name="co" value="${esc(q.co || "CO-1")}" placeholder="CO-1" required></label>
 <label>Question<textarea name="text" rows="4" required>${esc(q.text || "")}</textarea></label>
 <label>Order<input name="order_no" type="number" value="${esc(q.order_no || "1")}"></label>
 <label class="checkbox-row"><input type="checkbox" name="active" ${q.active !== false ? "checked" : ""}> Active</label>
 <div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancel</button><button class="primary">Save</button></div></form>`;
}
async function submitForm(formId, action, id) {
  const form = $(formId), fd = new FormData(form); const obj = Object.fromEntries(fd.entries());
  obj.active = form.querySelector('[name="active"]')?.checked ?? true;
  if (id) obj.id = id;
  const data = await api(action, obj); if (!data.ok) throw new Error(data.message);
  closeModal(); alertAdmin("Saved successfully.", true); await loadAll();
}
document.addEventListener("submit", async e => {
  if (["subjectForm", "unitForm", "questionForm"].includes(e.target.id)) {
    e.preventDefault();
    try { await submitForm(e.target.id, e.target.dataset.action || ("subjectForm" === e.target.id ? "saveSubject" : e.target.id === "unitForm" ? "saveUnit" : "saveQuestion"), e.target.dataset.id) } catch (err) { alertAdmin(err.message) }
  }
});
function editSubject(id) { const s = db.subjects.find(x => String(x.id) === String(id)); openModal("Edit Subject", subjectForm(s)); $("subjectForm").dataset.action = "saveSubject"; $("subjectForm").dataset.id = id }
function editUnit(id) { const u = db.units.find(x => String(x.id) === String(id)); openModal("Edit Unit", unitForm(u)); $("unitForm").dataset.action = "saveUnit"; $("unitForm").dataset.id = id }
function editQuestion(id) { const q = db.questions.find(x => String(x.id) === String(id)); openModal("Edit Question", questionForm(q)); $("questionForm").dataset.action = "saveQuestion"; $("questionForm").dataset.id = id }
async function setUnitStatus(id, status) {
  try { const d = await api("setUnitStatus", { id, status }); if (!d.ok) throw new Error(d.message); alertAdmin(`Unit is now ${status}.`, true); await loadAll() } catch (e) { alertAdmin(e.message) }
}
async function toggleQuestion(id, active) {
  try { const d = await api("toggleQuestion", { id, active }); if (!d.ok) throw new Error(d.message); await loadAll() } catch (e) { alertAdmin(e.message) }
}
loadAll();
