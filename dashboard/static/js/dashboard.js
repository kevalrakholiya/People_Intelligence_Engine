/* ── State ───────────────────────────────────────────────────────────────── */
const state = {
  activeTab: 'executive',
  riskLevelFilter: '',
  searchQuery: '',
  currentPage: 1,
  perPage: 50,
  charts: {},
  sortCols: [{ col: 'risk_score', dir: 'desc' }],
};

/* ── Dept → Roles cascade map (populated on load) ───────────────────────── */
let deptRolesMap = {};
let allRoles     = [];

/* ── Colour tokens ───────────────────────────────────────────────────────── */
const RISK_COLORS = {
  'Very High': '#dc2626',
  'High':      '#ea580c',
  'Moderate':  '#d97706',
  'Low':       '#16a34a',
  'Very Low':  '#2563eb',
};
const RISK_PILL_CLASS = {
  'Very High': 'rp-vh', 'High': 'rp-h', 'Moderate': 'rp-m',
  'Low': 'rp-l', 'Very Low': 'rp-vl',
};
const PALETTE = ['#4f46e5','#7c3aed','#0891b2','#16a34a','#ea580c','#ec4899','#0d9488','#d97706'];

/* ── Chart.js defaults ───────────────────────────────────────────────────── */
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";

const CHART_OPT = {
  plugins: {
    legend: { labels: { color: '#475569', font: { size: 12 }, boxWidth: 12, padding: 14 } },
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      titleColor: '#0f172a',
      bodyColor: '#475569',
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,.04)' } },
    y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,.04)' } },
  },
};

/* ── Boot ────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  showLoading();
  await loadFilterOptions();
  document.getElementById('last-updated').textContent =
    'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  await Promise.all([loadKPIs(), loadAllCharts()]);
  loadKeyInsights();
  loadAttritionByRole();
  hideLoading();
  loadRiskSummary();
  loadEmployees();
  initSortHeaders();
});

/* ── Tab switching ───────────────────────────────────────────────────────── */
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-pill').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  // Always start each tab at the top
  const mc = document.querySelector('.main-content');
  if (mc) mc.scrollTop = 0;
  if (tab === 'employees') { loadRiskSummary(); loadEmployees(); }
  if (tab === 'predictive') loadPredictiveTab();
}

/* ── Sidebar Toggle (works on both desktop and mobile) ───────────────────── */
function toggleSidebar() {
  const sidebar = document.getElementById('filterSidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (window.innerWidth > 900) {
    // Desktop: collapse/expand the flex-item sidebar
    sidebar.classList.toggle('collapsed');
  } else {
    // Mobile: slide in/out fixed-position sidebar
    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('show', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }
}

/* ── Loading ─────────────────────────────────────────────────────────────── */
function showLoading(msg) {
  const sub = document.getElementById('loading-sub');
  if (sub) sub.textContent = msg || 'Loading analytics…';
  document.getElementById('loading').classList.add('show');
}
function hideLoading() { document.getElementById('loading').classList.remove('show'); }

/* ── Filters ─────────────────────────────────────────────────────────────── */
function getParams(includeSortCols = false) {
  const p = new URLSearchParams();
  const dept    = document.getElementById('f-department').value;
  const gender  = document.getElementById('f-gender').value;
  const role    = document.getElementById('f-jobrole').value;
  const marital = document.getElementById('f-marital').value;
  const ot      = document.getElementById('f-overtime').value;
  const ageMin  = document.getElementById('f-age-min').value;
  const ageMax  = document.getElementById('f-age-max').value;

  if (dept)    p.set('department',     dept);
  if (gender)  p.set('gender',         gender);
  if (role)    p.set('job_role',       role);
  if (marital) p.set('marital_status', marital);
  if (ot)      p.set('overtime',       ot);
  p.set('age_min', ageMin);
  p.set('age_max', ageMax);

  if (includeSortCols && state.sortCols.length) {
    p.set('sort', state.sortCols.map(s => s.col).join(','));
    p.set('dirs', state.sortCols.map(s => s.dir).join(','));
  }

  return p;
}

async function applyFilters() {
  state.currentPage = 1;
  await Promise.all([loadKPIs(), loadAllCharts()]);
  loadKeyInsights();
  loadAttritionByRole();
  if (state.activeTab === 'employees') { loadRiskSummary(); loadEmployees(); }
  const total = document.getElementById('kpi-total').textContent;
  document.getElementById('filter-count').textContent = total + ' employees';
}

function resetFilters() {
  ['f-gender','f-marital','f-overtime'].forEach(id =>
    document.getElementById(id).value = '');
  document.getElementById('f-department').value = '';
  // Reset job role cascade to all roles
  updateJobRoleOptions('f-department', 'f-jobrole', 'All Roles');
  document.getElementById('f-jobrole').value = '';
  document.getElementById('f-age-min').value = '18';
  document.getElementById('f-age-max').value = '60';
  updateAgeLabel();
  applyFilters();
}

function updateAgeLabel() {
  const min = document.getElementById('f-age-min').value;
  const max = document.getElementById('f-age-max').value;
  document.getElementById('age-range-label').textContent = `${min} – ${max}`;
}

async function loadFilterOptions() {
  const [d, rolesMap] = await Promise.all([
    fetch('/api/filter-options').then(r => r.json()),
    fetch('/api/department-roles').then(r => r.json()),
  ]);

  deptRolesMap = rolesMap;
  allRoles     = d.job_roles;

  const populate = (id, items) => {
    const el = document.getElementById(id);
    items.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v; el.appendChild(o);
    });
  };
  populate('f-department', d.departments);
  populate('f-gender',     d.genders);
  populate('f-jobrole',    d.job_roles);
  populate('f-marital',    d.marital_statuses);

  // Populate predictor form department from actual dataset values
  const predDept = document.getElementById('pred-department');
  d.departments.forEach(dept => {
    const o = document.createElement('option');
    o.value = dept; o.textContent = dept; predDept.appendChild(o);
  });
  // Populate predictor job role for the first department
  updateJobRoleOptions('pred-department', 'pred-jobrole', null);
}

