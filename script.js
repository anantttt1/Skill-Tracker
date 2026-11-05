/* ==================== SKILLTRACK - Main Application ==================== */

const STORAGE_KEY = 'skilltrack_data_v2';

const defaultData = {
  profile: { name: 'Anant', avatar: 'A', dailyTarget: 2 },
  theme: 'light',
  skills: [],
  problems: [],
  sessions: [],
  goals: [],
  projects: [],
  activities: []
};

let data = null, currentSection = 'dashboard', editingId = null, modalMode = null;
let timerInterval = null, timerSeconds = 0, timerRunning = false, timerPaused = false;
let weeklyChart = null, skillsChart = null, analyticsWeeklyChart = null, analyticsSkillsChart = null, difficultyChart = null;

function uid(prefix = 'id') { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      data = JSON.parse(raw);
      data.profile = data.profile || defaultData.profile;
      data.theme = data.theme || 'light';
      data.skills = data.skills || []; data.problems = data.problems || [];
      data.sessions = data.sessions || []; data.goals = data.goals || [];
      data.projects = data.projects || []; data.activities = data.activities || [];
    } else { data = structuredClone(defaultData); save(); }
  } catch (e) { data = structuredClone(defaultData); save(); }
}
function toast(msg, type = 'success') {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg; c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2800);
}
function confirmDialog(title, message) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    overlay.classList.add('open');
    const ok = document.getElementById('confirmOk'), cancel = document.getElementById('confirmCancel');
    function cleanup(r) { overlay.classList.remove('open'); ok.onclick = cancel.onclick = null; resolve(r); }
    ok.onclick = () => cleanup(true); cancel.onclick = () => cleanup(false);
  });
}
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}
function formatTimer(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return h + ':' + m + ':' + s;
}
function todayStr() { return new Date().toISOString().slice(0, 10); }
function addActivity(text) {
  data.activities.unshift({ text, time: 'Just now' });
  if (data.activities.length > 20) data.activities.pop(); save();
}
function esc(str) {
  if (!str) return '';
  const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
}

function navigate(section) {
  currentSection = section;
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.section === section));
  document.querySelectorAll('.section').forEach(sec => sec.classList.toggle('active', sec.id === 'section-' + section));
  const titles = {
    dashboard: ['Dashboard', 'Track your growth every day'], skills: ['My Skills', 'Manage and track your skills'],
    coding: ['Coding Tracker', 'Log problems you solve'], timer: ['Study Timer', 'Focus and track study sessions'],
    goals: ['Goals', 'Set targets and measure progress'], projects: ['Projects', 'Track your personal projects'],
    analytics: ['Analytics', 'Insights into your learning'], settings: ['Settings', 'Customize your experience']
  };
  document.getElementById('pageTitle').textContent = titles[section][0];
  document.getElementById('pageSubtitle').textContent = titles[section][1];
  document.getElementById('sidebar').classList.remove('open');
  document.querySelector('.sidebar-backdrop')?.classList.remove('show');
  renderCurrentSection(); lucide.createIcons();
}
function renderCurrentSection() {
  const map = { dashboard: renderDashboard, skills: renderSkills, coding: renderCoding, timer: renderTimer, goals: renderGoals, projects: renderProjects, analytics: renderAnalytics, settings: renderSettings };
  (map[currentSection] || (() => {}))();
}

function calcStreak() {
  const days = new Set(data.sessions.map(s => s.date));
  let streak = 0, d = new Date();
  for (let i = 0; i < 60; i++) {
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) { streak++; d.setDate(d.getDate() - 1); }
    else if (i === 0) { d.setDate(d.getDate() - 1); continue; }
    else break;
  }
  return streak;
}
function getLast7DaysHours() {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const secs = data.sessions.filter(s => s.date === key).reduce((a, s) => a + s.duration, 0);
    result.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), hours: +(secs / 3600).toFixed(1) });
  }
  return result;
}

