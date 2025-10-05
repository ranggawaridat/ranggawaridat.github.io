---
layout: post
title: "Linear Regression dari Nol"
date: 2025-10-05
categories: [experiments]
tags: [linear-regression, ml, python]
---

## 🎯 Tujuan
Mencoba memahami Linear Regression tanpa library.

## ⚙️ Metode
- Buat dataset kecil: luas rumah dan harga
- Hitung slope & intercept manual

```python
import numpy as np

x = np.array([30, 40, 50, 60, 70])
y = np.array([80, 100, 120, 140, 160])

x_mean = np.mean(x)
y_mean = np.mean(y)

a = np.sum((x - x_mean)*(y - y_mean)) / np.sum((x - x_mean)**2)
b = y_mean - a*x_mean
print("Slope:", a, "Intercept:", b)
