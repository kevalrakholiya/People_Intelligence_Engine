from flask import Flask, render_template, jsonify, request
import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import os

app = Flask(__name__)

# ── Column definitions (actual CSV column names) ──────────────────────────────
CATEGORICAL_FEATURES = [
    'Business Travel', 'Department', 'Education Field',
    'Gender', 'Job Role', 'Marital Status', 'Over Time', 'Education'
]

NUMERIC_FEATURES = [
    'Age', 'Daily Rate', 'Distance From Home', 'Environment Satisfaction',
    'Hourly Rate', 'Job Involvement', 'Job Level', 'Job Satisfaction',
    'Monthly Income', 'Monthly Rate', 'Num Companies Worked',
    'Percent Salary Hike', 'Performance Rating', 'Relationship Satisfaction',
    'Stock Option Level', 'Total Working Years', 'Training Times Last Year',
    'Work Life Balance', 'Years At Company', 'Years In Current Role',
    'Years Since Last Promotion', 'Years With Curr Manager'
]

DROP_COLS = [
    'Attrition', 'Employee Count', 'Employee Number', 'Standard Hours',
    'Over18', 'CF_age band', 'CF_attrition label', 'CF_attrition count',
    'CF_attrition counts', 'CF_attrition rate', 'CF_current Employee',
    'emp no', '-2', '0'
]

# ── Global state ──────────────────────────────────────────────────────────────
df = None
model = None
risk_df = None
_initialized = False


def get_risk_level(p):
    if p >= 0.85:
        return 'Very High'
    if p >= 0.70:
        return 'High'
    if p >= 0.50:
        return 'Moderate'
    if p >= 0.30:
        return 'Low'
    return 'Very Low'


def load_data():
    global df
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'HR_Analytics_clean.csv')
    df = pd.read_csv(data_path)


def train_model():
    global model, risk_df

    drop = [c for c in DROP_COLS if c in df.columns]
    num_cols = [c for c in NUMERIC_FEATURES if c in df.columns]
    cat_cols = [c for c in CATEGORICAL_FEATURES if c in df.columns]

    X = df[num_cols + cat_cols].copy()
    y = (df['Attrition'] == 'Yes').astype(int)

    preprocessor = ColumnTransformer([
        ('num', StandardScaler(), num_cols),
        ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), cat_cols)
    ])

    model = Pipeline([
        ('preprocessor', preprocessor),
        ('classifier', LogisticRegression(max_iter=5000, class_weight='balanced', solver='lbfgs'))
    ])
    model.fit(X, y)

    probs = model.predict_proba(X)[:, 1]
    risk_df = df.copy()
    risk_df['_risk_score'] = probs
    risk_df['_risk_level'] = risk_df['_risk_score'].apply(get_risk_level)
    risk_df['_risk_pct'] = (risk_df['_risk_score'] * 100).round(1)


@app.before_request
def startup():
    global _initialized
    if not _initialized:
        load_data()
        train_model()
        _initialized = True


# ── Filter helper ─────────────────────────────────────────────────────────────
def apply_filters(data):
    dept = request.args.get('department', '')
    gender = request.args.get('gender', '')
    age_min = int(request.args.get('age_min', 18))
    age_max = int(request.args.get('age_max', 60))
    job_role = request.args.get('job_role', '')
    marital = request.args.get('marital_status', '')
    overtime = request.args.get('overtime', '')

    filtered = data.copy()
    if dept:
        filtered = filtered[filtered['Department'] == dept]
    if gender:
        filtered = filtered[filtered['Gender'] == gender]
    if job_role:
        filtered = filtered[filtered['Job Role'] == job_role]
    if marital:
        filtered = filtered[filtered['Marital Status'] == marital]
    if overtime:
        filtered = filtered[filtered['Over Time'] == overtime]
    filtered = filtered[(filtered['Age'] >= age_min) & (filtered['Age'] <= age_max)]
    return filtered


# ── API routes ────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/filter-options')
def filter_options():
    return jsonify({
        'departments': sorted(df['Department'].dropna().unique().tolist()),
        'genders': sorted(df['Gender'].dropna().unique().tolist()),
        'job_roles': sorted(df['Job Role'].dropna().unique().tolist()),
        'marital_statuses': sorted(df['Marital Status'].dropna().unique().tolist()),
        'education_fields': sorted(df['Education Field'].dropna().unique().tolist()),
        'business_travels': sorted(df['Business Travel'].dropna().unique().tolist()),
        'educations': sorted(df['Education'].dropna().unique().tolist()),
        'age_min': int(df['Age'].min()),
        'age_max': int(df['Age'].max()),
    })