/* ── Cascade filter helpers ──────────────────────────────────────────────── */
function updateJobRoleOptions(deptSelectId, roleSelectId, defaultText) {
  const dept = document.getElementById(deptSelectId).value;
  const roleSelect = document.getElementById(roleSelectId);
  const currentVal = roleSelect.value;

  roleSelect.innerHTML = '';
  if (defaultText !== null && defaultText !== undefined) {
    const allOpt = document.createElement('option');
    allOpt.value = ''; allOpt.textContent = defaultText;
    roleSelect.appendChild(allOpt);
  }

  const roles = dept ? (deptRolesMap[dept] || allRoles) : allRoles;
  roles.forEach(r => {
    const o = document.createElement('option');
    o.value = r; o.textContent = r; roleSelect.appendChild(o);
  });

  // Restore previous selection if it still exists
  if (roles.includes(currentVal)) roleSelect.value = currentVal;
  else if (!defaultText) roleSelect.value = roles[0] || '';
}

function onSidebarDeptChange() {
  updateJobRoleOptions('f-department', 'f-jobrole', 'All Roles');
  applyFilters();
}

function onPredDeptChange() {
  updateJobRoleOptions('pred-department', 'pred-jobrole', null);
}

/* ── KPIs ────────────────────────────────────────────────────────────────── */
async function loadKPIs() {
  const d = await fetch(`/api/kpis?${getParams()}`).then(r => r.json());
  setText('kpi-total',    d.total_employees.toLocaleString());
  setText('kpi-rate',     d.attrition_rate.toFixed(1) + '%');
  setText('kpi-active',   d.active_employees.toLocaleString());
  setText('kpi-highrisk', d.high_risk_count.toLocaleString());
  setText('kpi-income',   '$' + d.avg_monthly_income.toLocaleString());
  setText('kpi-age',      d.avg_age.toFixed(1));
  setText('kpi-left',     d.attrition_count.toLocaleString());
  setText('kpi-tenure',   (d.avg_tenure || 0).toFixed(1));
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── Key Insights ────────────────────────────────────────────────────────── */
async function loadKeyInsights() {
  const prosList = document.getElementById('insights-pros');
  const consList = document.getElementById('insights-cons');
  const skelLi = '<li class="insight-skeleton-li"></li>';
  if (prosList) prosList.innerHTML = skelLi.repeat(3);
  if (consList) consList.innerHTML = skelLi.repeat(3);

  const d = await fetch(`/api/key-insights?${getParams()}`).then(r => r.json());

  const renderList = (el, items) => {
    if (!el) return;
    el.innerHTML = '';
    if (!items || !items.length) {
      el.innerHTML = '<li style="color:var(--text3);font-size:13px">No data available.</li>';
      return;
    }
    items.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      el.appendChild(li);
    });
  };

  renderList(prosList, d.pros);
  renderList(consList, d.cons);
}

