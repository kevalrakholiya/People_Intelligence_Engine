from flask import Flask, render_template, jsonify, request
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, recall_score, precision_score, f1_score
import os

app = Flask(__name__)

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
EDU_ORDER = ['High School', 'Associates Degree', "Bachelor's Degree", "Master's Degree", 'Doctoral Degree']

# Column name map: client key → DataFrame column (for sort)
COL_MAP = {
    'emp_no': 'emp no', 'department': 'Department', 'job_role': 'Job Role',
    'age': 'Age', 'gender': 'Gender', 'overtime': 'Over Time',
    'monthly_income': 'Monthly Income', 'actual_attrition': 'Attrition',
    'risk_score': '_risk_pct', 'risk_level': '_risk_level',
    'years_at_company': 'Years At Company', 'job_satisfaction': 'Job Satisfaction',
    'marital_status': 'Marital Status',
}

df = None
model = None
risk_df = None
model_metrics_cache = {}


def get_risk_level(p):
    if p >= 0.85: return 'Very High'
    if p >= 0.70: return 'High'
    if p >= 0.50: return 'Moderate'
    if p >= 0.30: return 'Low'
    return 'Very Low'


RISK_COLORS = {
    'Very High': '#dc2626', 'High': '#ea580c',
    'Moderate': '#d97706', 'Low': '#16a34a', 'Very Low': '#2563eb'
}
RISK_MESSAGES = {
    'Very High': 'Immediate intervention required. This employee has a very high probability of leaving.',
    'High': 'Proactive engagement needed. Schedule a retention discussion soon.',
    'Moderate': 'Monitor closely. Consider offering growth opportunities or recognition.',
    'Low': 'Standard retention programs apply. Keep engagement initiatives active.',
    'Very Low': 'Employee appears stable. Maintain regular check-ins.'
}


def load_data():
    global df
    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'HR_Analytics_clean.csv')
    df = pd.read_csv(data_path)


def train_model():
    global model, risk_df, model_metrics_cache
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
        ('classifier', RandomForestClassifier(
            n_estimators=400, max_depth=12, min_samples_leaf=5,
            class_weight={0: 1, 1: 3},
            random_state=42, n_jobs=-1
        ))
    ])
    model.fit(X, y)

    probs = model.predict_proba(X)[:, 1]
    risk_df = df.copy()
    risk_df['_risk_score'] = probs
    risk_df['_risk_level'] = risk_df['_risk_score'].apply(get_risk_level)
    risk_df['_risk_pct'] = (risk_df['_risk_score'] * 100).round(1)

    y_pred = model.predict(X)
    model_metrics_cache = {
        'accuracy':  round(float(accuracy_score(y, y_pred))  * 100, 1),
        'recall':    round(float(recall_score(y, y_pred))    * 100, 1),
        'precision': round(float(precision_score(y, y_pred)) * 100, 1),
        'f1':        round(float(f1_score(y, y_pred))        * 100, 1),
        'algorithm': 'Random Forest',
        'training_samples': len(X),
        'total_features': len(num_cols) + len(cat_cols),
    }


load_data()
train_model()


def apply_filters(data):
    dept    = request.args.get('department', '')
    gender  = request.args.get('gender', '')
    age_min = int(request.args.get('age_min', 18))
    age_max = int(request.args.get('age_max', 60))
    role    = request.args.get('job_role', '')
    marital = request.args.get('marital_status', '')
    ot      = request.args.get('overtime', '')

    f = data.copy()
    if dept:    f = f[f['Department']    == dept]
    if gender:  f = f[f['Gender']        == gender]
    if role:    f = f[f['Job Role']      == role]
    if marital: f = f[f['Marital Status']== marital]
    if ot:      f = f[f['Over Time']     == ot]
    f = f[(f['Age'] >= age_min) & (f['Age'] <= age_max)]
    return f


def _emp_row(row):
    js = row.get('Job Satisfaction', 0)
    return {
        'emp_no':           str(row.get('emp no', '')),
        'department':       str(row['Department']),
        'job_role':         str(row['Job Role']),
        'age':              int(row['Age']),
        'gender':           str(row['Gender']),
        'marital_status':   str(row['Marital Status']),
        'overtime':         str(row['Over Time']),
        'monthly_income':   int(row['Monthly Income']),
        'actual_attrition': str(row['Attrition']),
        'risk_score':       float(row['_risk_pct']),
        'risk_level':       str(row['_risk_level']),
        'years_at_company': int(row.get('Years At Company', 0)),
        'job_satisfaction': int(js) if not pd.isna(js) else 0,
    }


