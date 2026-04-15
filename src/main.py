import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix

import os, json

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA = os.path.join(BASE_DIR, "data", "hr_employees.csv")
OUT = os.path.join(BASE_DIR, "outputs")
os.makedirs(OUT, exist_ok=True)

df = pd.read_csv(DATA)

# Basic KPIs
headcount = len(df)
attrition_rate = (df["Attrition"].eq("Yes").mean()*100).round(2)
by_dept = df.groupby("Department")["Attrition"].apply(lambda s: (s.eq("Yes").mean()*100)).round(2).sort_values(ascending=False)
by_gender = df.groupby("Gender")["Attrition"].apply(lambda s: (s.eq("Yes").mean()*100)).round(2).sort_values(ascending=False)

kpi = {
    "headcount": int(headcount),
    "attrition_rate_pct": float(attrition_rate),
    "attrition_by_department_pct": by_dept.to_dict(),
    "attrition_by_gender_pct": by_gender.to_dict()
}

with open(os.path.join(OUT, "kpi.json"), "w") as f:
    json.dump(kpi, f, indent=2)

# Plots (no seaborn, separate figures)
plt.figure()
by_dept.plot(kind="bar")
plt.title("Attrition Rate by Department (%)")
plt.ylabel("Attrition Rate (%)")
plt.tight_layout()
plt.savefig(os.path.join(OUT, "attrition_by_department.png"))
plt.close()

plt.figure()
df.boxplot(column="MonthlyIncome", by="Attrition")
plt.title("Monthly Income by Attrition")
plt.suptitle("")
plt.xlabel("Attrition")
plt.ylabel("Monthly Income")
plt.tight_layout()
plt.savefig(os.path.join(OUT, "income_by_attrition.png"))
plt.close()

plt.figure()
# Scatter: YearsAtCompany vs MonthlyIncome, color by Attrition (simulate with markers)
colors = df["Attrition"].map({"Yes": 1, "No": 0})
plt.scatter(df["YearsAtCompany"], df["MonthlyIncome"], s=18, alpha=0.6)
plt.title("Years at Company vs Monthly Income")
plt.xlabel("YearsAtCompany")
plt.ylabel("MonthlyIncome")
plt.tight_layout()
plt.savefig(os.path.join(OUT, "years_vs_income.png"))
plt.close()

# Simple Logistic Regression
X = df.drop(columns=["Attrition", "EmployeeID"])
y = df["Attrition"].map({"Yes":1, "No":0})

num_cols = X.select_dtypes(include=[np.number]).columns.tolist()
cat_cols = X.select_dtypes(exclude=[np.number]).columns.tolist()

pre = ColumnTransformer([
    ("num", "passthrough", num_cols),
    ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols)
])

model = Pipeline([
    ("prep", pre),
    ("clf", LogisticRegression(max_iter=1000))
])

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
model.fit(X_train, y_train)
pred = model.predict(X_test)

report = classification_report(y_test, pred, output_dict=False)
cm = confusion_matrix(y_test, pred)

with open(os.path.join(OUT, "model_report.txt"), "w") as f:
    f.write("Classification Report:\n")
    f.write(classification_report(y_test, pred))
    f.write("\nConfusion Matrix:\n")
    f.write(str(cm))

# Attempt to extract top coefficients (approximate; get linear model coef_ with feature names)
prep = model.named_steps["prep"]
clf = model.named_steps["clf"]
feature_names = num_cols + list(prep.named_transformers_["cat"].get_feature_names_out(cat_cols))
coefs = clf.coef_[0]
imp = pd.Series(coefs, index=feature_names).sort_values(key=lambda s: s.abs(), ascending=False).head(15)
imp.to_csv(os.path.join(OUT, "top_feature_coefficients.csv"))
