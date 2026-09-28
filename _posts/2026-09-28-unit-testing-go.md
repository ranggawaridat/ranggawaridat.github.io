---
layout: post
title: "Unit Testing Go"
date: 2026-09-28
description: "Catatan dasar tentang unit testing di Go, pola Arrange-Act-Assert, error handling, dan penggunaan fake repository."
---

## Apa itu Unit Testing?

Testing bagian kecil dari program secara terpisah.

Tujuannya:

> Memastikan function atau logic bekerja sesuai yang diharapkan.

---

## Basic Test

File test harus:

```text
*_test.go
```

Contoh:

```go
func Add(a, b int) int {
	return a + b
}
```

Test:

```go
func TestAdd(t *testing.T) {
	result := Add(2, 3)

	if result != 5 {
		t.Errorf("expected 5, got %d", result)
	}
}
```

Jalankan:

```bash
go test
```

---

## `t.Errorf()` vs `t.Fatal()`

### `t.Errorf()`

Melaporkan error, tapi test masih lanjut.

```go
t.Errorf("expected 5, got %d", result)
```

### `t.Fatal()`

Melaporkan error dan langsung menghentikan test.

```go
t.Fatal("result is nil")
```

**Singkatnya:**

```text
Error → lanjut
Fatal → berhenti
```

---

## Pola Test

Ingat:

```text
Arrange → Act → Assert
```

```go
// Arrange
a := 2
b := 3

// Act
result := Add(a, b)

// Assert
if result != 5 {
	t.Errorf("expected 5, got %d", result)
}
```

---

## Test Error

Kalau function mengembalikan error:

```go
err := ValidateTitle("")
```

Untuk memastikan error terjadi:

```go
if err == nil {
	t.Fatal("expected error")
}
```

Untuk memastikan tidak ada error:

```go
if err != nil {
	t.Errorf("unexpected error: %v", err)
}
```

---

## Testing Service

Misalnya:

```text
Handler
   ↓
Service
   ↓
Repository
```

Saat mengetes **Service**, kita biasanya tidak perlu menggunakan database asli.

Gunakan:

```text
Service
   ↓
Fake / Mock Repository
```

Tujuannya supaya test fokus ke **logic service**.

---

## Kenapa Interface Berguna?

Contoh:

```go
type Repository interface {
	Create(title string) error
}
```

Service:

```go
type service struct {
	repo Repository
}
```

Karena menggunakan interface, repository bisa diganti dengan fake saat testing.

```text
Real Repository → Database

Fake Repository → Unit Test
```

---

## Command Penting

Test package saat ini:

```bash
go test
```

Test semua package:

```bash
go test ./...
```

Test dengan detail:

```bash
go test -v
```

Test function tertentu:

```bash
go test -run TestAdd
```

Coverage:

```bash
go test -cover
```

---

## Yang Perlu Diingat

```text
Unit Test
    ↓
Test bagian kecil
    ↓
Function / Method
    ↓
Input → Function → Output
    ↓
Bandingkan dengan expected result
```

**Tujuan utama:**

> Bukan membuat banyak test, tapi memastikan behavior penting dari program tetap benar.

Test juga berguna saat **refactoring**, karena membantu memastikan perubahan kode tidak merusak behavior yang sudah ada.