# ── Routes ─────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/filter-options')
def filter_options():
    return jsonify({
        'departments':     sorted(df['Department'].dropna().unique().tolist()),
        'genders':         sorted(df['Gender'].dropna().unique().tolist()),
        'job_roles':       sorted(df['Job Role'].dropna().unique().tolist()),
        'marital_statuses':sorted(df['Marital Status'].dropna().unique().tolist()),
        'age_min': int(df['Age'].min()),
        'age_max': int(df['Age'].max()),
    })


@app.route('/api/kpis')
def api_kpis():
    f = apply_filters(risk_df)
    total = len(f)
    if total == 0:
        return jsonify({k: 0 for k in ['total_employees','attrition_count','active_employees',
                                        'attrition_rate','avg_age','avg_monthly_income','high_risk_count',
                                        'avg_tenure','avg_satisfaction']})
    att = int((f['Attrition'] == 'Yes').sum())
    return jsonify({
        'total_employees':   int(total),
        'attrition_count':   att,
        'active_employees':  int(total - att),
        'attrition_rate':    round(att / total * 100, 2),
        'avg_age':           round(float(f['Age'].mean()), 1),
        'avg_monthly_income':int(f['Monthly Income'].mean()),
        'high_risk_count':   int((f['_risk_score'] >= 0.70).sum()),
        'avg_tenure':        round(float(f['Years At Company'].mean()), 1),
        'avg_satisfaction':  round(float(f['Job Satisfaction'].mean()), 2),
    })


@app.route('/api/key-insights')
def key_insights():
    f = apply_filters(risk_df)
    if len(f) == 0:
        return jsonify({'pros': [], 'cons': []})

    total = len(f)
    attrition_rate = (f['Attrition'] == 'Yes').mean() * 100
    pros, cons = [], []

    # Overtime impact
    ot_y = f[f['Over Time'] == 'Yes']; ot_n = f[f['Over Time'] == 'No']
    if len(ot_y) > 0 and len(ot_n) > 0:
        ry = (ot_y['Attrition'] == 'Yes').mean() * 100
        rn = (ot_n['Attrition'] == 'Yes').mean() * 100
        mult = round(ry / rn, 1) if rn > 0 else 0
        cons.append(f'Overtime employees leave at {ry:.1f}% vs {rn:.1f}% for non-overtime — {mult}× higher risk.')

    # Department risk
    dept_r = f.groupby('Department').apply(lambda x: (x['Attrition'] == 'Yes').mean() * 100).sort_values()
    if len(dept_r) >= 2:
        best = dept_r.index[0]; worst = dept_r.index[-1]
        pros.append(f'{best} has the strongest retention at {dept_r.iloc[0]:.1f}% attrition rate.')
        cons.append(f'{worst} has the highest attrition at {dept_r.iloc[-1]:.1f}% — targeted intervention recommended.')

    # Marital status
    sng = f[f['Marital Status'] == 'Single']; mar = f[f['Marital Status'] == 'Married']
    if len(sng) > 0 and len(mar) > 0:
        rs = (sng['Attrition'] == 'Yes').mean() * 100
        rm = (mar['Attrition'] == 'Yes').mean() * 100
        cons.append(f'Single employees leave at {rs:.1f}% — {rs - rm:.1f} pts above married employees ({rm:.1f}%).')

    # Income
    med = f['Monthly Income'].median()
    low_inc = f[f['Monthly Income'] < med]; high_inc = f[f['Monthly Income'] >= med]
    if len(low_inc) > 0 and len(high_inc) > 0:
        rl = (low_inc['Attrition'] == 'Yes').mean() * 100
        rh = (high_inc['Attrition'] == 'Yes').mean() * 100
        cons.append(f'Below-median earners (< ${int(med):,}/mo) leave at {rl:.1f}% vs {rh:.1f}% for higher earners.')

    # Tenure (pro and con)
    early = f[f['Years At Company'] < 2]; senior = f[f['Years At Company'] >= 5]
    if len(early) > 0 and len(senior) > 0:
        re = (early['Attrition'] == 'Yes').mean() * 100
        rs2 = (senior['Attrition'] == 'Yes').mean() * 100
        cons.append(f'New joiners (< 2 yrs) have {re:.1f}% attrition — {re - rs2:.1f} pts above 5+ year employees.')
        pros.append(f'Employees with 5+ years tenure show strong loyalty at only {rs2:.1f}% attrition.')

    # Job satisfaction (pro)
    hi_sat = f[f['Job Satisfaction'] >= 3]; lo_sat = f[f['Job Satisfaction'] <= 2]
    if len(hi_sat) > 0 and len(lo_sat) > 0:
        rhs = (hi_sat['Attrition'] == 'Yes').mean() * 100
        rls = (lo_sat['Attrition'] == 'Yes').mean() * 100
        pros.append(f'Highly satisfied employees (score 3–4) leave at just {rhs:.1f}% vs {rls:.1f}% for low satisfaction.')

    # Active workforce (pro)
    active_pct = round((f['Attrition'] == 'No').mean() * 100, 1)
    pros.append(f'{active_pct}% of the workforce ({int((f["Attrition"] == "No").sum()):,} employees) remains actively employed.')

    return jsonify({'pros': pros[:4], 'cons': cons[:4]})