/* ── Attrition by Role Table ─────────────────────────────────────────────── */
async function loadAttritionByRole() {
  const tbody = document.getElementById('role-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Loading…</td></tr>';

  const rows = await fetch(`/api/attrition-by-role?${getParams()}`).then(r => r.json());
  tbody.innerHTML = '';

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No data for current filters.</td></tr>';
    return;
  }

  rows.forEach(r => {
    const rate = r.rate;
    const rateCls = rate >= 20 ? 'rate-high' : rate >= 12 ? 'rate-med' : 'rate-low';
    const riskColor = rate >= 20 ? '#dc2626' : rate >= 12 ? '#d97706' : '#16a34a';
    const avgRisk = r.avg_risk_pct || 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color:var(--text1)">${escHtml(r.job_role)}</strong></td>
      <td class="num">${r.total.toLocaleString()}</td>
      <td class="num">${r.attrition.toLocaleString()}</td>
      <td class="num"><span class="rate-pill ${rateCls}">${rate.toFixed(1)}%</span></td>
      <td class="num">$${Math.round(r.avg_income).toLocaleString()}</td>
      <td class="num">${r.avg_tenure.toFixed(1)} yrs</td>
      <td class="num">
        <div class="risk-bar-wrap">
          <div class="risk-bar-bg"><div class="risk-bar-fill" style="width:${avgRisk}%;background:${riskColor}"></div></div>
          <span style="font-size:11.5px;font-weight:700;color:${riskColor}">${avgRisk.toFixed(1)}%</span>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ── All charts ──────────────────────────────────────────────────────────── */
async function loadAllCharts() {
  const p = getParams();
  const [ov, dept, age, ot, sat, mar, inc, rd, imp, travel, edu, joblvl] = await Promise.all([
    fetch(`/api/charts/attrition-overview?${p}`).then(r => r.json()),
    fetch(`/api/charts/attrition-by-department?${p}`).then(r => r.json()),
    fetch(`/api/charts/age-distribution?${p}`).then(r => r.json()),
    fetch(`/api/charts/overtime-impact?${p}`).then(r => r.json()),
    fetch(`/api/charts/job-satisfaction?${p}`).then(r => r.json()),
    fetch(`/api/charts/marital-attrition?${p}`).then(r => r.json()),
    fetch(`/api/charts/income-by-attrition?${p}`).then(r => r.json()),
    fetch(`/api/charts/risk-distribution?${p}`).then(r => r.json()),
    fetch('/api/feature-importance').then(r => r.json()),
    fetch(`/api/charts/business-travel?${p}`).then(r => r.json()),
    fetch(`/api/charts/education-level?${p}`).then(r => r.json()),
    fetch(`/api/charts/job-level?${p}`).then(r => r.json()),
  ]);

  renderOverview(ov);
  renderDept(dept);
  renderAge(age);
  renderOvertime(ot);
  renderSatisfaction(sat);
  renderMarital(mar);
  renderIncome(inc);
  renderRiskDist(rd);
  renderImportance('chart-importance-exec', imp);
  renderBusinessTravel(travel);
  renderEducation(edu);
  renderJobLevel(joblvl);
}

/* ── Chart helper ────────────────────────────────────────────────────────── */
function mkChart(id, config) {
  if (state.charts[id]) state.charts[id].destroy();
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  state.charts[id] = new Chart(canvas.getContext('2d'), config);
  return state.charts[id];
}

/* Attrition donut */
function renderOverview(d) {
  mkChart('chart-overview', {
    type: 'doughnut',
    data: {
      labels: ['Active', 'Left'],
      datasets: [{ data: [d.No, d.Yes], backgroundColor: ['#16a34a','#dc2626'], borderColor: '#fff', borderWidth: 3, hoverOffset: 6 }],
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: { ...CHART_OPT.plugins, legend: { position: 'bottom', labels: { color: '#475569', font: { size: 12 }, boxWidth: 12, padding: 16 } } } },
  });
}

/* Dept bar */
function renderDept(d) {
  const labels = Object.keys(d);
  mkChart('chart-dept', {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Active', data: labels.map(l => d[l].active),    backgroundColor: '#16a34a', borderRadius: 5 },
      { label: 'Left',   data: labels.map(l => d[l].attrition), backgroundColor: '#dc2626', borderRadius: 5 },
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: CHART_OPT.plugins, scales: CHART_OPT.scales },
  });
}

/* Age histogram */
function renderAge(d) {
  mkChart('chart-age', {
    type: 'bar',
    data: { labels: d.labels, datasets: [
      { label: 'Retained', data: d.retained,  backgroundColor: 'rgba(22,163,74,.7)',  borderRadius: 3 },
      { label: 'Left',     data: d.attrition, backgroundColor: 'rgba(220,38,38,.7)', borderRadius: 3 },
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: CHART_OPT.plugins,
      scales: { x: { ...CHART_OPT.scales.x, stacked: true }, y: { ...CHART_OPT.scales.y, stacked: true } } },
  });
}

/* Overtime */
function renderOvertime(d) {
  const labels = Object.keys(d);
  mkChart('chart-overtime', {
    type: 'bar',
    data: { labels: labels.map(l => l === 'Yes' ? 'With Overtime' : 'No Overtime'), datasets: [
      { label: 'Retained', data: labels.map(l => d[l].retained),  backgroundColor: 'rgba(79,70,229,.75)',  borderRadius: 5 },
      { label: 'Left',     data: labels.map(l => d[l].attrition), backgroundColor: 'rgba(220,38,38,.75)', borderRadius: 5 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false, plugins: {
        ...CHART_OPT.plugins,
        tooltip: { ...CHART_OPT.plugins.tooltip,
          callbacks: { afterBody: ctx => `Attrition Rate: ${d[Object.keys(d)[ctx[0].dataIndex]].rate}%` } } },
      scales: CHART_OPT.scales,
    },
  });
}

/* Job satisfaction */
function renderSatisfaction(d) {
  const roles = Object.keys(d).sort((a,b) => d[b].avg_satisfaction - d[a].avg_satisfaction);
  mkChart('chart-satisfaction', {
    type: 'bar',
    data: { labels: roles, datasets: [{
      label: 'Avg Satisfaction (1–4)',
      data: roles.map(r => d[r].avg_satisfaction),
      backgroundColor: roles.map((_,i) => PALETTE[i % PALETTE.length]),
      borderRadius: 4,
    }]},
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { ...CHART_OPT.plugins,
        tooltip: { ...CHART_OPT.plugins.tooltip,
          callbacks: { afterBody: ctx => `Attrition Rate: ${d[roles[ctx[0].dataIndex]].attrition_rate}%` } } },
      scales: { x: { ...CHART_OPT.scales.x, min: 0, max: 4 }, y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } } },
    },
  });
}

/* Marital status */
function renderMarital(d) {
  const labels = Object.keys(d);
  mkChart('chart-marital', {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Retained', data: labels.map(l => d[l].retained),  backgroundColor: 'rgba(8,145,178,.75)',  borderRadius: 5 },
      { label: 'Left',     data: labels.map(l => d[l].attrition), backgroundColor: 'rgba(220,38,38,.75)', borderRadius: 5 },
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: CHART_OPT.plugins, scales: CHART_OPT.scales },
  });
}

/* Income */
function renderIncome(d) {
  const labels = Object.keys(d);
  mkChart('chart-income', {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Avg Income — Retained', data: labels.map(l => d[l].no_avg),  backgroundColor: 'rgba(22,163,74,.75)',  borderRadius: 5 },
      { label: 'Avg Income — Left',     data: labels.map(l => d[l].yes_avg), backgroundColor: 'rgba(220,38,38,.75)', borderRadius: 5 },
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: CHART_OPT.plugins,
      scales: { ...CHART_OPT.scales, y: { ...CHART_OPT.scales.y, ticks: { ...CHART_OPT.scales.y.ticks, callback: v => '$'+v.toLocaleString() } } } },
  });
}

