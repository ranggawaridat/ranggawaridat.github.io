---
layout: post
title: "Lesson 01"
description: "REST API Fundamentals with Go and Chi"
date: 2026-11-19
categories: [golang, backend]
tags: [go, chi, rest-api, http, backend-engineering]
series: "Go Backend Engineering"
lesson: 1
---

## 1. Introduction

Pada lesson pertama, kita akan membangun fondasi backend menggunakan Go dan Chi.

Kita tidak langsung membuat CRUD atau menghubungkan database. Fokus kali ini adalah memahami bagaimana HTTP server bekerja, bagaimana REST API disusun, dan bagaimana Go menangani HTTP request.

Di akhir lesson, kita akan memiliki API sederhana dengan endpoint:

```http
GET /healthz
```

Endpoint ini digunakan untuk memeriksa apakah aplikasi sedang berjalan.

### Learning objectives

Setelah menyelesaikan lesson ini, kamu akan memahami:

- Cara kerja HTTP request dan response.
- Perbedaan HTTP method.
- Struktur dasar REST API.
- Cara membuat HTTP server menggunakan Go.
- Cara menggunakan Chi sebagai HTTP router.
- Cara memisahkan feature dan konfigurasi router.
- Cara menguji API menggunakan cURL.

---

## 2. REST API Fundamentals

REST merupakan architectural style untuk membangun sistem yang berkomunikasi melalui HTTP.

Dalam REST API, client mengirimkan HTTP request kepada server, kemudian server memproses request dan mengembalikan HTTP response.

Contoh alur komunikasi:

```text
Client
  |
  | GET /healthz
  v
Go HTTP Server
  |
  v
Chi Router
  |
  v
Health Handler
  |
  v
HTTP Response
```

### HTTP request

HTTP request terdiri dari beberapa bagian:

```http
GET /healthz HTTP/1.1
Host: localhost:8080
Accept: application/json
```

Bagian-bagiannya:

| Komponen | Fungsi |
|---|---|
| Method | Menentukan jenis operasi |
| Path | Menentukan endpoint |
| HTTP Version | Versi protokol HTTP |
| Headers | Metadata request |
| Body | Data yang dikirim client, jika diperlukan |

### HTTP methods

HTTP method menentukan tindakan yang ingin dilakukan client.

| Method | Tujuan | Contoh |
|---|---|---|
| GET | Membaca data | GET /tasks |
| POST | Membuat resource | POST /tasks |
| PUT | Mengganti resource | PUT /tasks/1 |
| PATCH | Memperbarui sebagian data | PATCH /tasks/1 |
| DELETE | Menghapus resource | DELETE /tasks/1 |

Kita akan menggunakan method-method tersebut pada lesson CRUD berikutnya.

### HTTP status codes

Server menggunakan status code untuk menjelaskan hasil pemrosesan request.

| Status | Makna |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

Contohnya, ketika client berhasil meminta status aplikasi, server dapat mengembalikan `200 OK`.

---

## 3. Project Structure

Kita akan membangun project bernama **TaskForge**.

TaskForge nantinya berkembang menjadi production-ready task management API.

Kita menggunakan pendekatan feature-based architecture atau vertical-slice modular monolith.

Artinya, kode dikelompokkan berdasarkan fitur, bukan berdasarkan jenis layer secara global.

Struktur awal:

```text
taskforge/
├── cmd/
│   └── api/
│       └── main.go
│
├── internal/
│   ├── health/
│   │   ├── handler.go
│   │   └── routes.go
│   │
│   └── router/
│       └── router.go
│
├── go.mod
└── go.sum
```

Penjelasan:

| Path | Tanggung jawab |
|---|---|
| cmd/api | Entry point aplikasi |
| internal/health | Implementasi health endpoint |
| internal/router | Menggabungkan seluruh route |
| go.mod | Dependency dan module project |
| go.sum | Checksum dependency |

Mengapa tidak membuat folder `handlers`, `services`, dan `repositories` dari awal?

Karena project kita akan berkembang berdasarkan fitur. Ketika fitur Task ditambahkan, seluruh komponen yang berkaitan dengannya dapat dikelompokkan dalam satu package.

Kita juga tidak perlu membuat service dan repository untuk endpoint sederhana yang belum membutuhkan keduanya.

---

## 4. Dependencies

Pastikan Go sudah terinstall.

Periksa versi Go:

```bash
go version
```

Buat project:

```bash
mkdir taskforge
cd taskforge
```

Inisialisasi Go module:

```bash
go mod init github.com/yourusername/taskforge
```

Ganti `yourusername` dengan username atau module path milikmu.

Install Chi:

```bash
go get github.com/go-chi/chi/v5
```

Chi adalah lightweight HTTP router untuk Go yang dibangun di atas standard library `net/http`.

Kita memilih Chi karena sederhana, fleksibel, dan tidak memaksa penggunaan struktur framework tertentu.

---

## 5. Implementation

### 5.1 Membuat Health Handler

Buat file:

`internal/health/handler.go`

```go
package health

import (
	"encoding/json"
	"net/http"
)

type HealthResponse struct {
	Status string `json:"status"`
}

func Check(w http.ResponseWriter, r *http.Request) {
	response := HealthResponse{
		Status: "ok",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	if err := json.NewEncoder(w).Encode(response); err != nil {
		return
	}
}
```

Mari pahami bagian pentingnya.

**1. `http.ResponseWriter`**

Digunakan untuk menulis HTTP response kepada client.

**2. `*http.Request`**

Berisi informasi mengenai HTTP request yang diterima server.

**3. `json.NewEncoder(w)`**

Mengubah Go value menjadi JSON dan menuliskannya langsung ke response writer.

**4. `http.StatusOK`**

Mengirim HTTP status code 200.

Handler ini sengaja dibuat sederhana. Kita belum membutuhkan database, service, ataupun repository untuk memeriksa status aplikasi.

### 5.2 Membuat Health Routes

Buat file:

`internal/health/routes.go`

```go
package health

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router) {
	r.Get("/healthz", Check)
}
```

File ini bertanggung jawab mendaftarkan endpoint milik fitur health.

Dengan cara ini, ketika fitur lain ditambahkan, setiap fitur dapat mendaftarkan route-nya sendiri.

### 5.3 Membuat Router

Buat file:

`internal/router/router.go`

```go
package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/yourusername/taskforge/internal/health"
)

func New() http.Handler {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Feature routes
	health.RegisterRoutes(r)

	return r
}
```

Router merupakan composition point untuk seluruh HTTP route aplikasi.

Kita juga memasang beberapa middleware bawaan Chi.

| Middleware | Fungsi |
|---|---|
| RequestID | Memberikan ID pada setiap request |
| RealIP | Membaca alamat IP client |
| Logger | Mencatat HTTP request |
| Recoverer | Memulihkan server dari panic pada handler |

Middleware akan dibahas lebih dalam ketika aplikasi mulai berkembang.

### 5.4 Membuat Application Entry Point

Buat file:

`cmd/api/main.go`

```go
package main

import (
	"log"
	"net/http"
	"time"

	"github.com/yourusername/taskforge/internal/router"
)

func main() {
	handler := router.New()

	server := &http.Server{
		Addr:              ":8080",
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Println("TaskForge API running on :8080")

	if err := server.ListenAndServe(); err != nil &&
		err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
```

Beberapa hal penting:

**`http.Server`**

Digunakan untuk mengonfigurasi HTTP server.

**`Addr`**

Menentukan alamat dan port server. Pada contoh ini, server berjalan di port `8080`.

**`Handler`**

Menentukan handler utama yang akan menerima request. Kita memberikan router Chi.

**`ReadHeaderTimeout`**

Membatasi waktu server untuk membaca HTTP request headers.

**`IdleTimeout`**

Menentukan batas waktu koneksi idle sebelum ditutup.

**`ListenAndServe()`**

Menjalankan HTTP server dan mulai menerima koneksi dari client.

---

## 6. Running the Application

Pastikan struktur project sudah seperti berikut:

```text
taskforge/
├── cmd/
│   └── api/
│       └── main.go
├── internal/
│   ├── health/
│   │   ├── handler.go
│   │   └── routes.go
│   └── router/
│       └── router.go
├── go.mod
└── go.sum
```

Jalankan aplikasi:

```bash
go mod tidy
go run ./cmd/api
```

Jika berhasil, terminal akan menampilkan:

```text
TaskForge API running on :8080
```

Sekarang server sudah berjalan dan siap menerima HTTP request.

---

## 7. Testing with cURL

Buka terminal baru.

Kirim request:

```bash
curl -i http://localhost:8080/healthz
```