function renderDashboard() {
  document.getElementById('welcomeName').textContent = data.profile.name;
  document.getElementById('statSkills').textContent = data.skills.length;
  document.getElementById('statProblems').textContent = data.problems.length;
  const totalSecs = data.sessions.reduce((s, x) => s + x.duration, 0);
  document.getElementById('statHours').textContent = Math.round(totalSecs / 3600) + 'h';
  document.getElementById('statStreak').textContent = calcStreak();
  const avg = data.skills.length ? Math.round(data.skills.reduce((s, x) => s + x.progress, 0) / data.skills.length) : 0;
  document.getElementById('overallProgress').textContent = avg + '%';
  const ring = document.getElementById('overallRing');
  const circ = 2 * Math.PI * 52;
  ring.style.strokeDasharray = circ;
  ring.style.strokeDashoffset = circ - (avg / 100) * circ;
  const todayGoals = data.goals.filter(g => !g.completed).slice(0, 4);
  const goalsList = document.getElementById('todayGoalsList');
  goalsList.innerHTML = todayGoals.length === 0 ? '<div class="empty-state"><p>No active goals. Add one!</p></div>' :
    todayGoals.map(g => '<div class="list-item"><div class="dot"></div><div class="text">' + esc(g.title) + '</div><div class="time">' + g.progress + '/' + g.targetHours + 'h</div></div>').join('');
  const actList = document.getElementById('activityList');
  actList.innerHTML = data.activities.length === 0 ? '<div class="empty-state"><p>No recent activity</p></div>' :
    data.activities.slice(0, 6).map(a => '<div class="list-item"><div class="dot"></div><div class="text">' + esc(a.text) + '</div><div class="time">' + esc(a.time) + '</div></div>').join('');
  renderWeeklyChart('weeklyChart'); renderSkillsBarChart('skillsChart');
}

