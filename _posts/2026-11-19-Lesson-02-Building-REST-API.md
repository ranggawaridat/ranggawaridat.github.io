---
layout: post
title: "Lesson 02"
description: "Building REST API CRUD with Go and Chi"
date: 2026-11-19
categories: [golang, backend]
tags: [go, chi, crud, rest-api, backend-engineering]
series: "Go Backend Engineering"
lesson: 2
---

## 1. Introduction

Pada lesson sebelumnya, kita sudah membangun HTTP server sederhana menggunakan Go dan Chi.

Sekarang kita akan mulai membangun fitur utama TaskForge: **Task Management API**.

Kita akan mengimplementasikan CRUD:

- Create — membuat task baru.
- Read — membaca daftar atau detail task.
- Update — memperbarui task.
- Delete — menghapus task.

Pada lesson ini, data akan disimpan di memory menggunakan Go map. Kita belum menggunakan MySQL karena fokus kita adalah memahami alur CRUD dan pemisahan tanggung jawab setiap komponen.

Di lesson berikutnya, kita akan mengganti penyimpanan in-memory tersebut dengan MySQL.

### Learning objectives

Setelah menyelesaikan lesson ini, kamu akan memahami:

- Cara merancang REST endpoint untuk CRUD.
- Cara menerima dan memvalidasi JSON request.
- Cara menggunakan Chi URL parameters.
- Cara memisahkan handler, service, dan repository.
- Cara menggunakan interface untuk abstraction yang memang dibutuhkan.
- Cara melindungi shared data menggunakan `sync.RWMutex`.
- Cara mengembalikan HTTP status code yang sesuai.

---

## 2. REST API Design

Kita akan membuat resource bernama `tasks`.

Endpoint yang akan tersedia:

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/v1/tasks` | Membuat task |
| GET | `/api/v1/tasks` | Mengambil semua task |
| GET | `/api/v1/tasks/{taskID}` | Mengambil detail task |
| PUT | `/api/v1/tasks/{taskID}` | Mengganti data task |
| DELETE | `/api/v1/tasks/{taskID}` | Menghapus task |

Mengapa menggunakan `/tasks` dan bukan `/create-task`?

Karena REST API umumnya menggunakan resource-oriented URL. HTTP method sudah menjelaskan operasi yang ingin dilakukan.

Contoh:

```http
POST /api/v1/tasks
```

Artinya client ingin membuat resource task baru.

Sedangkan:

```http
GET /api/v1/tasks/10
```

Artinya client ingin membaca task dengan ID 10.

### Contoh JSON Task

```json
{
  "id": 1,
  "title": "Learn Go Backend",
  "description": "Build a production-ready API",
  "completed": false
}
```

---

## 3. Project Structure

Kita mempertahankan feature-based architecture dari lesson sebelumnya.

Struktur project:

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
│   ├── task/
│   │   ├── model.go
│   │   ├── dto.go
│   │   ├── repository.go
│   │   ├── memory_repository.go
│   │   ├── service.go
│   │   ├── handler.go
│   │   └── routes.go
│   │
│   └── router/
│       └── router.go
│
├── go.mod
└── go.sum
```

Tanggung jawab masing-masing file:

| File | Tanggung jawab |
|---|---|
| model.go | Struktur data Task |
| dto.go | Format request dan response |
| repository.go | Kontrak penyimpanan data |
| memory_repository.go | Implementasi penyimpanan in-memory |
| service.go | Business logic |
| handler.go | HTTP request dan response |
| routes.go | Pendaftaran endpoint |

Kita tidak membuat folder global `handlers`, `services`, atau `repositories`. Semua komponen milik fitur Task tetap berada di dalam `internal/task`.

---

## 4. Implementation

### 4.1 Task Model

Buat file:

`internal/task/model.go`

```go
package task

import "time"

type Task struct {
	ID          int64     `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Completed   bool      `json:"completed"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
```

Model merepresentasikan data utama yang digunakan fitur Task.

Kita menggunakan `int64` untuk ID dan `time.Time` untuk timestamp.

### 4.2 Request DTO

Buat file:

`internal/task/dto.go`

```go
package task

type CreateTaskRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type UpdateTaskRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Completed   bool   `json:"completed"`
}
```

