---
layout: post
title: "Eksperimen Linear Regression vs Scikit-learn"
date: 2025-10-05
categories: [experiments]
tags: [linear-regression, sklearn, python]
---

## 🎯 Tujuan
Menguji Linear Regression manual vs `sklearn.LinearRegression`.

## 🧩 Dataset
| Luas (m²) | Harga (juta) |
|-----------|---------------|
| 30        | 80            |
| 40        | 100           |
| 50        | 120           |
| 60        | 140           |
| 70        | 160           |

## ⚙️ Metode
1. Hitung slope & intercept manual  
2. Latih model `sklearn.LinearRegression`  
3. Visualisasikan hasil prediksi

```python
from sklearn.linear_model import LinearRegression

X = x.reshape(-1,1)
model = LinearRegression()
model.fit(X, y)
print(model.coef_, model.intercept_)