@app.route('/api/kpis')
def api_kpis():
    filtered = apply_filters(risk_df)
    total = len(filtered)
    if total == 0:
        return jsonify({'total_employees': 0, 'attrition_count': 0, 'active_employees': 0,
                        'attrition_rate': 0, 'avg_age': 0, 'avg_monthly_income': 0,
                        'high_risk_count': 0})
    attrition = int((filtered['Attrition'] == 'Yes').sum())
    return jsonify({
        'total_employees': int(total),
        'attrition_count': attrition,
        'active_employees': int(total - attrition),
        'attrition_rate': round(float(attrition / total * 100), 2),
        'avg_age': round(float(filtered['Age'].mean()), 1),
        'avg_monthly_income': int(filtered['Monthly Income'].mean()),
        'high_risk_count': int((filtered['_risk_score'] >= 0.70).sum())
    })


@app.route('/api/charts/attrition-overview')
def attrition_overview():
    filtered = apply_filters(risk_df)
    yes = int((filtered['Attrition'] == 'Yes').sum())
    no = int((filtered['Attrition'] == 'No').sum())
    return jsonify({'Yes': yes, 'No': no})


@app.route('/api/charts/attrition-by-department')
def attrition_by_dept():
    filtered = apply_filters(risk_df)
    result = {}
    for dept, g in filtered.groupby('Department'):
        total = len(g)
        attrition = int((g['Attrition'] == 'Yes').sum())
        result[str(dept)] = {
            'total': int(total),
            'attrition': attrition,
            'active': int(total - attrition),
            'rate': round(float(attrition / total * 100), 2) if total else 0
        }
    return jsonify(result)


@app.route('/api/charts/age-distribution')
def age_distribution():
    filtered = apply_filters(risk_df)
    bins = [18, 25, 30, 35, 40, 45, 50, 55, 61]
    labels = ['18-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55+']

    yes_hist, _ = np.histogram(filtered[filtered['Attrition'] == 'Yes']['Age'].dropna(), bins=bins)
    no_hist, _ = np.histogram(filtered[filtered['Attrition'] == 'No']['Age'].dropna(), bins=bins)

    return jsonify({'labels': labels, 'attrition': yes_hist.tolist(), 'retained': no_hist.tolist()})


@app.route('/api/charts/overtime-impact')
def overtime_impact():
    filtered = apply_filters(risk_df)
    result = {}
    for ot, g in filtered.groupby('Over Time'):
        total = len(g)
        attrition = int((g['Attrition'] == 'Yes').sum())
        result[str(ot)] = {
            'total': int(total),
            'attrition': attrition,
            'retained': int(total - attrition),
            'rate': round(float(attrition / total * 100), 2) if total else 0
        }
    return jsonify(result)


@app.route('/api/charts/job-satisfaction')
def job_satisfaction():
    filtered = apply_filters(risk_df)
    result = {}
    for role, g in filtered.groupby('Job Role'):
        avg_sat = g['Job Satisfaction'].mean()
        attrition_rate = (g['Attrition'] == 'Yes').mean() * 100
        result[str(role)] = {
            'avg_satisfaction': round(float(avg_sat), 2) if not pd.isna(avg_sat) else 0,
            'attrition_rate': round(float(attrition_rate), 2),
            'count': int(len(g))
        }
    return jsonify(result)


@app.route('/api/charts/risk-distribution')
def risk_distribution():
    filtered = apply_filters(risk_df)
    risk_levels = ['Very Low', 'Low', 'Moderate', 'High', 'Very High']
    result = {}
    for dept, g in filtered.groupby('Department'):
        counts = g['_risk_level'].value_counts()
        result[str(dept)] = {level: int(counts.get(level, 0)) for level in risk_levels}
    return jsonify(result)


@app.route('/api/charts/income-by-attrition')
def income_by_attrition():
    filtered = apply_filters(risk_df)
    result = {}
    for dept, g in filtered.groupby('Department'):
        yes_inc = g[g['Attrition'] == 'Yes']['Monthly Income'].mean()
        no_inc = g[g['Attrition'] == 'No']['Monthly Income'].mean()
        result[str(dept)] = {
            'yes_avg': int(yes_inc) if not pd.isna(yes_inc) else 0,
            'no_avg': int(no_inc) if not pd.isna(no_inc) else 0
        }
    return jsonify(result)


