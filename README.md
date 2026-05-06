# People Intelligence Engine

An end-to-end **HR Analytics & Attrition Prediction** platform — interactive web dashboard + ML model — analysing workforce data for 1,470 employees to identify attrition drivers and predict individual turnover risk.

---

## Repository Structure

```
People_Intelligence_Engine/
├── data/                         # Raw and cleaned datasets
│   ├── HR_Analytics_clean.csv    # Cleaned employee dataset (1,470 × 44)
│   └── HR Analytics.xlsx         # Excel workbook with pivot dashboards
│
├── notebooks/                    # Jupyter notebooks
│   └── Predictive_model.ipynb    # ML model development & EDA
│
├── tableau/                      # Tableau workbook
│   └── HR Analysis Dashbaord.twbx
│
├── images/                       # Dashboard screenshots & roadmap
│
└── dashboard/                    # ★ Web dashboard application
    ├── app.py                    # Flask backend + REST ML API
    ├── requirements.txt
    ├── templates/index.html      # Single-page dashboard UI
    └── static/                   # CSS + JavaScript
```

---

## Web Dashboard — Quick Start

```bash
cd dashboard
pip install -r requirements.txt
python app.py
# Open http://localhost:5000
```

### Features

**Overview Tab** — 7 KPI cards + 8 interactive charts (all update on filter change):
- Attrition overview, attrition by department, age distribution histogram
- Overtime impact, job satisfaction by role, marital status analysis
- Income vs attrition, risk distribution, ML feature importance

**ML Predictions Tab** — Configure any employee profile (18 inputs) to get:
- Animated risk gauge + probability score from the trained model
- Risk level classification (Very High → Very Low)
- Personalised recommendation + risk signal breakdown

**Employee Risk Tab** — All 1,470 employees ranked by predicted risk:
- Filter by risk level, search by role/department, paginated table

**Sidebar Filters** — Department, Gender, Job Role, Marital Status, Overtime, Age range — apply globally to every chart simultaneously.

---

## ML Model

- **Algorithm**: Logistic Regression (balanced class weights, StandardScaler)
- **Input**: 22 numeric + 8 categorical features (OneHotEncoded)
- **Performance**: ~77% accuracy, 71% recall on attrition class

### Top Attrition Drivers

| Driver | Effect |
|---|---|
| Overtime (Yes) | Strongest predictor of leaving |
| Marital Status (Single) | Higher attrition risk |
| Environment Satisfaction | Higher = less attrition |
| Stock Option Level | Higher = more retention |
| Job Satisfaction | Higher = more retention |
| Years Since Last Promotion | Longer gap = higher risk |

### Risk Stratification

| Level | Threshold |
|---|---|
| Very High | ≥ 85% |
| High | ≥ 70% |
| Moderate | ≥ 50% |
| Low | ≥ 30% |
| Very Low | < 30% |

---

## Dataset

IBM HR Analytics — 1,470 employees × 44 columns covering demographics, job attributes, compensation, engagement metrics, and career history.

- **Overall attrition rate: 16.12%** (237 of 1,470)
- Highest attrition: Sales (20.6%), HR (19.1%), R&D (13.8%)

---

## Key Insights

- Overtime is the single strongest attrition predictor
- Lower income correlates with higher turnover
- Low job/environment satisfaction directly drives exits
- Singles and frequent travellers show elevated attrition risk
- Long gaps since last promotion significantly increase risk

---

## Original Dashboards

- **Excel** (`data/HR Analytics.xlsx`) — Pivot tables, KPI slicers, dynamic charts
- **Tableau** (`tableau/HR Analysis Dashbaord.twbx`) — Multi-dimensional workforce visualisations

---

## Tech Stack

Python · Flask · scikit-learn · pandas · numpy · Chart.js · Excel · Tableau

---

## How to Run

```bash
# Clone the repository
git clone https://github.com/kevalrakholiya/People_Intelligence_Engine
cd People_Intelligence_Engine

# Install dependencies
pip install -r dashboard/requirements.txt

# Launch the dashboard
cd dashboard && python app.py
# Open http://localhost:5000
```
