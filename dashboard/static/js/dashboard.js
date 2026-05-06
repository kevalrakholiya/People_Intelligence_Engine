/* ── State ───────────────────────────────────────────────────────────────── */
const state = {
  activeTab: 'overview',
  riskLevelFilter: '',
  searchQuery: '',
  currentPage: 1,
  perPage: 50,
  totalEmployees: 0,
  charts: {},
};

/* ── Chart colour helpers ────────────────────────────────────────────────── */
const RISK_COLORS = {
  'Very High': '#ef4444',
  'High':      '#f97316',
  'Moderate':  '#eab308',
  'Low':       '#22c55e',
  'Very Low':  '#3b82f6',
};

const PALETTE = ['#6366f1','#8b5cf6','#0ea5e9','#22c55e','#f97316','#ec4899','#14b8a6','#eab308','#a78bfa'];

const chartDefaults = {
  color: '#f1f5f9',
  borderColor: '#334155',
  plugins: {
    legend: { labels: { color: '#94a3b8', font: { size: 12 }, boxWidth: 12 } },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      borderWidth: 1,
      titleColor: '#f1f5f9',
      bodyColor: '#cbd5e1',
    },
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8', font: { size: 11 } },
      grid: { color: 'rgba(51,65,85,.5)' },
    },
    y: {
      ticks: { color: '#94a3b8', font: { size: 11 } },
      grid: { color: 'rgba(51,65,85,.5)' },
    },
  },
};

/* ── Boot ────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  showLoading();
  await loadFilterOptions();
  await Promise.all([loadKPIs(), loadAllCharts()]);
  hideLoading();
  loadEmployees();
});

/* ── Tab switching ───────────────────────────────────────────────────────── */
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

  if (tab === 'employees') loadEmployees();
  if (tab === 'predictions') loadFeatureImportancePred();
}

/* ── Loading helpers ─────────────────────────────────────────────────────── */
function showLoading() { document.getElementById('loading').classList.add('show'); }
function hideLoading()  { document.getElementById('loading').classList.remove('show'); }

/* ── Filter helpers ──────────────────────────────────────────────────────── */
function getFilterParams() {
  const params = new URLSearchParams();
  const dept = document.getElementById('f-department').value;
  const gender = document.getElementById('f-gender').value;
  const ageMin = document.getElementById('f-age-min').value;
  const ageMax = document.getElementById('f-age-max').value;
  const role = document.getElementById('f-jobrole').value;
  const marital = document.getElementById('f-marital').value;
  const ot = document.getElementById('f-overtime').value;

  if (dept)   params.set('department', dept);
  if (gender) params.set('gender', gender);
  if (role)   params.set('job_role', role);
  if (marital) params.set('marital_status', marital);
  if (ot)     params.set('overtime', ot);
  params.set('age_min', ageMin);
  params.set('age_max', ageMax);
  return params;
}

async function applyFilters() {
  showLoading();
  state.currentPage = 1;
  await Promise.all([loadKPIs(), loadAllCharts()]);
  if (state.activeTab === 'employees') loadEmployees();
  hideLoading();
}

function resetFilters() {
  document.getElementById('f-department').value = '';
  document.getElementById('f-gender').value = '';
  document.getElementById('f-jobrole').value = '';
  document.getElementById('f-marital').value = '';
  document.getElementById('f-overtime').value = '';
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
  const data = await fetch('/api/filter-options').then(r => r.json());

  const populate = (id, items) => {
    const el = document.getElementById(id);
    items.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      el.appendChild(opt);
    });
  };

  populate('f-department', data.departments);
  populate('f-gender', data.genders);
  populate('f-jobrole', data.job_roles);
  populate('f-marital', data.marital_statuses);

  document.getElementById('f-age-min').min = data.age_min;
  document.getElementById('f-age-max').max = data.age_max;
}