@app.route('/api/attrition-by-role')
def attrition_by_role():
    f = apply_filters(risk_df)
    result = []
    for role, g in f.groupby('Job Role'):
        total = len(g); att = int((g['Attrition']=='Yes').sum())
        result.append({
            'job_role':     str(role),
            'total':        int(total),
            'attrition':    att,
            'active':       int(total - att),
            'rate':         round(att / total * 100, 1) if total else 0,
            'avg_risk_pct': round(float(g['_risk_score'].mean()) * 100, 1),
            'avg_income':   int(g['Monthly Income'].mean()),
            'avg_tenure':   round(float(g['Years At Company'].mean()), 1),
        })
    result.sort(key=lambda x: x['rate'], reverse=True)
    return jsonify(result)


@app.route('/api/charts/attrition-overview')
def attrition_overview():
    f = apply_filters(risk_df)
    yes = int((f['Attrition']=='Yes').sum()); no = int((f['Attrition']=='No').sum())
    return jsonify({'Yes': yes, 'No': no, 'rate': round(yes/(yes+no)*100,2) if (yes+no) else 0})


@app.route('/api/charts/attrition-by-department')
def attrition_by_dept():
    f = apply_filters(risk_df)
    result = {}
    for dept, g in f.groupby('Department'):
        total = len(g); att = int((g['Attrition']=='Yes').sum())
        result[str(dept)] = {'total': int(total), 'attrition': att, 'active': int(total-att),
                              'rate': round(att/total*100, 2) if total else 0}
    return jsonify(result)


@app.route('/api/charts/age-distribution')
def age_distribution():
    f = apply_filters(risk_df)
    bins   = [18, 25, 30, 35, 40, 45, 50, 55, 61]
    labels = ['18-24','25-29','30-34','35-39','40-44','45-49','50-54','55+']
    yh, _  = np.histogram(f[f['Attrition']=='Yes']['Age'].dropna(), bins=bins)
    nh, _  = np.histogram(f[f['Attrition']=='No']['Age'].dropna(),  bins=bins)
    return jsonify({'labels': labels, 'attrition': yh.tolist(), 'retained': nh.tolist()})


@app.route('/api/charts/overtime-impact')
def overtime_impact():
    f = apply_filters(risk_df)
    result = {}
    for ot, g in f.groupby('Over Time'):
        total = len(g); att = int((g['Attrition']=='Yes').sum())
        result[str(ot)] = {'total': int(total), 'attrition': att,
                            'retained': int(total-att), 'rate': round(att/total*100, 2) if total else 0}
    return jsonify(result)


@app.route('/api/charts/job-satisfaction')
def job_satisfaction():
    f = apply_filters(risk_df)
    result = {}
    for role, g in f.groupby('Job Role'):
        avg = g['Job Satisfaction'].mean()
        result[str(role)] = {
            'avg_satisfaction': round(float(avg), 2) if not pd.isna(avg) else 0,
            'attrition_rate':   round((g['Attrition']=='Yes').mean()*100, 2),
            'count': int(len(g))
        }
    return jsonify(result)


@app.route('/api/charts/risk-distribution')
def risk_distribution():
    f = apply_filters(risk_df)
    levels = ['Very Low','Low','Moderate','High','Very High']
    result = {}
    for dept, g in f.groupby('Department'):
        counts = g['_risk_level'].value_counts()
        result[str(dept)] = {lv: int(counts.get(lv, 0)) for lv in levels}
    return jsonify(result)


@app.route('/api/charts/income-by-attrition')
def income_by_attrition():
    f = apply_filters(risk_df)
    result = {}
    for dept, g in f.groupby('Department'):
        yi = g[g['Attrition']=='Yes']['Monthly Income'].mean()
        ni = g[g['Attrition']=='No']['Monthly Income'].mean()
        result[str(dept)] = {'yes_avg': int(yi) if not pd.isna(yi) else 0,
                              'no_avg':  int(ni) if not pd.isna(ni) else 0}
    return jsonify(result)