@app.route('/api/charts/marital-attrition')
def marital_attrition():
    filtered = apply_filters(risk_df)
    result = {}
    for status, g in filtered.groupby('Marital Status'):
        total = len(g)
        attrition = int((g['Attrition'] == 'Yes').sum())
        result[str(status)] = {
            'total': int(total),
            'attrition': attrition,
            'retained': int(total - attrition),
            'rate': round(float(attrition / total * 100), 2) if total else 0
        }
    return jsonify(result)


@app.route('/api/feature-importance')
def feature_importance():
    classifier = model.named_steps['classifier']
    preprocessor = model.named_steps['preprocessor']

    num_cols = [c for c in NUMERIC_FEATURES if c in df.columns]
    cat_cols = [c for c in CATEGORICAL_FEATURES if c in df.columns]
    cat_names = preprocessor.named_transformers_['cat'].get_feature_names_out(cat_cols).tolist()
    all_names = num_cols + cat_names

    coefs = classifier.coef_[0]
    importance = sorted(zip(all_names, coefs.tolist()), key=lambda x: abs(x[1]), reverse=True)[:15]

    return jsonify([{'feature': n, 'coefficient': round(c, 4)} for n, c in importance])


@app.route('/api/employees')
def get_employees():
    filtered = apply_filters(risk_df)
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    risk_filter = request.args.get('risk_level', '')
    search = request.args.get('search', '').lower()

    if risk_filter:
        filtered = filtered[filtered['_risk_level'] == risk_filter]
    if search:
        mask = (
            filtered['Job Role'].str.lower().str.contains(search, na=False) |
            filtered['Department'].str.lower().str.contains(search, na=False) |
            filtered.get('emp no', pd.Series(dtype=str)).astype(str).str.lower().str.contains(search, na=False)
        )
        filtered = filtered[mask]

    total = len(filtered)
    filtered = filtered.sort_values('_risk_score', ascending=False)
    page_data = filtered.iloc[(page - 1) * per_page: page * per_page]

    employees = []
    for _, row in page_data.iterrows():
        employees.append({
            'emp_no': str(row.get('emp no', '')),
            'department': str(row['Department']),
            'job_role': str(row['Job Role']),
            'age': int(row['Age']),
            'gender': str(row['Gender']),
            'marital_status': str(row['Marital Status']),
            'overtime': str(row['Over Time']),
            'monthly_income': int(row['Monthly Income']),
            'actual_attrition': str(row['Attrition']),
            'risk_score': float(row['_risk_pct']),
            'risk_level': str(row['_risk_level']),
            'years_at_company': int(row.get('Years At Company', 0)),
            'job_satisfaction': int(row['Job Satisfaction']) if not pd.isna(row.get('Job Satisfaction', 0)) else 0
        })

    return jsonify({'employees': employees, 'total': total, 'page': page, 'per_page': per_page})


@app.route('/api/predict', methods=['POST'])
def predict():
    data = request.json or {}

    num_cols = [c for c in NUMERIC_FEATURES if c in df.columns]
    cat_cols = [c for c in CATEGORICAL_FEATURES if c in df.columns]

    input_row = {}
    for col in num_cols:
        input_row[col] = float(data.get(col, df[col].median()))
    for col in cat_cols:
        input_row[col] = str(data.get(col, df[col].mode()[0]))

    input_df = pd.DataFrame([input_row])[num_cols + cat_cols]
    prob = float(model.predict_proba(input_df)[0, 1])
    level = get_risk_level(prob)

    colors = {
        'Very High': '#ef4444', 'High': '#f97316',
        'Moderate': '#eab308', 'Low': '#22c55e', 'Very Low': '#3b82f6'
    }
    messages = {
        'Very High': 'Immediate intervention required. High probability of leaving.',
        'High': 'Proactive engagement needed. Schedule a retention discussion.',
        'Moderate': 'Monitor closely and offer growth opportunities.',
        'Low': 'Standard retention programs apply.',
        'Very Low': 'Employee is stable. Continue standard engagement.'
    }

    return jsonify({
        'probability': round(prob * 100, 1),
        'risk_level': level,
        'risk_color': colors[level],
        'recommendation': messages[level]
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