function renderWeeklyChart(canvasId) {
  const ctx = document.getElementById(canvasId); if (!ctx) return;
  const days = getLast7DaysHours();
  if (weeklyChart && canvasId === 'weeklyChart') weeklyChart.destroy();
  if (analyticsWeeklyChart && canvasId === 'analyticsWeeklyChart') analyticsWeeklyChart.destroy();
  const chart = new Chart(ctx, {
    type: 'bar',
    data: { labels: days.map(d => d.label), datasets: [{ label: 'Hours', data: days.map(d => d.hours), backgroundColor: 'rgba(255, 107, 0, 0.8)', borderRadius: 8, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#888' } }, x: { grid: { display: false }, ticks: { color: '#888' } } } }
  });
  if (canvasId === 'weeklyChart') weeklyChart = chart; else analyticsWeeklyChart = chart;
}
function renderSkillsBarChart(canvasId) {
  const ctx = document.getElementById(canvasId); if (!ctx) return;
  const top = [...data.skills].sort((a, b) => b.progress - a.progress).slice(0, 6);
  if (skillsChart && canvasId === 'skillsChart') skillsChart.destroy();
  if (analyticsSkillsChart && canvasId === 'analyticsSkillsChart') analyticsSkillsChart.destroy();
  const chart = new Chart(ctx, {
    type: 'bar',
    data: { labels: top.map(s => s.name), datasets: [{ label: 'Progress %', data: top.map(s => s.progress), backgroundColor: 'rgba(255, 107, 0, 0.75)', borderRadius: 6 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { max: 100, beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#888' } }, y: { grid: { display: false }, ticks: { color: '#888' } } } }
  });
  if (canvasId === 'skillsChart') skillsChart = chart; else analyticsSkillsChart = chart;
}

function renderSkills() {
  const search = (document.getElementById('skillSearch')?.value || '').toLowerCase();
  const filter = document.getElementById('skillFilter')?.value || 'all';
  let list = data.skills.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search) || (s.notes || '').toLowerCase().includes(search);
    return matchSearch && (filter === 'all' || s.level === filter);
  });
  const grid = document.getElementById('skillsGrid');
  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i data-lucide="code-2"></i><p>No skills found. Add your first skill!</p><button class="btn btn-primary" onclick="openSkillModal()">Add Skill</button></div>';
    lucide.createIcons(); return;
  }
  grid.innerHTML = list.map(s => '<div class="skill-card"><div class="skill-header"><div class="skill-name">' + esc(s.name) + '</div><span class="skill-level">' + esc(s.level) + '</span></div><div class="skill-progress"><div class="progress-bar"><div class="progress-fill" style="width:' + s.progress + '%"></div></div><div class="progress-text"><span>Progress</span><span>' + s.progress + '%</span></div></div><div class="skill-meta">' + (s.targetDate ? '<span><i data-lucide="calendar"></i> ' + s.targetDate + '</span>' : '') + '</div>' + (s.notes ? '<div class="skill-notes">' + esc(s.notes) + '</div>' : '') + '<div class="skill-actions"><button class="btn-sm" onclick="openSkillModal(\'' + s.id + '\')"><i data-lucide="pencil"></i> Edit</button><button class="btn-sm" onclick="deleteSkill(\'' + s.id + '\')"><i data-lucide="trash-2"></i> Delete</button></div></div>').join('');
  lucide.createIcons();
}
function openSkillModal(id = null) {
  editingId = id; modalMode = 'skill';
  const skill = id ? data.skills.find(s => s.id === id) : null;
  document.getElementById('modalTitle').textContent = skill ? 'Edit Skill' : 'Add Skill';
  document.getElementById('modalBody').innerHTML = '<div class="form-group"><label>Skill Name *</label><input type="text" id="f-name" class="input" value="' + (skill ? esc(skill.name) : '') + '" placeholder="e.g. TypeScript" /></div><div class="form-group"><label>Proficiency Level</label><select id="f-level" class="select full">' + ['Beginner','Intermediate','Advanced','Expert'].map(l => '<option value="' + l + '" ' + (skill && skill.level === l ? 'selected' : '') + '>' + l + '</option>').join('') + '</select></div><div class="form-group"><label>Progress (0-100)%</label><input type="number" id="f-progress" class="input" min="0" max="100" value="' + (skill ? skill.progress : 0) + '" /></div><div class="form-group"><label>Target Completion Date</label><input type="date" id="f-date" class="input" value="' + (skill ? (skill.targetDate || '') : '') + '" /></div><div class="form-group"><label>Notes</label><textarea id="f-notes" class="input" placeholder="Personal notes...">' + (skill ? esc(skill.notes || '') : '') + '</textarea></div>';
  openModal();
}
function saveSkill() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { toast('Skill name is required', 'error'); return; }
  const level = document.getElementById('f-level').value;
  const progress = Math.min(100, Math.max(0, +document.getElementById('f-progress').value || 0));
  const targetDate = document.getElementById('f-date').value;
  const notes = document.getElementById('f-notes').value.trim();
  if (editingId) {
    const s = data.skills.find(x => x.id === editingId);
    if (s) { s.name = name; s.level = level; s.progress = progress; s.targetDate = targetDate; s.notes = notes; addActivity('Updated skill: ' + name); toast('Skill updated'); }
  } else {
    data.skills.push({ id: uid('s'), name, level, progress, targetDate, notes });
    addActivity('Added skill: ' + name); toast('Skill added');
  }
  save(); closeModal(); renderSkills();
  if (currentSection === 'dashboard') renderDashboard();
}
async function deleteSkill(id) {
  const s = data.skills.find(x => x.id === id); if (!s) return;
  if (!(await confirmDialog('Delete Skill', 'Delete "' + s.name + '"? This cannot be undone.'))) return;
  data.skills = data.skills.filter(x => x.id !== id);
  addActivity('Deleted skill: ' + s.name); save(); toast('Skill deleted'); renderSkills();
}

function renderCoding() {
  const search = (document.getElementById('problemSearch')?.value || '').toLowerCase();
  const platform = document.getElementById('problemPlatform')?.value || 'all';
  const difficulty = document.getElementById('problemDifficulty')?.value || 'all';
  let list = data.problems.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search) || (p.topic || '').toLowerCase().includes(search);
    return matchSearch && (platform === 'all' || p.platform === platform) && (difficulty === 'all' || p.difficulty === difficulty);
  });
  const total = data.problems.length, easy = data.problems.filter(p => p.difficulty === 'Easy').length;
  const med = data.problems.filter(p => p.difficulty === 'Medium').length, hard = data.problems.filter(p => p.difficulty === 'Hard').length;
  document.getElementById('codingStats').innerHTML = '<div class="mini-stat"><div class="val">' + total + '</div><div class="lbl">Total</div></div><div class="mini-stat"><div class="val">' + easy + '</div><div class="lbl">Easy</div></div><div class="mini-stat"><div class="val">' + med + '</div><div class="lbl">Medium</div></div><div class="mini-stat"><div class="val">' + hard + '</div><div class="lbl">Hard</div></div>';
  const tbody = document.getElementById('problemsBody');
  if (list.length === 0) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>No problems found</p></div></td></tr>'; return; }
  tbody.innerHTML = list.map(p => '<tr><td>' + (p.url ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(p.name) + '</a>' : esc(p.name)) + '</td><td>' + esc(p.platform) + '</td><td><span class="badge badge-' + p.difficulty.toLowerCase() + '">' + p.difficulty + '</span></td><td>' + esc(p.topic || '—') + '</td><td>' + (p.date || '—') + '</td><td><div class="action-btns"><button onclick="openProblemModal(\'' + p.id + '\')" title="Edit"><i data-lucide="pencil"></i></button><button class="delete" onclick="deleteProblem(\'' + p.id + '\')" title="Delete"><i data-lucide="trash-2"></i></button></div></td></tr>').join('');
  lucide.createIcons();
}
function openProblemModal(id = null) {
  editingId = id; modalMode = 'problem';
  const p = id ? data.problems.find(x => x.id === id) : null;
  document.getElementById('modalTitle').textContent = p ? 'Edit Problem' : 'Add Problem';
  document.getElementById('modalBody').innerHTML = '<div class="form-group"><label>Problem Name *</label><input type="text" id="f-name" class="input" value="' + (p ? esc(p.name) : '') + '" /></div><div class="form-group"><label>URL</label><input type="url" id="f-url" class="input" value="' + (p ? esc(p.url || '') : '') + '" /></div><div class="form-group"><label>Platform</label><select id="f-platform" class="select full">' + ['LeetCode','HackerRank','CodeChef','GFG','Other'].map(x => '<option value="' + x + '" ' + (p && p.platform === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select></div><div class="form-group"><label>Difficulty</label><select id="f-difficulty" class="select full">' + ['Easy','Medium','Hard'].map(x => '<option value="' + x + '" ' + (p && p.difficulty === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select></div><div class="form-group"><label>Topic</label><input type="text" id="f-topic" class="input" value="' + (p ? esc(p.topic || '') : '') + '" /></div><div class="form-group"><label>Completion Date</label><input type="date" id="f-date" class="input" value="' + (p ? (p.date || '') : todayStr()) + '" /></div>';
  openModal();
}
function saveProblem() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { toast('Problem name is required', 'error'); return; }
  const url = document.getElementById('f-url').value.trim(), platform = document.getElementById('f-platform').value;
  const difficulty = document.getElementById('f-difficulty').value, topic = document.getElementById('f-topic').value.trim();
  const date = document.getElementById('f-date').value || todayStr();
  if (editingId) {
    const p = data.problems.find(x => x.id === editingId);
    if (p) { Object.assign(p, { name, url, platform, difficulty, topic, date }); addActivity('Updated problem: ' + name); toast('Problem updated'); }
  } else {
    data.problems.unshift({ id: uid('p'), name, url, platform, difficulty, topic, date });
    addActivity('Solved: ' + name + ' (' + difficulty + ')'); toast('Problem added');
  }
  save(); closeModal(); renderCoding();
}
async function deleteProblem(id) {
  const p = data.problems.find(x => x.id === id); if (!p) return;
  if (!(await confirmDialog('Delete Problem', 'Delete "' + p.name + '"?'))) return;
  data.problems = data.problems.filter(x => x.id !== id); save(); toast('Problem deleted'); renderCoding();
}

function renderTimer() {
  const sel = document.getElementById('timerSkill');
  const current = sel.value;
  sel.innerHTML = '<option value="">Select a skill...</option>' + data.skills.map(s => '<option value="' + s.id + '">' + esc(s.name) + '</option>').join('');
  if (current) sel.value = current;
  const today = todayStr();
  const todaySecs = data.sessions.filter(s => s.date === today).reduce((a, s) => a + s.duration, 0);
  document.getElementById('todayHours').textContent = formatDuration(todaySecs);
  const weekSecs = getLast7DaysHours().reduce((a, d) => a + d.hours * 3600, 0);
  document.getElementById('weekHours').textContent = formatDuration(Math.round(weekSecs));
  const totalSecs = data.sessions.reduce((a, s) => a + s.duration, 0);
  document.getElementById('totalHours').textContent = formatDuration(totalSecs);
  const list = document.getElementById('sessionsList');
  const recent = [...data.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  list.innerHTML = recent.length === 0 ? '<div class="empty-state"><p>No sessions yet</p></div>' :
    recent.map(s => '<div class="list-item"><div class="dot"></div><div class="text">' + esc(s.skillName || 'General') + '</div><div class="time">' + formatDuration(s.duration) + '</div></div>').join('');
  updateTimerButtons();
}
function updateTimerButtons() {
  document.getElementById('timerStart').disabled = timerRunning && !timerPaused;
  document.getElementById('timerPause').disabled = !timerRunning || timerPaused;
  document.getElementById('saveSessionBtn').disabled = timerSeconds < 60;
  document.getElementById('timerDisplay').textContent = formatTimer(timerSeconds);
}
function startTimer() {
  if (timerRunning && !timerPaused) return;
  timerRunning = true; timerPaused = false;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => { timerSeconds++; document.getElementById('timerDisplay').textContent = formatTimer(timerSeconds); if (timerSeconds % 60 === 0) updateTimerButtons(); }, 1000);
  updateTimerButtons(); toast('Timer started', 'info');
}
function pauseTimer() {
  if (!timerRunning || timerPaused) return;
  timerPaused = true; clearInterval(timerInterval); timerInterval = null; updateTimerButtons(); toast('Timer paused', 'info');
}
function resetTimer() {
  clearInterval(timerInterval); timerInterval = null; timerSeconds = 0; timerRunning = false; timerPaused = false; updateTimerButtons();
}
function saveSession() {
  if (timerSeconds < 60) { toast('Session must be at least 1 minute', 'error'); return; }
  const skillId = document.getElementById('timerSkill').value;
  const skill = data.skills.find(s => s.id === skillId);
  data.sessions.push({ id: uid('ss'), skillId: skillId || null, skillName: skill ? skill.name : 'General', duration: timerSeconds, date: todayStr() });
  addActivity('Studied ' + (skill ? skill.name : 'General') + ' for ' + formatDuration(timerSeconds));
  save(); toast('Session saved: ' + formatDuration(timerSeconds)); resetTimer(); renderTimer();
  if (currentSection === 'dashboard') renderDashboard();
}

function renderGoals() {
  const search = (document.getElementById('goalSearch')?.value || '').toLowerCase();
  const filter = document.getElementById('goalFilter')?.value || 'all';
  const today = todayStr();
  let list = data.goals.filter(g => {
    const matchSearch = g.title.toLowerCase().includes(search);
    let matchStatus = true;
    if (filter === 'active') matchStatus = !g.completed;
    if (filter === 'completed') matchStatus = g.completed;
    if (filter === 'overdue') matchStatus = !g.completed && g.deadline && g.deadline < today;
    return matchSearch && matchStatus;
  });
  const grid = document.getElementById('goalsGrid');
  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i data-lucide="target"></i><p>No goals yet. Set your first target!</p><button class="btn btn-primary" onclick="openGoalModal()">Add Goal</button></div>';
    lucide.createIcons(); return;
  }
  grid.innerHTML = list.map(g => {
    const pct = g.targetHours > 0 ? Math.min(100, Math.round((g.progress / g.targetHours) * 100)) : 0;
    const isOverdue = !g.completed && g.deadline && g.deadline < today;
    return '<div class="goal-card ' + (g.completed ? 'completed' : '') + ' ' + (isOverdue ? 'overdue' : '') + '"><div class="goal-title">' + esc(g.title) + (g.completed ? ' ✓' : '') + '</div><div class="goal-meta">' + (g.deadline ? '<span><i data-lucide="calendar"></i> ' + g.deadline + '</span>' : '') + '<span><i data-lucide="clock"></i> ' + g.progress + '/' + g.targetHours + 'h</span>' + (isOverdue ? '<span style="color:#ef4444">Overdue</span>' : '') + '</div><div class="goal-progress"><div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div><div class="progress-text"><span>Progress</span><span>' + pct + '%</span></div></div><div class="goal-actions">' + (!g.completed ? '<button class="btn-sm" onclick="completeGoal(\'' + g.id + '\')"><i data-lucide="check"></i> Complete</button>' : '') + '<button class="btn-sm" onclick="openGoalModal(\'' + g.id + '\')"><i data-lucide="pencil"></i> Edit</button><button class="btn-sm" onclick="deleteGoal(\'' + g.id + '\')"><i data-lucide="trash-2"></i></button></div></div>';
  }).join('');
  lucide.createIcons();
}
function openGoalModal(id = null) {
  editingId = id; modalMode = 'goal';
  const g = id ? data.goals.find(x => x.id === id) : null;
  document.getElementById('modalTitle').textContent = g ? 'Edit Goal' : 'Add Goal';
  document.getElementById('modalBody').innerHTML = '<div class="form-group"><label>Goal Title *</label><input type="text" id="f-title" class="input" value="' + (g ? esc(g.title) : '') + '" /></div><div class="form-group"><label>Deadline</label><input type="date" id="f-deadline" class="input" value="' + (g ? (g.deadline || '') : '') + '" /></div><div class="form-group"><label>Target Hours</label><input type="number" id="f-target" class="input" min="1" value="' + (g ? g.targetHours : 10) + '" /></div><div class="form-group"><label>Current Progress (hours)</label><input type="number" id="f-progress" class="input" min="0" step="0.5" value="' + (g ? g.progress : 0) + '" /></div>';
  openModal();
}
function saveGoal() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { toast('Goal title is required', 'error'); return; }
  const deadline = document.getElementById('f-deadline').value;
  const targetHours = +document.getElementById('f-target').value || 10;
  const progress = +document.getElementById('f-progress').value || 0;
  if (editingId) {
    const g = data.goals.find(x => x.id === editingId);
    if (g) { g.title = title; g.deadline = deadline; g.targetHours = targetHours; g.progress = progress; if (progress >= targetHours) g.completed = true; addActivity('Updated goal: ' + title); toast('Goal updated'); }
  } else {
    data.goals.push({ id: uid('g'), title, deadline, targetHours, progress, completed: progress >= targetHours });
    addActivity('Added goal: ' + title); toast('Goal added');
  }
  save(); closeModal(); renderGoals();
}
function completeGoal(id) {
  const g = data.goals.find(x => x.id === id); if (!g) return;
  g.completed = true; g.progress = Math.max(g.progress, g.targetHours);
  addActivity('Completed goal: ' + g.title); save(); toast('Goal completed! 🎉'); renderGoals();
}
async function deleteGoal(id) {
  const g = data.goals.find(x => x.id === id); if (!g) return;
  if (!(await confirmDialog('Delete Goal', 'Delete "' + g.title + '"?'))) return;
  data.goals = data.goals.filter(x => x.id !== id); save(); toast('Goal deleted'); renderGoals();
}

