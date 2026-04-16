# People Intelligence Engine | Workforce Analytics & Attrition Prediction

## Overview

The People Intelligence Engine is a data-driven workforce analytics solution built to identify employee attrition patterns and predict turnover risk. The project combines business intelligence dashboards with a machine learning model to support proactive HR decision-making.

Using a dataset of 1,470 employees with 39 features, the solution delivers both descriptive insights and predictive outputs to help organizations reduce attrition and improve workforce planning.

---

## Objectives

- Analyze employee attrition across departments, demographics, and roles  
- Identify key factors influencing employee turnover  
- Build a predictive model to estimate attrition risk levels  
- Deliver actionable insights for improving employee retention  

---

## Dataset

- Total Records: 1,470 employees  
- Features: 39  
- Target Variable: Attrition (Yes/No)  

### Data Categories:
- Demographics: Age, Gender, Marital Status  
- Job Attributes: Department, Role, Monthly Income, Overtime  
- Engagement Metrics: Job Satisfaction, Work-Life Balance  

---

## Key Metrics

- Attrition Rate: 16.12%  
- Total Attrition: 237 employees  
- Active Employees: 1,233  
- Average Age: 37  

### Attrition Distribution:
- Gender: Male (150), Female (87)  
- Department:
  - R&D: 56%  
  - Sales: 39%  
  - HR: 5%  

---

## Dashboard & Visualization

### Excel Dashboard
- Built using Pivot Tables and dynamic charts  
- Includes KPI tracking and interactive slicers  
- Enables filtering by department, gender, and education  

### Tableau Dashboard
- Visualizes attrition trends across departments  
- Job satisfaction analysis by role  
- Workforce segmentation by age and education  
- Business-focused storytelling for decision-making  

---

## Key Insights

- Overtime is the strongest contributor to attrition  
- Employees with lower income levels have higher turnover rates  
- Low job satisfaction is directly linked to employee exits  
- Employees with shorter tenure show higher attrition risk  
- Frequent business travel increases likelihood of attrition  

---

## Predictive Modeling

A Logistic Regression model was developed to predict employee attrition risk.

### Model Performance:
- Accuracy: ~78%  

### Key Features:
- Overtime  
- Job Satisfaction  
- Monthly Income  
- Business Travel  
- Years at Company  

### Output:
- Classification of employees into Low, Medium, and High attrition risk  
- Feature importance analysis  
- Model evaluation metrics  

---

## Business Recommendations

- Reduce overtime through workload optimization  
- Review compensation strategies for low-income roles  
- Improve employee engagement and satisfaction programs  
- Strengthen onboarding for new employees  
- Introduce flexible work and travel policies  

---

## Tech Stack

- Python (pandas, NumPy, matplotlib, scikit-learn)  
- Excel (dashboard development and KPI tracking)  
- Tableau (data visualization and reporting)  
- Machine Learning (Logistic Regression)  

---

## How to Run

```bash
# Clone the repository
git clone https://github.com/kevalrakholiya/People_Intelligence_Engine

# Navigate to the project folder
cd HR_Analytics

# Install dependencies
pip install -r requirements.txt