/* Risk distribution stacked */
function renderRiskDist(d) {
  const depts  = Object.keys(d);
  const levels = ['Very Low','Low','Moderate','High','Very High'];
  const colors = ['#2563eb','#16a34a','#d97706','#ea580c','#dc2626'];
  mkChart('chart-risk-dist', {
    type: 'bar',
    data: { labels: depts, datasets: levels.map((lv,i) => ({
      label: lv, data: depts.map(dep => d[dep][lv]||0), backgroundColor: colors[i], borderRadius: i===0?5:0,
    }))},
    options: { responsive: true, maintainAspectRatio: false, plugins: CHART_OPT.plugins,
      scales: { x: { ...CHART_OPT.scales.x, stacked: true }, y: { ...CHART_OPT.scales.y, stacked: true } } },
  });
}

/* Business Travel — d is {label: {total,attrition,retained,rate}, ...} */
function renderBusinessTravel(d) {
  const labels = Object.keys(d);
  if (!labels.length) return;
  mkChart('chart-travel', {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Retained', data: labels.map(l => d[l].retained),  backgroundColor: 'rgba(79,70,229,.75)', borderRadius: 5 },
      { label: 'Left',     data: labels.map(l => d[l].attrition), backgroundColor: 'rgba(220,38,38,.75)', borderRadius: 5 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...CHART_OPT.plugins,
        tooltip: { ...CHART_OPT.plugins.tooltip,
          callbacks: { afterBody: ctx => `Attrition Rate: ${d[labels[ctx[0].dataIndex]].rate}%` }}},
      scales: CHART_OPT.scales,
    },
  });
}