function renderProjects() {
  const search = (document.getElementById('projectSearch')?.value || '').toLowerCase();
  const status = document.getElementById('projectStatusFilter')?.value || 'all';
  let list = data.projects.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search) || (p.description || '').toLowerCase().includes(search);
    return matchSearch && (status === 'all' || p.status === status);
  });
  const grid = document.getElementById('projectsGrid');
  if (list.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i data-lucide="folder-kanban"></i><p>No projects yet</p><button class="btn btn-primary" onclick="openProjectModal()">Add Project</button></div>';
    lucide.createIcons(); return;
  }
  const statusClass = { 'Planning': 'status-planning', 'In Progress': 'status-progress', 'Completed': 'status-completed' };
  grid.innerHTML = list.map(p => '<div class="project-card"><span class="project-status ' + (statusClass[p.status] || '') + '">' + esc(p.status) + '</span><div class="project-title">' + esc(p.title) + '</div><div class="project-desc">' + esc(p.description || '') + '</div><div class="project-stack">' + (p.tech || []).map(t => '<span class="tech-tag">' + esc(t) + '</span>').join('') + '</div><div class="project-links">' + (p.github ? '<a href="' + esc(p.github) + '" target="_blank"><i data-lucide="github"></i> GitHub</a>' : '') + (p.live ? '<a href="' + esc(p.live) + '" target="_blank"><i data-lucide="external-link"></i> Live</a>' : '') + '</div><div class="project-actions"><button class="btn-sm" onclick="openProjectModal(\'' + p.id + '\')"><i data-lucide="pencil"></i> Edit</button><button class="btn-sm" onclick="deleteProject(\'' + p.id + '\')"><i data-lucide="trash-2"></i></button></div></div>').join('');
  lucide.createIcons();
}
function openProjectModal(id = null) {
  editingId = id; modalMode = 'project';
  const p = id ? data.projects.find(x => x.id === id) : null;
  document.getElementById('modalTitle').textContent = p ? 'Edit Project' : 'Add Project';
  document.getElementById('modalBody').innerHTML = '<div class="form-group"><label>Project Title *</label><input type="text" id="f-title" class="input" value="' + (p ? esc(p.title) : '') + '" /></div><div class="form-group"><label>Description</label><textarea id="f-desc" class="input">' + (p ? esc(p.description || '') : '') + '</textarea></div><div class="form-group"><label>Tech Stack (comma separated)</label><input type="text" id="f-tech" class="input" value="' + (p ? (p.tech || []).join(', ') : '') + '" /></div><div class="form-group"><label>GitHub URL</label><input type="url" id="f-github" class="input" value="' + (p ? esc(p.github || '') : '') + '" /></div><div class="form-group"><label>Live URL</label><input type="url" id="f-live" class="input" value="' + (p ? esc(p.live || '') : '') + '" /></div><div class="form-group"><label>Status</label><select id="f-status" class="select full">' + ['Planning','In Progress','Completed'].map(s => '<option value="' + s + '" ' + (p && p.status === s ? 'selected' : '') + '>' + s + '</option>').join('') + '</select></div>';
  openModal();
}
function saveProject() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { toast('Title is required', 'error'); return; }
  const description = document.getElementById('f-desc').value.trim();
  const tech = document.getElementById('f-tech').value.split(',').map(t => t.trim()).filter(Boolean);
  const github = document.getElementById('f-github').value.trim(), live = document.getElementById('f-live').value.trim();
  const status = document.getElementById('f-status').value;
  if (editingId) {
    const p = data.projects.find(x => x.id === editingId);
    if (p) { Object.assign(p, { title, description, tech, github, live, status }); addActivity('Updated project: ' + title); toast('Project updated'); }
  } else {
    data.projects.push({ id: uid('pr'), title, description, tech, github, live, status });
    addActivity('Added project: ' + title); toast('Project added');
  }
  save(); closeModal(); renderProjects();
}
async function deleteProject(id) {
  const p = data.projects.find(x => x.id === id); if (!p) return;
  if (!(await confirmDialog('Delete Project', 'Delete "' + p.title + '"?'))) return;
  data.projects = data.projects.filter(x => x.id !== id); save(); toast('Project deleted'); renderProjects();
}