DTO atau Data Transfer Object digunakan untuk mendefinisikan bentuk data yang diterima dari client.

Mengapa tidak langsung menerima `Task`?

Karena client tidak seharusnya menentukan field seperti:

- ID.
- CreatedAt.
- UpdatedAt.

Field tersebut merupakan tanggung jawab backend.

### 4.3 Repository Interface

Buat file:

`internal/task/repository.go`

```go
package task

import "context"

type Repository interface {
	Create(ctx context.Context, task Task) (Task, error)
	List(ctx context.Context) ([]Task, error)
	GetByID(ctx context.Context, id int64) (Task, error)
	Update(ctx context.Context, task Task) (Task, error)
	Delete(ctx context.Context, id int64) error
}
```

Repository merupakan kontrak untuk operasi penyimpanan data.

Mengapa kita menggunakan interface?

Karena implementasi penyimpanan dapat berubah.

Saat ini kita menggunakan memory repository. Pada lesson berikutnya, kita akan menggunakan MySQL.

Service cukup bergantung pada kontrak repository, bukan detail implementasi penyimpanannya.

Kita tidak perlu membuat interface untuk semua komponen. Interface ini memiliki tujuan konkret: memisahkan business logic dari teknologi penyimpanan.

### 4.4 In-Memory Repository

Buat file:

`internal/task/memory_repository.go`

```go
package task

import (
	"context"
	"errors"
	"sync"
	"time"
)

var ErrTaskNotFound = errors.New("task not found")

type MemoryRepository struct {
	mu     sync.RWMutex
	tasks  map[int64]Task
	nextID int64
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		tasks:  make(map[int64]Task),
		nextID: 1,
	}
}

func (r *MemoryRepository) Create(
	ctx context.Context,
	task Task,
) (Task, error) {
	if err := ctx.Err(); err != nil {
		return Task{}, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()

	task.ID = r.nextID
	task.CreatedAt = now
	task.UpdatedAt = now

	r.tasks[task.ID] = task
	r.nextID++

	return task, nil
}

func (r *MemoryRepository) List(
	ctx context.Context,
) ([]Task, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	tasks := make([]Task, 0, len(r.tasks))

	for _, task := range r.tasks {
		tasks = append(tasks, task)
	}

	return tasks, nil
}

func (r *MemoryRepository) GetByID(
	ctx context.Context,
	id int64,
) (Task, error) {
	if err := ctx.Err(); err != nil {
		return Task{}, err
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	task, exists := r.tasks[id]
	if !exists {
		return Task{}, ErrTaskNotFound
	}

	return task, nil
}

func (r *MemoryRepository) Update(
	ctx context.Context,
	task Task,
) (Task, error) {
	if err := ctx.Err(); err != nil {
		return Task{}, err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	existing, exists := r.tasks[task.ID]
	if !exists {
		return Task{}, ErrTaskNotFound
	}

	task.CreatedAt = existing.CreatedAt
	task.UpdatedAt = time.Now()

	r.tasks[task.ID] = task

	return task, nil
}

func (r *MemoryRepository) Delete(
	ctx context.Context,
	id int64,
) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.tasks[id]; !exists {
		return ErrTaskNotFound
	}

	delete(r.tasks, id)

	return nil
}
```

#### Memahami sync.RWMutex

Kita menggunakan:

```go
mu sync.RWMutex
```

Karena HTTP server dapat menangani beberapa request secara bersamaan.

Bayangkan beberapa client membaca dan mengubah data pada waktu yang sama. Tanpa synchronization, akses bersamaan ke Go map dapat menyebabkan data race.

`RWMutex` menyediakan dua jenis lock:

| Method | Fungsi |
|---|---|
| `RLock()` | Mengunci untuk pembacaan |
| `RUnlock()` | Melepaskan read lock |
| `Lock()` | Mengunci untuk penulisan |
| `Unlock()` | Melepaskan write lock |

Operasi membaca dapat berjalan bersamaan selama tidak ada write lock. Operasi penulisan membutuhkan exclusive lock.

Perhatikan bahwa mutex hanya melindungi akses ke map. Ia tidak membuat data menjadi permanen. Ketika aplikasi berhenti, seluruh data akan hilang.

### 4.5 Task Service

Buat file:

`internal/task/service.go`