/* Education Level — d is {label: {total,attrition,retained,rate}, ...} */
function renderEducation(d) {
  const labels = Object.keys(d);
  if (!labels.length) return;
  mkChart('chart-education', {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Retained', data: labels.map(l => d[l].retained),  backgroundColor: 'rgba(8,145,178,.75)', borderRadius: 5 },
      { label: 'Left',     data: labels.map(l => d[l].attrition), backgroundColor: 'rgba(220,38,38,.75)', borderRadius: 5 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...CHART_OPT.plugins,
        tooltip: { ...CHART_OPT.plugins.tooltip,
          callbacks: { afterBody: ctx => `Attrition Rate: ${d[labels[ctx[0].dataIndex]].rate}%` }}},
      scales: CHART_OPT.scales,
    },
  });
}

/* Job Level — d is {label: {total,attrition,retained,rate}, ...} */
function renderJobLevel(d) {
  const labels = Object.keys(d);
  if (!labels.length) return;
  mkChart('chart-joblevel', {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Retained', data: labels.map(l => d[l].retained),  backgroundColor: 'rgba(147,51,234,.75)', borderRadius: 5 },
      { label: 'Left',     data: labels.map(l => d[l].attrition), backgroundColor: 'rgba(220,38,38,.75)',  borderRadius: 5 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...CHART_OPT.plugins,
        tooltip: { ...CHART_OPT.plugins.tooltip,
          callbacks: { afterBody: ctx => `Attrition Rate: ${d[labels[ctx[0].dataIndex]].rate}%` }}},
      scales: CHART_OPT.scales,
    },
  });
}

/* Feature importance */
function renderImportance(canvasId, data) {
  const sorted = [...data].sort((a,b) => b.coefficient - a.coefficient);
  mkChart(canvasId, {
    type: 'bar',
    data: { labels: sorted.map(d => d.feature), datasets: [{
      label: 'Coefficient',
      data: sorted.map(d => d.coefficient),
      backgroundColor: sorted.map(d => d.coefficient >= 0 ? 'rgba(220,38,38,.75)' : 'rgba(22,163,74,.75)'),
      borderRadius: 4,
    }]},
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: CHART_OPT.plugins,
      scales: { x: { ...CHART_OPT.scales.x, ticks: { ...CHART_OPT.scales.x.ticks, callback: v => v.toFixed(2) } }, y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } } },
    },
  });
}

/* ── Predictive Tab ──────────────────────────────────────────────────────── */
async function loadPredictiveTab() {
  if (!state.charts['chart-importance-pred']) {
    const [imp, metrics] = await Promise.all([
      fetch('/api/feature-importance').then(r => r.json()),
      fetch('/api/model-metrics').then(r => r.json()),
    ]);
    renderImportance('chart-importance-pred', imp);
    renderModelMetrics(metrics);
  }
}

function renderModelMetrics(m) {
  setText('m-accuracy',  m.accuracy + '%');
  setText('m-recall',    m.recall   + '%');
  setText('m-precision', m.precision+ '%');
  setText('m-f1',        m.f1       + '%');
  setText('m-algo',      m.algorithm);
  setText('m-samples',   m.training_samples.toLocaleString() + ' samples · ' + m.total_features + ' features');
  animBar('mb-accuracy',  m.accuracy);
  animBar('mb-recall',    m.recall);
  animBar('mb-precision', m.precision);
  animBar('mb-f1',        m.f1);
}

function animBar(id, pct) {
  const el = document.getElementById(id);
  if (el) setTimeout(() => { el.style.width = pct + '%'; }, 100);
}

/* ── Job Level label helper ──────────────────────────────────────────────── */
function updateJobLevel(val) {
  const labels = { 1: 'Entry Level (1)', 2: 'Junior (2)', 3: 'Mid-Level (3)', 4: 'Senior (4)', 5: 'Executive (5)' };
  document.getElementById('pred-joblvl-val').textContent = labels[val] || val;
}

/* ── Satisfaction rating buttons ─────────────────────────────────────────── */
function setSat(groupId, hiddenId, val) {
  const btns = document.querySelectorAll(`#${groupId} .sat-btn`);
  btns.forEach((b, i) => b.classList.toggle('active', i + 1 === val));
  document.getElementById(hiddenId).value = val;
}