function renderAnalytics() {
  renderWeeklyChart('analyticsWeeklyChart'); renderSkillsBarChart('analyticsSkillsChart');
  const ctx = document.getElementById('difficultyChart');
  if (ctx) {
    if (difficultyChart) difficultyChart.destroy();
    const easy = data.problems.filter(p => p.difficulty === 'Easy').length;
    const med = data.problems.filter(p => p.difficulty === 'Medium').length;
    const hard = data.problems.filter(p => p.difficulty === 'Hard').length;
    difficultyChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: ['Easy', 'Medium', 'Hard'], datasets: [{ data: [easy, med, hard], backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
  }
  const totalHours = data.sessions.reduce((a, s) => a + s.duration, 0) / 3600;
  const completedGoals = data.goals.filter(g => g.completed).length;
  const goalPct = data.goals.length ? Math.round((completedGoals / data.goals.length) * 100) : 0;
  const avgSkill = data.skills.length ? Math.round(data.skills.reduce((a, s) => a + s.progress, 0) / data.skills.length) : 0;
  document.getElementById('metricsList').innerHTML = '<div class="metric-item"><span class="metric-label">Total Learning Hours</span><span class="metric-value">' + totalHours.toFixed(1) + 'h</span></div><div class="metric-item"><span class="metric-label">Problems Solved</span><span class="metric-value">' + data.problems.length + '</span></div><div class="metric-item"><span class="metric-label">Active Skills</span><span class="metric-value">' + data.skills.length + '</span></div><div class="metric-item"><span class="metric-label">Avg Skill Progress</span><span class="metric-value">' + avgSkill + '%</span></div><div class="metric-item"><span class="metric-label">Goals Completed</span><span class="metric-value">' + completedGoals + '/' + data.goals.length + '</span></div><div class="metric-item"><span class="metric-label">Goal Completion Rate</span><span class="metric-value">' + goalPct + '%</span></div><div class="metric-item"><span class="metric-label">Current Streak</span><span class="metric-value">' + calcStreak() + ' days</span></div><div class="metric-item"><span class="metric-label">Projects</span><span class="metric-value">' + data.projects.length + '</span></div>';
  const heat = document.getElementById('heatmap');
  const dayMap = {};
  data.sessions.forEach(s => { dayMap[s.date] = (dayMap[s.date] || 0) + s.duration; });
  let html = '';
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const secs = dayMap[key] || 0;
    let level = '';
    if (secs > 0) level = 'l1'; if (secs >= 1800) level = 'l2'; if (secs >= 3600) level = 'l3'; if (secs >= 7200) level = 'l4';
    html += '<div class="heat-cell ' + level + '" title="' + key + ': ' + formatDuration(secs) + '"></div>';
  }
  heat.innerHTML = html;
}

function renderSettings() {
  document.getElementById('profileName').value = data.profile.name;
  document.getElementById('profileAvatar').value = data.profile.avatar;
  document.getElementById('dailyTarget').value = data.profile.dailyTarget;
  document.querySelectorAll('.theme-option').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === data.theme));
}
function saveProfile() {
  const name = document.getElementById('profileName').value.trim() || 'User';
  const avatar = (document.getElementById('profileAvatar').value.trim() || name[0]).slice(0, 2).toUpperCase();
  const dailyTarget = +document.getElementById('dailyTarget').value || 2;
  data.profile = { name, avatar, dailyTarget }; save(); updateProfileUI(); toast('Profile saved');
}
function updateProfileUI() {
  document.getElementById('sidebarName').textContent = data.profile.name;
  document.getElementById('sidebarAvatar').textContent = data.profile.avatar;
  document.getElementById('welcomeName').textContent = data.profile.name;
}
function setTheme(theme) {
  data.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  save();
  const icon = document.getElementById('themeIcon');
  if (icon) { icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon'); lucide.createIcons(); }
  document.querySelectorAll('.theme-option').forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
  if (currentSection === 'dashboard' || currentSection === 'analytics') renderCurrentSection();
}
function exportJSON() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'skilltrack-export-' + todayStr() + '.json'; a.click(); toast('JSON exported');
}
function exportCSV() {
  let csv = 'Type,Name,Details,Progress,Date\n';
  data.skills.forEach(s => { csv += 'Skill,"' + s.name + '","' + s.level + '",' + s.progress + ',' + (s.targetDate || '') + '\n'; });
  data.problems.forEach(p => { csv += 'Problem,"' + p.name + '","' + p.platform + ' - ' + p.difficulty + '",,' + (p.date || '') + '\n'; });
  data.goals.forEach(g => { csv += 'Goal,"' + g.title + '","' + g.progress + '/' + g.targetHours + 'h",' + (g.completed ? 100 : 0) + ',' + (g.deadline || '') + '\n'; });
  data.projects.forEach(p => { csv += 'Project,"' + p.title + '","' + p.status + '",,' + (p.tech || []).join(';') + '\n'; });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'skilltrack-export-' + todayStr() + '.csv'; a.click(); toast('CSV exported');
}
async function resetData() {
  if (!(await confirmDialog('Reset All Data', 'This will permanently delete ALL your data and restore defaults. Are you sure?'))) return;
  data = structuredClone(defaultData); save(); updateProfileUI(); setTheme('light'); toast('Data reset to defaults'); navigate('dashboard');
}