Response yang diharapkan:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok"}
```

Flag `-i` digunakan agar cURL menampilkan HTTP response headers beserta response body.

### Menguji endpoint yang tidak tersedia

Coba:

```bash
curl -i http://localhost:8080/unknown
```

Response yang diharapkan:

```http
HTTP/1.1 404 Not Found
```

Ini menunjukkan bahwa Chi tidak menemukan route yang sesuai dengan request.

---

## 8. Best Practices

Beberapa prinsip yang perlu mulai diterapkan:

### 8.1 Gunakan `net/http`

Go sudah menyediakan HTTP server dan HTTP handler melalui standard library.

Chi hanya membantu routing dan middleware. Kita tetap menggunakan fondasi HTTP dari Go.

### 8.2 Pisahkan route berdasarkan fitur

Hindari menempatkan seluruh route dalam satu file besar.

Setiap fitur nantinya memiliki tanggung jawab masing-masing.

Contoh ketika TaskForge berkembang:

```text
internal/
├── health/
│   ├── handler.go
│   └── routes.go
│
├── task/
│   ├── handler.go
│   ├── routes.go
│   ├── service.go
│   └── repository.go
│
└── user/
    ├── handler.go
    └── routes.go
```

### 8.3 Jangan membuat abstraksi terlalu awal

Tidak semua handler membutuhkan service.

Tidak semua struct membutuhkan interface.

Tambahkan abstraksi ketika memang ada kebutuhan nyata, bukan sekadar agar struktur terlihat kompleks.

### 8.4 Gunakan HTTP status code yang tepat

Jangan selalu mengembalikan `200 OK`.

Status code merupakan bagian dari kontrak API antara client dan server.

### 8.5 Jangan mencampur liveness dan readiness

Endpoint `/healthz` pada lesson ini hanya memeriksa apakah aplikasi dapat merespons request.

Pada sistem production, readiness check dapat dibuat terpisah untuk memeriksa apakah aplikasi siap menerima traffic, termasuk ketergantungan seperti database.

---

## 9. Common Mistakes

**1. Menaruh seluruh kode di `main.go`**

Untuk aplikasi yang berkembang, hal ini membuat entry point sulit dipelihara.

**2. Menggunakan HTTP method secara sembarangan**

Misalnya menggunakan GET untuk membuat atau menghapus data.

**3. Menganggap router sebagai HTTP server**

Chi adalah router, bukan pengganti HTTP server dari standard library.

**4. Membuat terlalu banyak layer sejak awal**

Jangan membuat service, repository, interface, dan helper jika belum ada kebutuhan.

**5. Tidak mengatur HTTP server timeout**

Server sebaiknya memiliki konfigurasi timeout yang sesuai agar tidak menerima koneksi yang menggantung tanpa batas.

---

## 10. Lesson Summary

Pada lesson ini kita sudah membangun HTTP server pertama untuk TaskForge menggunakan Go dan Chi.

Komponen yang sudah dibuat:

- HTTP server menggunakan `net/http`.
- Routing menggunakan Chi.
- Health endpoint menggunakan HTTP GET.
- JSON response.
- Global middleware.
- Feature-based project structure.
- HTTP server timeout configuration.

Arsitektur aplikasi saat ini:

```text
HTTP Client
    |
    v
HTTP Server
    |
    v
Chi Router
    |
    +---- Middleware
    |
    v
Health Routes
    |
    v
Health Handler
    |
    v
JSON Response
```

### Checklist pembelajaran

- [ ] Memahami HTTP request dan response.
- [ ] Memahami HTTP methods.
- [ ] Memahami HTTP status codes.
- [ ] Memahami fungsi Chi.
- [ ] Memahami `http.Handler`.
- [ ] Memahami `http.ResponseWriter`.
- [ ] Memahami `http.Request`.
- [ ] Memahami middleware.
- [ ] Berhasil menjalankan TaskForge.
- [ ] Berhasil menguji `/healthz` menggunakan cURL.

---

## 11. References

- [Go Documentation](https://go.dev/doc/)
- [Go net/http Package](https://pkg.go.dev/net/http)
- [Chi Router Documentation](https://github.com/go-chi/chi)
- [HTTP Semantics — RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)

---

## Next Lesson

**Lesson 02 — Building REST API CRUD with Go and Chi**

Pada lesson berikutnya, kita akan mulai membangun fitur Task dengan operasi:

- Create Task
- List Tasks
- Get Task by ID
- Update Task
- Delete Task

Kita akan menggunakan feature-based architecture dan in-memory repository terlebih dahulu sebelum mengintegrasikan MySQL pada lesson berikutnya.

Project TaskForge akan berkembang sedikit demi sedikit, seperti membangun sebuah rumah: fondasinya harus kokoh sebelum kita menambahkan lantai berikutnya.