/* ── ML Prediction ───────────────────────────────────────────────────────── */
async function runPrediction() {
  const payload = {
    'Department':               document.getElementById('pred-department').value,
    'Job Role':                 document.getElementById('pred-jobrole').value,
    'Marital Status':           document.getElementById('pred-marital').value,
    'Gender':                   document.getElementById('pred-gender').value,
    'Education':                document.getElementById('pred-education').value,
    'Education Field':          document.getElementById('pred-edufield').value,
    'Business Travel':          document.getElementById('pred-travel').value,
    'Over Time':                document.getElementById('pred-overtime').value,
    'Age':                      +document.getElementById('pred-age').value,
    'Distance From Home':       +document.getElementById('pred-dist').value,
    'Monthly Income':           +document.getElementById('pred-income').value,
    'Stock Option Level':       +document.getElementById('pred-stock').value,
    'Job Level':                +document.getElementById('pred-joblvl').value,
    'Job Satisfaction':         +document.getElementById('pred-jobsat').value,
    'Environment Satisfaction': +document.getElementById('pred-envsat').value,
    'Work Life Balance':        +document.getElementById('pred-wlb').value,
    'Job Involvement':          +document.getElementById('pred-jobinv').value,
    'Years At Company':         +document.getElementById('pred-yac').value,
    'Years Since Last Promotion': +document.getElementById('pred-promo').value,
  };

  const btn = document.querySelector('.btn-predict');
  btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> Predicting…';
  btn.disabled = true;

  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => r.json());
    showResult(res, payload);
    loadSimilarEmployees(payload);
  } finally {
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg> Predict Attrition Risk`;
    btn.disabled = false;
  }
}

function showResult(res, payload) {
  document.getElementById('pred-placeholder').style.display = 'none';
  const out = document.getElementById('pred-output');
  out.style.display = 'flex';

  const pct = res.probability;
  const circumference = 267;
  const offset = circumference * (1 - pct / 100);
  const fill = document.getElementById('gauge-fill');
  fill.style.stroke = res.risk_color;
  setTimeout(() => { fill.style.strokeDashoffset = offset; }, 50);
  const gaugePct = document.getElementById('gauge-pct');
  gaugePct.textContent = pct.toFixed(1) + '%';
  gaugePct.style.color = res.risk_color;

  const badge = document.getElementById('risk-badge-xl');
  badge.textContent = res.risk_level;
  badge.className = 'risk-badge-xl risk-pill ' + RISK_PILL_CLASS[res.risk_level];

  document.getElementById('risk-rec-box').textContent = res.recommendation;

  const list = document.getElementById('factor-list');
  list.innerHTML = '';

  const factors = [
    { name: 'Overtime',              val: payload['Over Time']==='Yes'?1:0,                max:1,  higherRisky:true  },
    { name: 'Job Satisfaction',      val: +payload['Job Satisfaction'],                    max:4,  higherRisky:false },
    { name: 'Env. Satisfaction',     val: +payload['Environment Satisfaction'],            max:4,  higherRisky:false },
    { name: 'Work-Life Balance',     val: +payload['Work Life Balance'],                   max:4,  higherRisky:false },
    { name: 'Job Involvement',       val: +payload['Job Involvement'],                     max:4,  higherRisky:false },
    { name: 'Stock Options',         val: +payload['Stock Option Level'],                  max:3,  higherRisky:false },
    { name: 'Monthly Income',        val: Math.min(+payload['Monthly Income'] / 19999, 1), max:1,  higherRisky:false },
    { name: 'Yrs Since Promotion',   val: +payload['Years Since Last Promotion'],          max:15, higherRisky:true  },
    { name: 'Distance From Home',    val: +payload['Distance From Home'],                  max:29, higherRisky:true  },
  ];

  factors.forEach(f => {
    const ratio = Math.min(f.val / f.max, 1);
    const isRisky = f.higherRisky ? ratio > 0.4 : ratio < 0.45;
    const color = isRisky ? '#dc2626' : '#16a34a';
    const tagText = isRisky ? 'Risk' : 'Safe';
    const tagCls  = isRisky ? 'risky' : 'safe';
    const displayVal = f.name === 'Overtime'
      ? (payload['Over Time']==='Yes' ? 'Yes' : 'No')
      : f.name === 'Monthly Income'
        ? '$' + payload['Monthly Income'].toLocaleString()
        : f.val;
    const div = document.createElement('div');
    div.className = 'factor-item';
    div.innerHTML = `
      <span class="factor-name">${f.name}</span>
      <div class="factor-bar-bg"><div class="factor-bar-fill" style="width:${ratio*100}%;background:${color}"></div></div>
      <span class="factor-val" style="color:${color}">${displayVal}</span>
      <span class="factor-tag ${tagCls}">${tagText}</span>`;
    list.appendChild(div);
  });
}

function clearPrediction() {
  document.getElementById('pred-placeholder').style.display = 'flex';
  document.getElementById('pred-output').style.display = 'none';
  document.getElementById('gauge-fill').style.strokeDashoffset = '267';
  document.getElementById('similar-employees-section').style.display = 'none';
}

/* ── Similar Employees (shown after prediction) ──────────────────────────── */
async function loadSimilarEmployees(payload) {
  const section = document.getElementById('similar-employees-section');
  const tbody   = document.getElementById('similar-table-body');
  section.style.display = 'block';
  tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Finding employees with matching attributes…</td></tr>';

  const body = {
    department:       payload['Department'],
    job_role:         payload['Job Role'],
    overtime:         payload['Over Time'],
    job_satisfaction: +payload['Job Satisfaction'],
    years_at_company: +payload['Years At Company'],
    monthly_income:   +payload['Monthly Income'],
    job_level:        +payload['Job Level'],
    marital_status:   payload['Marital Status'],
  };

  // Build subtitle with matched attributes
  const parts = [`${body.department} › ${body.job_role}`];
  if (body.overtime)         parts.push(`Overtime: ${body.overtime}`);
  if (body.job_satisfaction) parts.push(`Satisfaction: ${body.job_satisfaction}`);
  if (body.years_at_company) parts.push(`~${body.years_at_company} yrs tenure`);
  const subtitle = document.getElementById('similar-subtitle');
  if (subtitle) subtitle.textContent = 'Matched on: ' + parts.join(' · ');

  try {
    const data = await fetch('/api/similar-employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json());

    tbody.innerHTML = '';
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No matching employees found.</td></tr>';
      return;
    }

    data.forEach(emp => {
      const pClass = RISK_PILL_CLASS[emp.risk_level];
      const rColor = RISK_COLORS[emp.risk_level];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escHtml(emp.emp_no) || '–'}</td>
        <td>${escHtml(emp.job_role)}</td>
        <td>${emp.age}</td>
        <td>${emp.gender}</td>
        <td>${emp.overtime==='Yes' ? '<span style="color:#ea580c;font-weight:600">Yes</span>' : 'No'}</td>
        <td>$${emp.monthly_income.toLocaleString()}</td>
        <td><span class="${emp.actual_attrition==='Yes' ? 'status-left' : 'status-active'}">${emp.actual_attrition==='Yes' ? 'Left' : 'Active'}</span></td>
        <td>
          <div class="score-cell">
            <div class="score-bg"><div class="score-fill" style="width:${emp.risk_score}%;background:${rColor}"></div></div>
            <span class="score-num" style="color:${rColor}">${emp.risk_score}%</span>
          </div>
        </td>
        <td><span class="risk-pill ${pClass}">${emp.risk_level}</span></td>`;
      tbody.appendChild(tr);
    });

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">Failed to load matching employees.</td></tr>';
  }
}

