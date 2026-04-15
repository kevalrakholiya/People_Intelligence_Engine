# 🚀 HR Analytics | Employee Attrition & Workforce Intelligence

A data-driven HR Analytics solution designed to uncover **employee attrition drivers, workforce trends, and retention strategies** using statistical analysis, visualization, and machine learning.

This project integrates **Python-based analytics, Excel dashboards, and business-driven insights** to simulate real-world HR decision-making environments.

---

## 📌 Project Overview

Organizations lose significant revenue due to employee turnover. This project leverages **HR data (1,470 employees, 39 features)** to:

- Identify **attrition patterns across workforce segments**
- Analyze **key drivers impacting employee retention**
- Build a **predictive model to forecast attrition risk**
- Deliver **actionable insights for HR leaders**

---

## 🎯 Business Objectives

This analysis answers critical HR questions:

- What is the **attrition rate** across departments, age groups, and gender?
- Which **roles and education fields** are most impacted?
- How do **salary, overtime, and job satisfaction** influence employee exits?
- What are the **top predictors of attrition risk**?
- How can HR teams implement **data-driven retention strategies**?

---

## 📊 Dataset Summary

- **Total Employees:** 1,470  
- **Features:** 39  
- **Target Variable:** Attrition (Yes/No)  

Key attributes include:
- Demographics (Age, Gender, Marital Status)
- Job-related factors (Department, Role, Income, Overtime)
- Performance & engagement (Job Satisfaction, Work-Life Balance)

---

## 📈 Key Metrics (KPIs)

- **Attrition Rate:** 16.12%  
- **Total Attrition:** 237 employees  
- **Active Employees:** 1,233  
- **Average Age:** 37  

### Attrition Breakdown:
- **By Gender:** Male (150) | Female (87)  
- **By Department:**
  - R&D → 56%
  - Sales → 39%
  - HR → 5%

---

## 📊 Dashboard & Visualization

### Excel Dashboard
An interactive dashboard built using:
- Pivot Tables & Dynamic Charts
- Slicers for segmentation (department, gender, education)
- KPI tracking for executive insights

### Tableau Dashboard
Advanced visualization including:
- Department-wise attrition trends
- Job satisfaction by role
- Age distribution and workforce segmentation
- Education field analysis

---

## 🔍 Key Insights

- **Overtime** is the strongest driver of attrition  
- **Low salary employees** have significantly higher exit rates  
- **Low job satisfaction** directly correlates with resignation  
- **Short tenure employees** are at higher risk  
- **Frequent business travel** increases attrition probability  

---

## 💡 Strategic Recommendations

- Optimize **work-life balance policies** to reduce overtime impact  
- Implement **compensation adjustments** for low-income roles  
- Launch **employee engagement & satisfaction programs**  
- Strengthen **onboarding and early-career support**  
- Provide **flexible work or travel policies**  
- Integrate attrition insights into **HRIS platforms (Workday, SAP, Oracle HCM)**  

---

## 🤖 Predictive Modeling

A **Logistic Regression model** was developed to predict employee attrition:

- **Model Accuracy:** ~78%  
- **Top Predictors:**
  - Overtime
  - Job Satisfaction
  - Monthly Income
  - Business Travel
  - Years at Company  

### Generated Outputs:
- KPI summaries  
- Visual analytics charts  
- Model evaluation reports  
- Feature importance analysis  

---

## 🛠️ Tech Stack

- **Python** → pandas, matplotlib, scikit-learn  
- **Excel** → Dashboard & KPI visualization  
- **Tableau** → Advanced BI reporting  
- **HRIS Concepts** → SAP SuccessFactors, Workday  

---

## ⚙️ How to Run

```bash
# Clone the repository
git clone https://github.com/kevalrakholiya/HR_Analytics
cd HR_Analytics

# Install dependencies
pip install -r requirements.txt

# Run analysis script
python main.py