@app.route('/api/charts/marital-attrition')
def marital_attrition():
    f = apply_filters(risk_df)
    result = {}
    for status, g in f.groupby('Marital Status'):
        total = len(g); att = int((g['Attrition']=='Yes').sum())
        result[str(status)] = {'total': int(total), 'attrition': att,
                                'retained': int(total-att), 'rate': round(att/total*100, 2) if total else 0}
    return jsonify(result)


@app.route('/api/charts/business-travel')
def business_travel():
    f = apply_filters(risk_df)
    result = {}
    travel_labels = {'Non-Travel': 'No Travel', 'Travel_Rarely': 'Travels Rarely', 'Travel_Frequently': 'Travels Frequently'}
    for travel, g in f.groupby('Business Travel'):
        total = len(g); att = int((g['Attrition']=='Yes').sum())
        label = travel_labels.get(str(travel), str(travel))
        result[label] = {'total': int(total), 'attrition': att,
                         'retained': int(total-att), 'rate': round(att/total*100, 1) if total else 0}
    return jsonify(result)


@app.route('/api/charts/education-level')
def education_level():
    f = apply_filters(risk_df)
    result = {}
    edu_labels = {
        'High School': 'High School',
        'Associates Degree': "Associate's",
        "Bachelor's Degree": "Bachelor's",
        "Master's Degree": "Master's",
        'Doctoral Degree': 'Doctoral'
    }
    for edu in EDU_ORDER:
        g = f[f['Education'] == edu]
        if len(g) == 0: continue
        total = len(g); att = int((g['Attrition']=='Yes').sum())
        result[edu_labels.get(edu, edu)] = {'total': int(total), 'attrition': att,
                                             'retained': int(total-att), 'rate': round(att/total*100, 1)}
    return jsonify(result)


@app.route('/api/charts/job-level')
def job_level():
    f = apply_filters(risk_df)
    result = {}
    jl_labels = {1: 'Entry (1)', 2: 'Junior (2)', 3: 'Mid (3)', 4: 'Senior (4)', 5: 'Executive (5)'}
    for level in sorted(f['Job Level'].dropna().unique()):
        g = f[f['Job Level'] == level]; total = len(g); att = int((g['Attrition']=='Yes').sum())
        label = jl_labels.get(int(level), str(int(level)))
        result[label] = {'total': int(total), 'attrition': att,
                         'retained': int(total-att), 'rate': round(att/total*100, 1)}
    return jsonify(result)


@app.route('/api/feature-importance')
def feature_importance():
    classifier  = model.named_steps['classifier']
    preprocessor = model.named_steps['preprocessor']
    num_cols = [c for c in NUMERIC_FEATURES if c in df.columns]
    cat_cols = [c for c in CATEGORICAL_FEATURES if c in df.columns]
    cat_names = preprocessor.named_transformers_['cat'].get_feature_names_out(cat_cols).tolist()

    # Friendly labels
    label_map = {
        'Over Time_Yes': 'Overtime: Yes', 'Over Time_No': 'Overtime: No',
        'Marital Status_Single': 'Marital Status: Single',
        'Marital Status_Married': 'Marital Status: Married',
        'Marital Status_Divorced': 'Marital Status: Divorced',
        'Business Travel_Travel_Frequently': 'Business Travel: Frequent',
        'Business Travel_Travel_Rarely': 'Business Travel: Rare',
        'Business Travel_Non-Travel': 'Business Travel: None',
        'Department_Sales': 'Department: Sales',
        'Department_R&D': 'Department: R&D',
        'Department_HR': 'Department: HR',
    }

    importances = classifier.feature_importances_
    all_names = num_cols + cat_names
    importance = sorted(zip(all_names, importances.tolist()), key=lambda x: x[1], reverse=True)[:15]
    return jsonify([{'feature': label_map.get(n, n), 'coefficient': round(c, 4)} for n, c in importance])