/* ── KPIs ────────────────────────────────────────────────────────────────── */
async function loadKPIs() {
  const params = getFilterParams();
  const d = await fetch(`/api/kpis?${params}`).then(r => r.json());

  animateValue('kpi-total', d.total_employees, v => v.toLocaleString());
  animateValue('kpi-rate', d.attrition_rate, v => v.toFixed(1) + '%');
  animateValue('kpi-active', d.active_employees, v => v.toLocaleString());
  animateValue('kpi-highrisk', d.high_risk_count, v => v.toLocaleString());
  animateValue('kpi-income', d.avg_monthly_income, v => '$' + v.toLocaleString());
  animateValue('kpi-age', d.avg_age, v => v.toFixed(1));
  animateValue('kpi-attrition-count', d.attrition_count, v => v.toLocaleString());

  document.getElementById('filter-status').textContent =
    `Showing ${d.total_employees.toLocaleString()} employees`;
}

function animateValue(id, target, fmt) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = fmt(target);
}

/* ── Chart loader ────────────────────────────────────────────────────────── */
async function loadAllCharts() {
  const params = getFilterParams();
  const [overview, dept, age, ot, sat, marital, income, riskDist, importance] =
    await Promise.all([
      fetch(`/api/charts/attrition-overview?${params}`).then(r => r.json()),
      fetch(`/api/charts/attrition-by-department?${params}`).then(r => r.json()),
      fetch(`/api/charts/age-distribution?${params}`).then(r => r.json()),
      fetch(`/api/charts/overtime-impact?${params}`).then(r => r.json()),
      fetch(`/api/charts/job-satisfaction?${params}`).then(r => r.json()),
      fetch(`/api/charts/marital-attrition?${params}`).then(r => r.json()),
      fetch(`/api/charts/income-by-attrition?${params}`).then(r => r.json()),
      fetch(`/api/charts/risk-distribution?${params}`).then(r => r.json()),
      fetch('/api/feature-importance').then(r => r.json()),
    ]);

  renderOverview(overview);
  renderDeptChart(dept);
  renderAgeChart(age);
  renderOvertimeChart(ot);
  renderSatisfactionChart(sat);
  renderMaritalChart(marital);
  renderIncomeChart(income);
  renderRiskDistChart(riskDist);
  renderImportanceChart('chart-importance', importance);
}

/* ── Chart render helpers ────────────────────────────────────────────────── */
function destroyChart(id) {
  if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
}

function makeChart(id, config) {
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  state.charts[id] = new Chart(ctx, config);
  return state.charts[id];
}

/* Attrition overview donut */
function renderOverview(d) {
  makeChart('chart-overview', {
    type: 'doughnut',
    data: {
      labels: ['Active Employees', 'Left (Attrition)'],
      datasets: [{
        data: [d.No, d.Yes],
        backgroundColor: ['#22c55e', '#ef4444'],
        borderColor: '#1e293b',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        ...chartDefaults.plugins,
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 12 }, boxWidth: 12, padding: 16 } },
      },
    },
  });
}

/* Attrition by department */
function renderDeptChart(d) {
  const labels = Object.keys(d);
  makeChart('chart-dept', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Active',
          data: labels.map(l => d[l].active),
          backgroundColor: '#22c55e',
          borderRadius: 4,
        },
        {
          label: 'Attrition',
          data: labels.map(l => d[l].attrition),
          backgroundColor: '#ef4444',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: chartDefaults.plugins,
      scales: chartDefaults.scales,
    },
  });
}