```go
package task

import (
	"context"
	"errors"
	"strings"
)

var ErrInvalidTask = errors.New("invalid task")

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{
		repo: repo,
	}
}

func (s *Service) Create(
	ctx context.Context,
	req CreateTaskRequest,
) (Task, error) {
	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)

	if req.Title == "" {
		return Task{}, ErrInvalidTask
	}

	task := Task{
		Title:       req.Title,
		Description: req.Description,
		Completed:   false,
	}

	return s.repo.Create(ctx, task)
}

func (s *Service) List(
	ctx context.Context,
) ([]Task, error) {
	return s.repo.List(ctx)
}

func (s *Service) GetByID(
	ctx context.Context,
	id int64,
) (Task, error) {
	if id <= 0 {
		return Task{}, ErrInvalidTask
	}

	return s.repo.GetByID(ctx, id)
}

func (s *Service) Update(
	ctx context.Context,
	id int64,
	req UpdateTaskRequest,
) (Task, error) {
	if id <= 0 {
		return Task{}, ErrInvalidTask
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)

	if req.Title == "" {
		return Task{}, ErrInvalidTask
	}

	task := Task{
		ID:          id,
		Title:       req.Title,
		Description: req.Description,
		Completed:   req.Completed,
	}

	return s.repo.Update(ctx, task)
}

func (s *Service) Delete(
	ctx context.Context,
	id int64,
) error {
	if id <= 0 {
		return ErrInvalidTask
	}

	return s.repo.Delete(ctx, id)
}
```

Service bertanggung jawab terhadap business logic.

Contohnya:

- Title tidak boleh kosong.
- Whitespace dibersihkan.
- ID harus valid.
- Repository dipanggil setelah validasi berhasil.

Perhatikan bahwa service tidak mengetahui bagaimana data disimpan. Ia hanya menggunakan interface `Repository`.

### 4.6 Task HTTP Handler

Buat file:

`internal/task/handler.go`

```go
package task

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
	}
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateTaskRequest

	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	task, err := h.service.Create(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrInvalidTask) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}

		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusCreated, task)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	tasks, err := h.service.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, tasks)
}

func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, ok := parseTaskID(w, r)
	if !ok {
		return
	}

	task, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrInvalidTask) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}

		if errors.Is(err, ErrTaskNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}

		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, task)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseTaskID(w, r)
	if !ok {
		return
	}

	var req UpdateTaskRequest

	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	task, err := h.service.Update(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, ErrInvalidTask) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}

		if errors.Is(err, ErrTaskNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}

		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, task)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseTaskID(w, r)
	if !ok {
		return
	}

	err := h.service.Delete(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrInvalidTask) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}

		if errors.Is(err, ErrTaskNotFound) {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}

		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func parseTaskID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	rawID := chi.URLParam(r, "taskID")

	id, err := strconv.ParseInt(rawID, 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid task ID")
		return 0, false
	}

	return id, true
}

func decodeJSON(
	w http.ResponseWriter,
	r *http.Request,
	dst any,
) error {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(dst); err != nil {
		return err
	}

	var extra any

	if err := decoder.Decode(&extra); err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}

		return err
	}

	return errors.New("request body must contain only one JSON value")
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{
		"error": message,
	})
}
```

Tambahkan import `io` pada daftar import di bagian atas file:

```go
"io"
```

Kita menggunakan `io.EOF` untuk memastikan request body hanya berisi satu JSON value.

Beberapa perlindungan yang sudah diterapkan:

- `http.MaxBytesReader` membatasi ukuran request body menjadi 1 MB.
- `DisallowUnknownFields` menolak field JSON yang tidak dikenal.
- Decoder memeriksa agar tidak ada JSON tambahan setelah object pertama.
- ID diperiksa sebelum diteruskan ke service.

### 4.7 Task Routes

Buat file:

`internal/task/routes.go`

```go
package task

import (
	"github.com/go-chi/chi/v5"
)

func RegisterRoutes(r chi.Router, handler *Handler) {
	r.Route("/tasks", func(r chi.Router) {
		r.Post("/", handler.Create)
		r.Get("/", handler.List)

		r.Route("/{taskID}", func(r chi.Router) {
			r.Get("/", handler.GetByID)
			r.Put("/", handler.Update)
			r.Delete("/", handler.Delete)
		})
	})
}
```