@app.route('/api/employees')
def get_employees():
    filtered = apply_filters(risk_df)
    page       = int(request.args.get('page', 1))
    per_page   = int(request.args.get('per_page', 50))
    risk_filter= request.args.get('risk_level', '')
    search     = request.args.get('search', '').lower()
    sort_param = request.args.get('sort', 'risk_score')
    dirs_param = request.args.get('dirs', 'desc')

    if risk_filter:
        filtered = filtered[filtered['_risk_level'] == risk_filter]
    if search:
        mask = (
            filtered['Job Role'].str.lower().str.contains(search, na=False) |
            filtered['Department'].str.lower().str.contains(search, na=False) |
            filtered.get('emp no', pd.Series(dtype=str)).astype(str).str.lower().str.contains(search, na=False)
        )
        filtered = filtered[mask]

    # Multi-column sort
    sort_keys = [COL_MAP.get(k.strip(), '_risk_pct') for k in sort_param.split(',')]
    sort_asc   = [d.strip() == 'asc' for d in dirs_param.split(',')]
    valid = [(k, a) for k, a in zip(sort_keys, sort_asc) if k in filtered.columns]
    if valid:
        cols, ascs = zip(*valid)
        filtered = filtered.sort_values(list(cols), ascending=list(ascs))
    else:
        filtered = filtered.sort_values('_risk_score', ascending=False)

    total = len(filtered)
    page_data = filtered.iloc[(page-1)*per_page : page*per_page]
    return jsonify({
        'employees': [_emp_row(r) for _, r in page_data.iterrows()],
        'total': total, 'page': page, 'per_page': per_page
    })


@app.route('/api/predict', methods=['POST'])
def predict():
    data = request.json or {}
    num_cols = [c for c in NUMERIC_FEATURES if c in df.columns]
    cat_cols = [c for c in CATEGORICAL_FEATURES if c in df.columns]

    row = {}
    for c in num_cols: row[c] = float(data.get(c, df[c].median()))
    for c in cat_cols: row[c] = str(data.get(c, df[c].mode()[0]))

    inp  = pd.DataFrame([row])[num_cols + cat_cols]
    prob = float(model.predict_proba(inp)[0, 1])
    level = get_risk_level(prob)
    return jsonify({
        'probability':    round(prob * 100, 1),
        'risk_level':     level,
        'risk_color':     RISK_COLORS[level],
        'recommendation': RISK_MESSAGES[level]
    })


@app.route('/api/similar-employees', methods=['POST'])
def similar_employees():
    data = request.json or {}
    dept     = data.get('department', data.get('Department', ''))
    role     = data.get('job_role',   data.get('Job Role', ''))
    overtime = data.get('overtime',   data.get('Over Time', ''))
    job_sat  = data.get('job_satisfaction')
    years_co = data.get('years_at_company')
    income   = data.get('monthly_income')
    job_lvl  = data.get('job_level')
    marital  = data.get('marital_status', data.get('Marital Status', ''))

    filtered = risk_df.copy()

    # Exact attribute matches
    if dept:     filtered = filtered[filtered['Department']    == dept]
    if role:     filtered = filtered[filtered['Job Role']      == role]
    if overtime: filtered = filtered[filtered['Over Time']     == overtime]
    if marital:  filtered = filtered[filtered['Marital Status']== marital]

    # Range-based attribute matches
    if job_sat is not None:
        js = int(job_sat)
        filtered = filtered[(filtered['Job Satisfaction'] >= max(1, js-1)) &
                            (filtered['Job Satisfaction'] <= min(4, js+1))]
    if years_co is not None:
        yc = int(years_co)
        filtered = filtered[(filtered['Years At Company'] >= max(0, yc-3)) &
                            (filtered['Years At Company'] <= yc+3)]
    if job_lvl is not None:
        jl = int(job_lvl)
        filtered = filtered[(filtered['Job Level'] >= max(1, jl-1)) &
                            (filtered['Job Level'] <= min(5, jl+1))]
    if income is not None:
        inc = float(income)
        filtered = filtered[(filtered['Monthly Income'] >= inc * 0.65) &
                            (filtered['Monthly Income'] <= inc * 1.55)]

    # Relax constraints if too few results
    if len(filtered) < 5:
        filtered = risk_df.copy()
        if dept:     filtered = filtered[filtered['Department'] == dept]
        if role:     filtered = filtered[filtered['Job Role']   == role]
        if overtime: filtered = filtered[filtered['Over Time']  == overtime]

    filtered = filtered.sort_values('_risk_score', ascending=False).head(20)
    return jsonify([_emp_row(r) for _, r in filtered.iterrows()])


@app.route('/api/department-roles')
def department_roles():
    result = {}
    for dept, g in df.groupby('Department'):
        result[str(dept)] = sorted(g['Job Role'].dropna().unique().tolist())
    return jsonify(result)


@app.route('/api/model-metrics')
def api_model_metrics():
    return jsonify(model_metrics_cache)


@app.route('/api/risk-summary')
def api_risk_summary():
    f = apply_filters(risk_df)
    total = len(f)
    levels = ['Very High', 'High', 'Moderate', 'Low', 'Very Low']
    result = {}
    for lv in levels:
        cnt = int((f['_risk_level'] == lv).sum())
        result[lv] = {'count': cnt, 'pct': round(cnt/total*100, 1) if total else 0}
    return jsonify(result)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