function openModal() { document.getElementById('modalOverlay').classList.add('open'); lucide.createIcons(); }
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); editingId = null; modalMode = null; }
function handleModalSave() {
  if (modalMode === 'skill') saveSkill();
  else if (modalMode === 'problem') saveProblem();
  else if (modalMode === 'goal') saveGoal();
  else if (modalMode === 'project') saveProject();
}

function init() {
  load();
  document.documentElement.setAttribute('data-theme', data.theme);
  updateProfileUI();
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.section)));
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div'); backdrop.className = 'sidebar-backdrop'; document.body.appendChild(backdrop);
      backdrop.addEventListener('click', () => { document.getElementById('sidebar').classList.remove('open'); backdrop.classList.remove('show'); });
    }
    backdrop.classList.add('show');
  });
  document.getElementById('sidebarClose').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.querySelector('.sidebar-backdrop')?.classList.remove('show');
  });
  document.getElementById('themeToggle').addEventListener('click', () => setTheme(data.theme === 'dark' ? 'light' : 'dark'));
  document.querySelectorAll('[data-goto]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.goto)));
  document.getElementById('addSkillBtn').addEventListener('click', () => openSkillModal());
  document.getElementById('skillSearch').addEventListener('input', renderSkills);
  document.getElementById('skillFilter').addEventListener('change', renderSkills);
  document.getElementById('addProblemBtn').addEventListener('click', () => openProblemModal());
  document.getElementById('problemSearch').addEventListener('input', renderCoding);
  document.getElementById('problemPlatform').addEventListener('change', renderCoding);
  document.getElementById('problemDifficulty').addEventListener('change', renderCoding);
  document.getElementById('timerStart').addEventListener('click', startTimer);
  document.getElementById('timerPause').addEventListener('click', pauseTimer);
  document.getElementById('timerReset').addEventListener('click', () => { resetTimer(); toast('Timer reset', 'info'); });
  document.getElementById('saveSessionBtn').addEventListener('click', saveSession);
  document.getElementById('addGoalBtn').addEventListener('click', () => openGoalModal());
  document.getElementById('goalSearch').addEventListener('input', renderGoals);
  document.getElementById('goalFilter').addEventListener('change', renderGoals);
  document.getElementById('addProjectBtn').addEventListener('click', () => openProjectModal());
  document.getElementById('projectSearch').addEventListener('input', renderProjects);
  document.getElementById('projectStatusFilter').addEventListener('change', renderProjects);
  document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
  document.querySelectorAll('.theme-option').forEach(btn => btn.addEventListener('click', () => setTheme(btn.dataset.theme)));
  document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
  document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
  document.getElementById('resetDataBtn').addEventListener('click', resetData);
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalSave').addEventListener('click', handleModalSave);
  document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === document.getElementById('modalOverlay')) closeModal(); });
  setTheme(data.theme); navigate('dashboard'); lucide.createIcons();
}

window.openSkillModal = openSkillModal; window.deleteSkill = deleteSkill;
window.openProblemModal = openProblemModal; window.deleteProblem = deleteProblem;
window.openGoalModal = openGoalModal; window.deleteGoal = deleteGoal; window.completeGoal = completeGoal;
window.openProjectModal = openProjectModal; window.deleteProject = deleteProject;

document.addEventListener('DOMContentLoaded', init);