/* ── Risk Summary (Employees tab) ────────────────────────────────────────── */
async function loadRiskSummary() {
  const d = await fetch(`/api/risk-summary?${getParams()}`).then(r => r.json());
  const map = { 'Very High':'vh','High':'h','Moderate':'m','Low':'l','Very Low':'vl' };
  Object.entries(map).forEach(([level, key]) => {
    setText(`rs-${key}`,  d[level].count.toLocaleString());
    setText(`rsp-${key}`, d[level].pct.toFixed(1) + '% of total');
  });
}

/* ── Multi-Column Sort ───────────────────────────────────────────────────── */
function initSortHeaders() {
  document.querySelectorAll('#emp-table th.sortable').forEach(th => {
    th.addEventListener('click', () => handleColumnSort(th.dataset.col));
  });
  updateSortHeaders();
}

function handleColumnSort(col) {
  // Desc-first columns: first click = desc, then asc, then remove
  const descFirstCols = ['risk_score', 'monthly_income', 'age', 'years_at_company'];
  const isDescFirst = descFirstCols.includes(col);
  const idx = state.sortCols.findIndex(s => s.col === col);

  if (idx < 0) {
    // Column not currently sorted — add it (every click on a new col adds to multi-sort)
    state.sortCols.push({ col, dir: isDescFirst ? 'desc' : 'asc' });
  } else {
    const currentDir = state.sortCols[idx].dir;
    // Cycle: desc→asc→remove (for desc-first) or asc→desc→remove (for asc-first)
    const nextDir = isDescFirst
      ? (currentDir === 'desc' ? 'asc' : null)
      : (currentDir === 'asc'  ? 'desc' : null);

    if (nextDir) {
      state.sortCols[idx].dir = nextDir;
    } else {
      state.sortCols.splice(idx, 1);
    }
  }

  // Fallback: if all sorts removed, default to risk_score desc
  if (state.sortCols.length === 0) {
    state.sortCols = [{ col: 'risk_score', dir: 'desc' }];
  }

  const hint = document.getElementById('sort-hint');
  if (hint) hint.style.display = state.sortCols.length > 1 ? 'block' : 'none';

  updateSortHeaders();
  state.currentPage = 1;
  loadEmployees();
}