/* Age distribution histogram */
function renderAgeChart(d) {
  makeChart('chart-age', {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [
        { label: 'Retained', data: d.retained, backgroundColor: 'rgba(34,197,94,.7)', borderRadius: 3 },
        { label: 'Left', data: d.attrition, backgroundColor: 'rgba(239,68,68,.7)', borderRadius: 3 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: chartDefaults.plugins,
      scales: { ...chartDefaults.scales, x: { ...chartDefaults.scales.x, stacked: true }, y: { ...chartDefaults.scales.y, stacked: true } },
    },
  });
}

/* Overtime impact */
function renderOvertimeChart(d) {
  const labels = Object.keys(d);
  makeChart('chart-overtime', {
    type: 'bar',
    data: {
      labels: labels.map(l => l === 'Yes' ? 'With Overtime' : 'No Overtime'),
      datasets: [
        { label: 'Retained', data: labels.map(l => d[l].retained), backgroundColor: 'rgba(34,197,94,.7)', borderRadius: 4 },
        { label: 'Left',     data: labels.map(l => d[l].attrition), backgroundColor: 'rgba(239,68,68,.7)', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          ...chartDefaults.plugins.tooltip,
          callbacks: {
            afterBody: ctx => {
              const label = labels[ctx[0].dataIndex];
              return `Attrition Rate: ${d[label].rate}%`;
            },
          },
        },
      },
      scales: chartDefaults.scales,
    },
  });
}

/* Job satisfaction by role */
function renderSatisfactionChart(d) {
  const roles = Object.keys(d).sort((a, b) => d[b].avg_satisfaction - d[a].avg_satisfaction);
  makeChart('chart-satisfaction', {
    type: 'bar',
    data: {
      labels: roles,
      datasets: [
        {
          label: 'Avg Job Satisfaction (1-4)',
          data: roles.map(r => d[r].avg_satisfaction),
          backgroundColor: roles.map((_, i) => PALETTE[i % PALETTE.length]),
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          ...chartDefaults.plugins.tooltip,
          callbacks: {
            afterBody: ctx => `Attrition Rate: ${d[roles[ctx[0].dataIndex]].attrition_rate}%`,
          },
        },
      },
      scales: {
        x: { ...chartDefaults.scales.x, min: 0, max: 4 },
        y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

/* Marital status attrition */
function renderMaritalChart(d) {
  const labels = Object.keys(d);
  makeChart('chart-marital', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Retained', data: labels.map(l => d[l].retained), backgroundColor: 'rgba(99,102,241,.7)', borderRadius: 4 },
        { label: 'Left',     data: labels.map(l => d[l].attrition), backgroundColor: 'rgba(239,68,68,.7)', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: chartDefaults.plugins,
      scales: chartDefaults.scales,
    },
  });
}

/* Monthly income by attrition */
function renderIncomeChart(d) {
  const labels = Object.keys(d);
  makeChart('chart-income', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Avg Income (Retained)', data: labels.map(l => d[l].no_avg), backgroundColor: 'rgba(34,197,94,.7)', borderRadius: 4 },
        { label: 'Avg Income (Left)',     data: labels.map(l => d[l].yes_avg), backgroundColor: 'rgba(239,68,68,.7)', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: chartDefaults.plugins,
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          ticks: { color: '#94a3b8', font: { size: 11 }, callback: v => '$' + v.toLocaleString() },
        },
      },
    },
  });
}

/* Risk distribution stacked bar */
function renderRiskDistChart(d) {
  const depts = Object.keys(d);
  const levels = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];
  const colors  = ['#3b82f6','#22c55e','#eab308','#f97316','#ef4444'];

  makeChart('chart-risk-dist', {
    type: 'bar',
    data: {
      labels: depts,
      datasets: levels.map((level, i) => ({
        label: level,
        data: depts.map(dept => d[dept][level] || 0),
        backgroundColor: colors[i],
        borderRadius: i === 0 ? 4 : 0,
      })),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: chartDefaults.plugins,
      scales: {
        x: { ...chartDefaults.scales.x, stacked: true },
        y: { ...chartDefaults.scales.y, stacked: true },
      },
    },
  });
}

/* Feature importance horizontal bar */
function renderImportanceChart(canvasId, data) {
  const sorted = [...data].sort((a, b) => b.coefficient - a.coefficient);
  const labels = sorted.map(d => d.feature);
  const values = sorted.map(d => d.coefficient);
  const colors = values.map(v => v >= 0 ? '#ef4444' : '#22c55e');

  makeChart(canvasId, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Coefficient (+ increases risk, – reduces risk)',
        data: values,
        backgroundColor: colors,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: chartDefaults.plugins,
      scales: {
        x: { ...chartDefaults.scales.x, ticks: { ...chartDefaults.scales.x.ticks, callback: v => v.toFixed(2) } },
        y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

/* ── Prediction tab feature importance ───────────────────────────────────── */
async function loadFeatureImportancePred() {
  if (state.charts['chart-importance-pred']) return;
  const data = await fetch('/api/feature-importance').then(r => r.json());
  renderImportanceChart('chart-importance-pred', data);
}

/* ── ML Prediction ───────────────────────────────────────────────────────── */
async function runPrediction() {
  const payload = {
    'Department':              document.getElementById('pred-department').value,
    'Job Role':                document.getElementById('pred-jobrole').value,
    'Marital Status':          document.getElementById('pred-marital').value,
    'Education':               document.getElementById('pred-education').value,
    'Education Field':         document.getElementById('pred-edufield').value,
    'Business Travel':         document.getElementById('pred-travel').value,
    'Over Time':               document.getElementById('pred-overtime').value,
    'Gender':                  document.getElementById('pred-gender').value,
    'Age':                     +document.getElementById('pred-age').value,
    'Monthly Income':          +document.getElementById('pred-income').value,
    'Years At Company':        +document.getElementById('pred-yac').value,
    'Years Since Last Promotion': +document.getElementById('pred-promo').value,
    'Job Satisfaction':        +document.getElementById('pred-jobsat').value,
    'Environment Satisfaction':+document.getElementById('pred-envsat').value,
    'Work Life Balance':       +document.getElementById('pred-wlb').value,
    'Stock Option Level':      +document.getElementById('pred-stock').value,
    'Job Involvement':         +document.getElementById('pred-jobinv').value,
    'Distance From Home':      +document.getElementById('pred-dist').value,
  };

  const btn = document.querySelector('.btn-predict');
  btn.textContent = 'Predicting…';
  btn.disabled = true;

  try {
    const result = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => r.json());

    showPredictionResult(result, payload);
  } finally {
    btn.textContent = 'Predict Attrition Risk';
    btn.disabled = false;
  }
}

function showPredictionResult(result, payload) {
  document.querySelector('.pred-placeholder').style.display = 'none';
  const output = document.getElementById('pred-output');
  output.style.display = 'flex';

  // Gauge animation
  const pct = result.probability;
  const circumference = 251;
  const offset = circumference * (1 - pct / 100);
  const gaugeFill = document.getElementById('gauge-fill');
  gaugeFill.style.stroke = result.risk_color;
  gaugeFill.style.transition = 'stroke-dashoffset 1s ease, stroke 0.5s ease';
  setTimeout(() => { gaugeFill.style.strokeDashoffset = offset; }, 50);

  document.getElementById('gauge-value').textContent = pct.toFixed(1) + '%';
  document.getElementById('gauge-value').style.color = result.risk_color;

  // Risk badge
  const badge = document.getElementById('risk-badge');
  badge.textContent = result.risk_level;
  const levelClass = result.risk_level.toLowerCase().replace(' ', '-');
  badge.className = `risk-badge-large risk-pill ${levelClass}`;

  // Recommendation
  document.getElementById('risk-rec').textContent = result.recommendation;

  // Risk factor signals
  const grid = document.getElementById('risk-factors-grid');
  grid.innerHTML = '';

  const factors = [
    { label: 'Overtime',            value: payload['Over Time'] === 'Yes' ? 1 : 0, max: 1, high: true },
    { label: 'Job Satisfaction',    value: payload['Job Satisfaction'], max: 4, high: false },
    { label: 'Env. Satisfaction',   value: payload['Environment Satisfaction'], max: 4, high: false },
    { label: 'Work-Life Balance',   value: payload['Work Life Balance'], max: 4, high: false },
    { label: 'Stock Options',       value: payload['Stock Option Level'], max: 3, high: false },
    { label: 'Yrs Since Promotion', value: payload['Years Since Last Promotion'], max: 15, high: true },
  ];

  factors.forEach(f => {
    const ratio = f.value / f.max;
    const color = f.high ? (ratio > 0.5 ? '#ef4444' : '#22c55e') : (ratio >= 0.5 ? '#22c55e' : '#ef4444');
    const item = document.createElement('div');
    item.className = 'risk-factor-item';
    item.innerHTML = `
      <span style="min-width:140px;font-size:12px">${f.label}</span>
      <div class="risk-factor-bar-bg"><div class="risk-factor-bar" style="width:${ratio*100}%;background:${color}"></div></div>
      <span class="risk-factor-val" style="color:${color}">${f.value}</span>
    `;
    grid.appendChild(item);
  });
}

/* ── Employee Table ──────────────────────────────────────────────────────── */
async function loadEmployees() {
  const params = getFilterParams();
  params.set('page', state.currentPage);
  params.set('per_page', state.perPage);
  if (state.riskLevelFilter) params.set('risk_level', state.riskLevelFilter);
  if (state.searchQuery) params.set('search', state.searchQuery);

  const data = await fetch(`/api/employees?${params}`).then(r => r.json());
  state.totalEmployees = data.total;

  const body = document.getElementById('emp-table-body');
  body.innerHTML = '';

  if (!data.employees.length) {
    body.innerHTML = '<tr><td colspan="10" class="table-loading">No employees match the current filters.</td></tr>';
    document.getElementById('table-meta').textContent = '0 results';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  data.employees.forEach(emp => {
    const levelClass = emp.risk_level.toLowerCase().replace(' ', '-');
    const scoreColor = RISK_COLORS[emp.risk_level] || '#6366f1';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${emp.emp_no || '–'}</td>
      <td>${emp.department}</td>
      <td>${emp.job_role}</td>
      <td>${emp.age}</td>
      <td>${emp.gender}</td>
      <td>${emp.overtime === 'Yes' ? '<span style="color:#f97316;font-weight:600">Yes</span>' : 'No'}</td>
      <td>$${emp.monthly_income.toLocaleString()}</td>
      <td><span class="${emp.actual_attrition === 'Yes' ? 'status-yes' : 'status-no'}">${emp.actual_attrition === 'Yes' ? 'Left' : 'Active'}</span></td>
      <td>
        <div class="score-bar-wrap">
          <div class="score-bar-bg"><div class="score-bar-fill" style="width:${emp.risk_score}%;background:${scoreColor}"></div></div>
          <span class="score-val" style="color:${scoreColor}">${emp.risk_score}%</span>
        </div>
      </td>
      <td><span class="risk-pill ${levelClass}">${emp.risk_level}</span></td>
    `;
    body.appendChild(tr);
  });

  const start = (state.currentPage - 1) * state.perPage + 1;
  const end = Math.min(state.currentPage * state.perPage, data.total);
  document.getElementById('table-meta').textContent = `${start}–${end} of ${data.total.toLocaleString()} employees`;

  renderPagination(data.total, data.page, data.per_page);
}

function renderPagination(total, page, perPage) {
  const totalPages = Math.ceil(total / perPage);
  const container = document.getElementById('pagination');
  container.innerHTML = '';

  if (totalPages <= 1) return;

  const mkBtn = (label, pg, disabled = false) => {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (pg === page ? ' active' : '');
    btn.textContent = label;
    btn.disabled = disabled;
    btn.onclick = () => { state.currentPage = pg; loadEmployees(); };
    return btn;
  };

  container.appendChild(mkBtn('«', 1, page === 1));
  container.appendChild(mkBtn('‹', page - 1, page === 1));

  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);

  for (let p = start; p <= end; p++) container.appendChild(mkBtn(p, p));

  container.appendChild(mkBtn('›', page + 1, page === totalPages));
  container.appendChild(mkBtn('»', totalPages, page === totalPages));
}

function filterByRisk(btn, level) {
  document.querySelectorAll('.risk-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
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