Untuk menghindari ketidaksesuaian trailing slash pada URL, kita akan menggunakan route tanpa slash tambahan di akhir.

Gunakan versi berikut sebagai implementasi final:

```go
package task

import "github.com/go-chi/chi/v5"

func RegisterRoutes(r chi.Router, handler *Handler) {
	r.Route("/tasks", func(r chi.Router) {
		r.Post("/", handler.Create)
		r.Get("/", handler.List)

		r.Get("/{taskID}", handler.GetByID)
		r.Put("/{taskID}", handler.Update)
		r.Delete("/{taskID}", handler.Delete)
	})
}
```

### 4.8 Update Main Router

Buka:

`internal/router/router.go`

Ganti dengan:

```go
package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/yourusername/taskforge/internal/health"
	"github.com/yourusername/taskforge/internal/task"
)

func New() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	health.RegisterRoutes(r)

	taskRepository := task.NewMemoryRepository()
	taskService := task.NewService(taskRepository)
	taskHandler := task.NewHandler(taskService)

	r.Route("/api/v1", func(r chi.Router) {
		task.RegisterRoutes(r, taskHandler)
	})

	return r
}
```

Perhatikan alur dependency:

```text
MemoryRepository
      |
      v
   Service
      |
      v
   Handler
      |
      v
     Router
```

Router bertugas menyusun dependency dan mendaftarkan route. Business logic tetap berada di service.

### 4.9 Main Application

File `cmd/api/main.go` dari lesson sebelumnya tetap digunakan.

```go
package main

import (
	"log"
	"net/http"
	"time"

	"github.com/yourusername/taskforge/internal/router"
)

func main() {
	server := &http.Server{
		Addr:              ":8080",
		Handler:           router.New(),
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

Pastikan semua import menggunakan module path yang sama dengan `go.mod`.

---

## 5. Running the Application

Jalankan:

```bash
go mod tidy
go run ./cmd/api
```

Server akan berjalan di:

```text
http://localhost:8080
```

Endpoint Task berada di bawah prefix:

```text
/api/v1
```

---

## 6. Testing with cURL

### 6.1 Create Task

```bash
curl -i -X POST http://localhost:8080/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Learn Go Backend",
    "description": "Build a production-ready API"
  }'
```

Expected response:

```json
{
  "id": 1,
  "title": "Learn Go Backend",
  "description": "Build a production-ready API",
  "completed": false,
  "created_at": "2026-11-19T09:00:00Z",
  "updated_at": "2026-11-19T09:00:00Z"
}
```

Timestamp di atas hanya contoh. Nilai sebenarnya berasal dari waktu server.

HTTP status:

```text
201 Created
```

### 6.2 List Tasks

```bash
curl -i http://localhost:8080/api/v1/tasks
```

Expected response:

```json
[
  {
    "id": 1,
    "title": "Learn Go Backend",
    "description": "Build a production-ready API",
    "completed": false,
    "created_at": "2026-11-19T09:00:00Z",
    "updated_at": "2026-11-19T09:00:00Z"
  }
]
```

HTTP status:

```text
200 OK
```

### 6.3 Get Task by ID

```bash
curl -i http://localhost:8080/api/v1/tasks/1
```

HTTP status:

```text
200 OK
```

### 6.4 Update Task

```bash
curl -i -X PUT http://localhost:8080/api/v1/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Master Go Backend",
    "description": "Build scalable APIs",
    "completed": true
  }'
```

HTTP status:

```text
200 OK
```

PUT mengganti representasi task berdasarkan data yang dikirim. Karena itu, seluruh field yang diwajibkan oleh DTO update harus disertakan.

### 6.5 Delete Task

```bash
curl -i -X DELETE http://localhost:8080/api/v1/tasks/1
```

HTTP status:

```text
204 No Content
```

### 6.6 Test Invalid Request

Coba membuat task tanpa title:

```bash
curl -i -X POST http://localhost:8080/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Task without title"
  }'