function updateSortHeaders() {
  document.querySelectorAll('#emp-table th.sortable').forEach(th => {
    const col  = th.dataset.col;
    const idx  = state.sortCols.findIndex(s => s.col === col);
    const ind  = th.querySelector('.sort-ind');
    th.classList.remove('sorted', 'asc', 'desc');
    if (ind) ind.innerHTML = '';

    if (idx >= 0) {
      const s = state.sortCols[idx];
      th.classList.add('sorted', s.dir);
      if (ind) {
        ind.innerHTML = s.dir === 'asc' ? '&#9650;' : '&#9660;';
        if (state.sortCols.length > 1) {
          ind.innerHTML += `<span class="sort-priority">${idx + 1}</span>`;
        }
      }
    }
  });
}

/* ── Employee Table ──────────────────────────────────────────────────────── */
async function loadEmployees() {
  const p = getParams(true);
  p.set('page', state.currentPage);
  p.set('per_page', state.perPage);
  if (state.riskLevelFilter) p.set('risk_level', state.riskLevelFilter);
  if (state.searchQuery)     p.set('search', state.searchQuery);

  const data = await fetch(`/api/employees?${p}`).then(r => r.json());
  const body = document.getElementById('emp-table-body');
  body.innerHTML = '';

  if (!data.employees.length) {
    body.innerHTML = '<tr><td colspan="10" class="table-empty">No employees match the current filters.</td></tr>';
    setText('table-count', '0 results');
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  data.employees.forEach(emp => {
    const pClass = RISK_PILL_CLASS[emp.risk_level];
    const rColor = RISK_COLORS[emp.risk_level];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${emp.emp_no || '–'}</td>
      <td>${escHtml(emp.department)}</td>
      <td>${escHtml(emp.job_role)}</td>
      <td>${emp.age}</td>
      <td>${emp.gender}</td>
      <td>${emp.overtime==='Yes' ? '<span style="color:#ea580c;font-weight:600">Yes</span>' : 'No'}</td>
      <td>$${emp.monthly_income.toLocaleString()}</td>
      <td><span class="${emp.actual_attrition==='Yes' ? 'status-left' : 'status-active'}">${emp.actual_attrition==='Yes' ? 'Left' : 'Active'}</span></td>
      <td>
        <div class="score-cell">
          <div class="score-bg"><div class="score-fill" style="width:${emp.risk_score}%;background:${rColor}"></div></div>
          <span class="score-num" style="color:${rColor}">${emp.risk_score}%</span>
        </div>
      </td>
      <td><span class="risk-pill ${pClass}">${emp.risk_level}</span></td>`;
    body.appendChild(tr);
  });

  const start = (state.currentPage-1)*state.perPage+1;
  const end   = Math.min(state.currentPage*state.perPage, data.total);
  setText('table-count', `${start}–${end} of ${data.total.toLocaleString()} employees`);
  renderPagination(data.total, data.page, data.per_page);
}

function renderPagination(total, page, perPage) {
  const pages = Math.ceil(total / perPage);
  const cont  = document.getElementById('pagination');
  cont.innerHTML = '';
  if (pages <= 1) return;

  const btn = (label, pg, disabled=false) => {
    const b = document.createElement('button');
    b.className = 'page-btn' + (pg===page ? ' active' : '');
    b.textContent = label; b.disabled = disabled;
    b.onclick = () => { state.currentPage = pg; loadEmployees(); };
    return b;
  };

  cont.appendChild(btn('«', 1, page===1));
  cont.appendChild(btn('‹', page-1, page===1));
  let s = Math.max(1, page-2), e = Math.min(pages, s+4);
  if (e-s < 4) s = Math.max(1, e-4);
  for (let pg=s; pg<=e; pg++) cont.appendChild(btn(pg, pg));
  cont.appendChild(btn('›', page+1, page===pages));
  cont.appendChild(btn('»', pages,  page===pages));
}

function filterByRisk(el, level) {
  document.querySelectorAll('.risk-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  state.riskLevelFilter = level;
  state.currentPage = 1;
  loadEmployees();
}

let searchTimer;
function searchEmployees() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.searchQuery = document.getElementById('emp-search').value;
    state.currentPage = 1;
    loadEmployees();
  }, 300);
}

/* ── Utility ─────────────────────────────────────────────────────────────── */
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
