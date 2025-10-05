# Linear Regression dari Nol

## Tujuan
Memahami konsep slope & intercept tanpa library.

## Metode
- Dataset: luas rumah & harga
- Hitung slope & intercept manual

```python
import numpy as np

x = np.array([30, 40, 50, 60, 70])
y = np.array([80, 100, 120, 140, 160])

a = np.sum((x - np.mean(x))*(y - np.mean(y))) / np.sum((x - np.mean(x))**2)
b = np.mean(y) - a*np.mean(x)
print(a, b)

Hasil:
Slope: 2.0
Intercept: 20.0

Kesimpulan:
Cukup mudah dipahami untuk dataset sederhana.

Langkah selanjutnya:
uji dataset lebih besar.