```

Expected response:

```json
{
  "error": "invalid task"
}
```

HTTP status:

```text
400 Bad Request
```

### 6.7 Test Not Found

```bash
curl -i http://localhost:8080/api/v1/tasks/999
```

Expected status:

```text
404 Not Found
```

---

## 7. Understanding the Architecture

Sekarang kita sudah memiliki empat bagian utama.

### Handler

Menerima HTTP request, membaca JSON, memanggil service, dan mengembalikan HTTP response.

### Service

Menjalankan business logic dan validasi.

### Repository

Mengatur operasi penyimpanan data.

### Router

Mendaftarkan endpoint dan menyusun dependency.

Alur Create Task:

```text
Client
  |
  | POST /api/v1/tasks
  v
Chi Router
  |
  v
Task Handler
  |
  | CreateTaskRequest
  v
Task Service
  |
  | Validate title
  v
Task Repository
  |
  | Save Task
  v
Memory Map
  |
  v
HTTP 201 Created
```

Pemisahan ini membuat kita bisa mengganti penyimpanan data tanpa perlu mengubah seluruh business logic.

---

## 8. Best Practices

### 8.1 Jangan Percayai Input Client

Client dapat mengirimkan data kosong, salah format, atau terlalu besar.

Validasi input harus dilakukan sebelum data diproses lebih lanjut.

### 8.2 Gunakan Context

Kita meneruskan `r.Context()` dari handler ke service dan repository.

Context memungkinkan pembatalan operasi ketika request dibatalkan atau deadline tercapai.

### 8.3 Lindungi Shared State

Go map tidak aman untuk akses concurrent tanpa synchronization.

Gunakan mutex atau mekanisme concurrency-safe lainnya.

### 8.4 Gunakan DTO

Jangan membiarkan client mengendalikan field internal seperti ID dan timestamp.

### 8.5 Hindari Kebocoran Error Internal

Jangan mengirim detail error database atau informasi internal server kepada client.

Pada aplikasi production, error internal sebaiknya dicatat melalui structured logging.

### 8.6 Ingat Keterbatasan In-Memory Storage

Memory repository hanya cocok untuk pembelajaran dan testing sederhana.

Data akan hilang ketika aplikasi berhenti, dan beberapa instance aplikasi tidak akan berbagi penyimpanan yang sama.

---

## 9. Common Mistakes

1. Menaruh seluruh business logic di handler.
2. Menggunakan Go map tanpa mutex.
3. Tidak memvalidasi ID dari URL.
4. Mengizinkan client mengubah ID dan timestamp.
5. Tidak membatasi ukuran request body.
6. Mengembalikan HTTP 200 untuk semua kondisi.
7. Menganggap in-memory repository cocok untuk production.
8. Membuat interface tanpa tujuan yang jelas.

---

## 10. Lesson Summary

Pada lesson ini kita berhasil membangun Task Management REST API menggunakan Go dan Chi.

Fitur yang sudah tersedia:

- Create Task.
- List Tasks.
- Get Task by ID.
- Update Task.
- Delete Task.
- JSON request dan response.
- Input validation.
- HTTP status code handling.
- Feature-based architecture.
- In-memory repository.
- Concurrent access protection menggunakan `sync.RWMutex`.

### Checklist pembelajaran

- [ ] Memahami CRUD.
- [ ] Memahami REST resource endpoint.
- [ ] Memahami DTO dan model.
- [ ] Memahami repository interface.
- [ ] Memahami memory repository.
- [ ] Memahami `sync.RWMutex`.
- [ ] Memahami business logic pada service.
- [ ] Memahami HTTP handler.
- [ ] Memahami Chi URL parameters.
- [ ] Berhasil menguji seluruh endpoint menggunakan cURL.

---

## 11. References

- [Go net/http](https://pkg.go.dev/net/http)
- [Go encoding/json](https://pkg.go.dev/encoding/json)
- [Go sync](https://pkg.go.dev/sync)
- [Go context](https://pkg.go.dev/context)
- [Chi Router](https://github.com/go-chi/chi)
- [HTTP Semantics — RFC 9110](https://www.rfc-editor.org/rfc/rfc9110)

---

## Next Lesson

**Lesson 03 — MySQL Integration with Go**

Kita akan mengganti memory repository dengan MySQL menggunakan:

- `database/sql`
- MySQL driver
- SQL queries
- Database connection pooling
- Database migrations dengan golang-migrate
- Repository implementation menggunakan MySQL

Setelah lesson berikutnya, TaskForge tidak lagi kehilangan seluruh data ketika server dimatikan.