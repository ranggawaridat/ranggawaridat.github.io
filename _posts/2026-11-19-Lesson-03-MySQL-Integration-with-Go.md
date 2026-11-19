---
layout: post
title: "Lesson 03"
description: "MySQL Integration with Go"
date: 2026-11-19
categories: [golang, backend, database]
tags: [go, mysql, database-sql, golang-migrate, backend-engineering]
series: "Go Backend Engineering"
lesson: 3
---

## 1. Introduction

Pada lesson sebelumnya, kita sudah membangun TaskForge dengan fitur CRUD menggunakan Go dan Chi.

Namun, ada satu masalah besar: data masih disimpan di memory.

Artinya:
- Data hilang ketika aplikasi berhenti.
- Data tidak dapat dibagikan antar-instance aplikasi.
- Penyimpanan belum cocok untuk aplikasi production.

Sekarang kita akan mengintegrasikan MySQL sebagai persistent database.

Kita akan menggunakan:

| Technology | Fungsi |
|---|---|
| Go | Backend language |
| MySQL | Relational database |
| database/sql | Database interface dari Go |
| go-sql-driver/mysql | MySQL driver |
| golang-migrate | Database migration |

Kita tidak akan mengganti arsitektur TaskForge. Kita hanya mengganti implementasi repository dari memory menjadi MySQL.

### Learning objectives

Setelah menyelesaikan lesson ini, kamu akan memahami:

- Cara menghubungkan Go dengan MySQL.
- Cara menggunakan `database/sql`.
- Cara mengatur database connection pool.
- Cara menjalankan SQL query dari Go.
- Cara menggunakan prepared statements melalui parameterized queries.
- Cara melakukan database migration.
- Cara menangani database errors.
- Cara memisahkan database configuration dari business logic.

---

## 2. Understanding database/sql

Go menyediakan package standard library bernama `database/sql`.

Package ini menyediakan interface umum untuk berkomunikasi dengan database SQL.

Namun, `database/sql` tidak menyediakan driver MySQL secara langsung.

Kita membutuhkan driver tambahan:

```bash
go get github.com/go-sql-driver/mysql
```

Arsitektur koneksinya:

```text
Task Handler
     |
     v
Task Service
     |
     v
Task Repository
     |
     v
database/sql
     |
     v
MySQL Driver
     |
     v
MySQL Database
```

Perhatikan bahwa service tetap menggunakan repository interface.

Artinya, business logic tidak perlu mengetahui apakah data disimpan di memory, MySQL, atau database lainnya.

---

## 3. Database Setup

Pastikan MySQL sudah terinstall dan server MySQL sedang berjalan.

Buat database:

```sql
CREATE DATABASE taskforge
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

Buat user khusus aplikasi:

```sql
CREATE USER 'taskforge_user'@'localhost'
IDENTIFIED BY 'change-this-password';
```

Berikan akses:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP
ON taskforge.*
TO 'taskforge_user'@'localhost';
```

Untuk production, pisahkan hak akses user aplikasi dan user migration. User aplikasi sebaiknya tidak memiliki izin DDL seperti CREATE, ALTER, dan DROP.

Gunakan password yang kuat dan jangan menyimpannya di source code.

### 3.1 Database Connection Configuration

Kita akan menggunakan environment variables.

Contoh untuk Linux/macOS:

```bash
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_USER=taskforge_user
export DB_PASSWORD=change-this-password
export DB_NAME=taskforge
```

Untuk PowerShell:

```powershell
$env:DB_HOST="127.0.0.1"
$env:DB_PORT="3306"
$env:DB_USER="taskforge_user"
$env:DB_PASSWORD="change-this-password"
$env:DB_NAME="taskforge"
```

Jangan commit password asli ke Git.

---

## 4. Database Migration

Kita tidak akan membuat tabel secara manual setiap kali aplikasi dijalankan.

Sebagai gantinya, kita menggunakan database migration.

Migration adalah mekanisme untuk mengelola perubahan struktur database secara terkontrol dan berurutan.

Install golang-migrate CLI sesuai sistem operasi:

Dokumentasi instalasi:

https://github.com/golang-migrate/migrate/tree/master/cmd/migrate

Buat folder migration:

```bash
mkdir -p migrations
```

Struktur project:

```text
taskforge/
├── cmd/
│   └── api/
│       └── main.go
│
├── internal/
│   ├── health/
│   ├── task/
│   └── router/
│
├── migrations/
├── go.mod
└── go.sum
```

### 4.1 Create Migration

Buat file:

`migrations/000001_create_tasks_table.up.sql`

```sql
CREATE TABLE tasks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,

    PRIMARY KEY (id),

    INDEX idx_tasks_completed (completed),
    INDEX idx_tasks_created_at (created_at)
);
```

Penjelasan:

| Column | Fungsi |
|---|---|
| id | Primary key |
| title | Judul task |
| description | Deskripsi task |
| completed | Status penyelesaian |
| created_at | Waktu pembuatan |
| updated_at | Waktu perubahan terakhir |

Kita menggunakan `BIGINT UNSIGNED` untuk ID agar kapasitas ID lebih besar dan tidak menerima nilai negatif.

### 4.2 Create Down Migration

Buat file:

`migrations/000001_create_tasks_table.down.sql`

```sql
DROP TABLE tasks;
```

File `up` digunakan untuk menerapkan perubahan.

File `down` digunakan untuk membatalkan perubahan tersebut.

**Peringatan:** menjalankan down migration ini akan menghapus tabel beserta seluruh datanya.

### 4.3 Run Migration

Jalankan:

```bash
migrate \
  -path migrations \
  -database "mysql://taskforge_user:change-this-password@tcp(127.0.0.1:3306)/taskforge" \
  up
```

Untuk password yang mengandung karakter khusus, gunakan URL encoding atau mekanisme konfigurasi credential yang aman.

Periksa tabel:

```sql
USE taskforge;

SHOW TABLES;

DESCRIBE tasks;
```

Sekarang tabel `tasks` sudah tersedia.

---

## 5. Database Connection in Go

Buat folder:

```text
internal/
└── platform/
    └── database/
        └── mysql.go
```

`internal/platform/database/mysql.go`

```go
package database

import (
    "context"
    "database/sql"
    "fmt"
    "os"
    "time"

    _ "github.com/go-sql-driver/mysql"
)

func NewMySQL(ctx context.Context) (*sql.DB, error) {
    host := os.Getenv("DB_HOST")
    port := os.Getenv("DB_PORT")
    user := os.Getenv("DB_USER")
    password := os.Getenv("DB_PASSWORD")
    name := os.Getenv("DB_NAME")

    if host == "" || port == "" || user == "" || name == "" {
        return nil, fmt.Errorf("database configuration is incomplete")
    }

    cfg := fmt.Sprintf(
        "%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true&loc=UTC",
        user,
        password,
        host,
        port,
        name,
    )

    db, err := sql.Open("mysql", cfg)
    if err != nil {
        return nil, fmt.Errorf("open mysql connection: %w", err)
    }

    db.SetMaxOpenConns(25)
    db.SetMaxIdleConns(10)
    db.SetConnMaxLifetime(5 * time.Minute)
    db.SetConnMaxIdleTime(2 * time.Minute)

    pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()

    if err := db.PingContext(pingCtx); err != nil {
        db.Close()
        return nil, fmt.Errorf("ping mysql: %w", err)
    }

    return db, nil
}
```

### 5.1 Understanding sql.Open

```go
db, err := sql.Open("mysql", cfg)
```

Fungsi ini membuat database handle.

`sql.Open` tidak selalu langsung membuat koneksi jaringan ke MySQL. Koneksi aktual dapat dibuat ketika diperlukan.

Karena itu, kita menggunakan:

```go
db.PingContext(ctx)
```

untuk memastikan database benar-benar dapat dijangkau.

### 5.2 Understanding Connection Pool

Kita mengatur:

```go
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(10)
db.SetConnMaxLifetime(5 * time.Minute)
db.SetConnMaxIdleTime(2 * time.Minute)
```

Penjelasan:

| Configuration | Fungsi |
|---|---|
| MaxOpenConns | Batas maksimum koneksi terbuka |
| MaxIdleConns | Batas koneksi idle yang dipertahankan |
| ConnMaxLifetime | Umur maksimum koneksi |
| ConnMaxIdleTime | Lama koneksi boleh idle |

Connection pool memungkinkan aplikasi menggunakan kembali koneksi database tanpa selalu membuat koneksi baru.

Angka di atas adalah konfigurasi awal untuk pembelajaran, bukan angka universal untuk production. Nilainya harus disesuaikan dengan kapasitas MySQL dan jumlah instance aplikasi.

---

## 6. MySQL Repository

Sekarang kita mengganti memory repository dengan implementasi MySQL.

Interface `Repository` dari lesson sebelumnya tetap digunakan.

Buat file:

`internal/task/mysql_repository.go`

```go
package task

import (
    "context"
    "database/sql"
    "errors"
    "fmt"
    "time"
)

type MySQLRepository struct {
    db *sql.DB
}

func NewMySQLRepository(db *sql.DB) *MySQLRepository {
    return &MySQLRepository{
        db: db,
    }
}

func (r *MySQLRepository) Create(
    ctx context.Context,
    task Task,
) (Task, error) {
    now := time.Now().UTC()

    query := `
        INSERT INTO tasks (
            title,
            description,
            completed,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?)
    `

    result, err := r.db.ExecContext(
        ctx,
        query,
        task.Title,
        task.Description,
        task.Completed,
        now,
        now,
    )
    if err != nil {
        return Task{}, fmt.Errorf("create task: %w", err)
    }

    id, err := result.LastInsertId()
    if err != nil {
        return Task{}, fmt.Errorf("get inserted task ID: %w", err)
    }

    task.ID = id
    task.CreatedAt = now
    task.UpdatedAt = now

    return task, nil
}

func (r *MySQLRepository) List(
    ctx context.Context,
) ([]Task, error) {
    query := `
        SELECT
            id,
            title,
            description,
            completed,
            created_at,
            updated_at
        FROM tasks
        ORDER BY id DESC
    `

    rows, err := r.db.QueryContext(ctx, query)
    if err != nil {
        return nil, fmt.Errorf("list tasks: %w", err)
    }
    defer rows.Close()

    tasks := make([]Task, 0)

    for rows.Next() {
        var task Task

        if err := rows.Scan(
            &task.ID,
            &task.Title,
            &task.Description,
            &task.Completed,
            &task.CreatedAt,
            &task.UpdatedAt,
        ); err != nil {
            return nil, fmt.Errorf("scan task: %w", err)
        }

        tasks = append(tasks, task)
    }

    if err := rows.Err(); err != nil {
        return nil, fmt.Errorf("iterate tasks: %w", err)
    }

    return tasks, nil
}

func (r *MySQLRepository) GetByID(
    ctx context.Context,
    id int64,
) (Task, error) {
    query := `
        SELECT
            id,
            title,
            description,
            completed,
            created_at,
            updated_at
        FROM tasks
        WHERE id = ?
    `

    var task Task

    err := r.db.QueryRowContext(ctx, query, id).Scan(
        &task.ID,
        &task.Title,
        &task.Description,
        &task.Completed,
        &task.CreatedAt,
        &task.UpdatedAt,
    )

    if errors.Is(err, sql.ErrNoRows) {
        return Task{}, ErrTaskNotFound
    }

    if err != nil {
        return Task{}, fmt.Errorf("get task by ID: %w", err)
    }

    return task, nil
}

func (r *MySQLRepository) Update(
    ctx context.Context,
    task Task,
) (Task, error) {
    now := time.Now().UTC()

    query := `
        UPDATE tasks
        SET
            title = ?,
            description = ?,
            completed = ?,
            updated_at = ?
        WHERE id = ?
    `

    _, err := r.db.ExecContext(
        ctx,
        query,
        task.Title,
        task.Description,
        task.Completed,
        now,
        task.ID,
    )
    if err != nil {
        return Task{}, fmt.Errorf("update task: %w", err)
    }

    updated, err := r.GetByID(ctx, task.ID)
    if err != nil {
        return Task{}, err
    }

    return updated, nil
}

func (r *MySQLRepository) Delete(
    ctx context.Context,
    id int64,
) error {
    query := `DELETE FROM tasks WHERE id = ?`

    result, err := r.db.ExecContext(ctx, query, id)
    if err != nil {
        return fmt.Errorf("delete task: %w", err)
    }

    affected, err := result.RowsAffected()
    if err != nil {
        return fmt.Errorf("get affected rows: %w", err)
    }

    if affected == 0 {
        return ErrTaskNotFound
    }

    return nil
}
```

### 6.1 Understanding ExecContext

Untuk operasi INSERT, UPDATE, dan DELETE kita menggunakan:

```go
db.ExecContext(ctx, query, args...)
```

Fungsi ini menjalankan query yang tidak membutuhkan result rows.

### 6.2 Understanding QueryContext

Untuk mengambil banyak data:

```go
db.QueryContext(ctx, query)
```

Fungsi ini menghasilkan `*sql.Rows`.

Setiap row kemudian dibaca menggunakan:

```go
rows.Scan(...)
```

Jangan lupa:

```go
defer rows.Close()
```

agar resource database dilepaskan setelah selesai digunakan.

### 6.3 Understanding QueryRowContext

Untuk mengambil satu data:

```go
db.QueryRowContext(ctx, query, id)
```

Kemudian hasilnya dibaca menggunakan `Scan`.

Jika data tidak ditemukan, MySQL driver melalui `database/sql` akan menghasilkan `sql.ErrNoRows`.

Kita mengubahnya menjadi error domain:

```go
ErrTaskNotFound
```

Dengan begitu, service dan handler tidak perlu mengetahui detail error database.

### 6.4 Why Use Question Mark Parameters?

Perhatikan query:

```go
query := `SELECT * FROM tasks WHERE id = ?`
```

Nilai ID diberikan secara terpisah:

```go
db.QueryRowContext(ctx, query, id)
```

Jangan menyusun query menggunakan string concatenation seperti:

```go
// JANGAN LAKUKAN INI
query := "SELECT * FROM tasks WHERE id = " + rawID
```

Parameterized query membantu mencegah SQL injection pada nilai yang dikirim melalui parameter.

Nama tabel dan nama kolom tidak dapat diamankan dengan cara yang sama menggunakan placeholder. Untuk bagian tersebut, gunakan SQL yang sudah ditentukan atau whitelist yang ketat.

---

## 7. Update Application Wiring

Sekarang kita tidak lagi menggunakan `MemoryRepository`.

Kita akan membuat database connection pada application entry point dan mengirimkannya ke router.

### 7.1 Update Router

Buka:

`internal/router/router.go`

Ganti dengan:

```go
package router

import (
    "database/sql"
    "net/http"

    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"

    "github.com/yourusername/taskforge/internal/health"
    "github.com/yourusername/taskforge/internal/task"
)

func New(db *sql.DB) http.Handler {
    r := chi.NewRouter()

    r.Use(middleware.RequestID)
    r.Use(middleware.RealIP)
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)

    health.RegisterRoutes(r)

    taskRepository := task.NewMySQLRepository(db)
    taskService := task.NewService(taskRepository)
    taskHandler := task.NewHandler(taskService)

    r.Route("/api/v1", func(r chi.Router) {
        task.RegisterRoutes(r, taskHandler)
    })

    return r
}
```

Perhatikan perubahan:

Sebelumnya:

```go
taskRepository := task.NewMemoryRepository()
```

Sekarang:

```go
taskRepository := task.NewMySQLRepository(db)
```

Service dan handler tidak perlu diubah.

Inilah manfaat dependency inversion melalui repository interface.

### 7.2 Update Main

Buka:

`cmd/api/main.go`

```go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/yourusername/taskforge/internal/platform/database"
    "github.com/yourusername/taskforge/internal/router"
)

func main() {
    db, err := database.NewMySQL(context.Background())
    if err != nil {
        log.Fatalf("database initialization failed: %v", err)
    }
    defer db.Close()

    server := &http.Server{
        Addr:              ":8080",
        Handler:           router.New(db),
        ReadHeaderTimeout: 5 * time.Second,
        IdleTimeout:       60 * time.Second,
    }

    serverErrors := make(chan error, 1)

    go func() {
        log.Println("TaskForge API running on :8080")

        if err := server.ListenAndServe(); err != nil &&
            err != http.ErrServerClosed {
            serverErrors <- err
        }
    }()

    signalCtx, stop := signal.NotifyContext(
        context.Background(),
        os.Interrupt,
        syscall.SIGTERM,
    )
    defer stop()

    select {
    case err := <-serverErrors:
        log.Fatalf("HTTP server failed: %v", err)

    case <-signalCtx.Done():
        log.Println("shutdown signal received")
    }
}
```

Kita sudah menyiapkan penanganan sinyal shutdown dasar.

Pada lesson 23, kita akan membahas graceful shutdown secara lebih mendalam, termasuk deadline shutdown dan koordinasi resource.

---

## 8. Important Note About Routes

Pastikan route Task menggunakan path tanpa trailing slash tambahan.

Di:

`internal/task/routes.go`

Gunakan:

```go
package task

import "github.com/go-chi/chi/v5"

func RegisterRoutes(r chi.Router, handler *Handler) {
    r.Post("/tasks", handler.Create)
    r.Get("/tasks", handler.List)

    r.Get("/tasks/{taskID}", handler.GetByID)
    r.Put("/tasks/{taskID}", handler.Update)
    r.Delete("/tasks/{taskID}", handler.Delete)
}
```

Router utama sudah memberikan prefix `/api/v1`.

Dengan demikian, endpoint akhirnya menjadi:

```text
POST   /api/v1/tasks
GET    /api/v1/tasks
GET    /api/v1/tasks/{taskID}
PUT    /api/v1/tasks/{taskID}
DELETE /api/v1/tasks/{taskID}
```

---

## 9. Running the Application

Pastikan:

1. MySQL berjalan.
2. Database `taskforge` sudah dibuat.
3. Migration sudah dijalankan.
4. Environment variables sudah diatur.
5. Module path import sudah sesuai dengan `go.mod`.

Jalankan:

```bash
go mod tidy
go run ./cmd/api
```

Jika database berhasil dihubungkan, server akan berjalan di port 8080.

Jika koneksi database gagal, aplikasi akan berhenti dan menampilkan error.

---

## 10. Testing with cURL

### 10.1 Create Task

```bash
curl -i -X POST http://localhost:8080/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Learn MySQL",
    "description": "Integrate MySQL with Go"
  }'
```

Expected status:

```text
201 Created
```

### 10.2 List Tasks

```bash
curl -i http://localhost:8080/api/v1/tasks
```

Expected status:

```text
200 OK
```

### 10.3 Get Task

```bash
curl -i http://localhost:8080/api/v1/tasks/1
```

### 10.4 Update Task

```bash
curl -i -X PUT http://localhost:8080/api/v1/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Master Go and MySQL",
    "description": "Build reliable backend systems",
    "completed": true
  }'
```

### 10.5 Delete Task

```bash
curl -i -X DELETE http://localhost:8080/api/v1/tasks/1
```

Expected status:

```text
204 No Content
```

### 10.6 Verify Persistence

Buat sebuah task, lalu matikan server.

Jalankan kembali:

```bash
go run ./cmd/api
```

Ambil daftar task:

```bash
curl http://localhost:8080/api/v1/tasks
```

Data yang sebelumnya dibuat seharusnya masih tersedia.

Inilah perbedaan penting antara in-memory storage dan persistent database.

---

## 11. Best Practices

### 11.1 Jangan Membuka Koneksi Database Per Request

Hindari memanggil `sql.Open` di dalam setiap handler.

Buat satu database handle untuk aplikasi dan gunakan connection pool.

### 11.2 Selalu Gunakan Context

Gunakan:

- `ExecContext`
- `QueryContext`
- `QueryRowContext`
- `PingContext`

Dengan begitu, operasi database dapat mengikuti cancellation dan deadline dari context.

### 11.3 Jangan Menggabungkan Input ke SQL String

Gunakan parameterized queries untuk nilai input.

### 11.4 Pisahkan Migration dari Application Startup

Migration sebaiknya menjadi proses deployment atau langkah operasional tersendiri.

Jangan otomatis menjalankan seluruh migration dengan hak akses DDL setiap kali aplikasi dimulai.

### 11.5 Jangan Menggunakan Database Root User

Buat user khusus aplikasi dengan privilege minimum yang diperlukan.

### 11.6 Perhatikan Connection Pool

Jumlah koneksi harus disesuaikan dengan kapasitas database dan jumlah instance aplikasi.

Jika setiap instance membuka 25 koneksi dan ada 10 instance, aplikasi dapat meminta hingga 250 koneksi.

---

## 12. Common Mistakes

1. Menganggap `sql.Open` langsung memverifikasi koneksi.
2. Tidak memanggil `PingContext`.
3. Tidak menutup `sql.Rows`.
4. Menggunakan SQL string concatenation dengan input client.
5. Membuat database connection pada setiap HTTP request.
6. Tidak mengatur connection pool.
7. Menjalankan migration dengan user aplikasi yang memiliki terlalu banyak privilege.
8. Menyimpan password database di source code.
9. Tidak memeriksa `rows.Err()` setelah iterasi.
10. Tidak menangani `sql.ErrNoRows`.

---

## 13. Lesson Summary

Pada lesson ini kita berhasil mengintegrasikan MySQL ke TaskForge.

Fitur yang sudah dipelajari:

- MySQL database setup.
- Database migration.
- `database/sql`.
- MySQL driver.
- Connection pool.
- `PingContext`.
- `ExecContext`.
- `QueryContext`.
- `QueryRowContext`.
- Parameterized queries.
- SQL repository.
- Database error handling.
- Persistent data storage.

Arsitektur TaskForge sekarang:

```text
HTTP Client
     |
     v
Chi Router
     |
     v
Task Handler
     |
     v
Task Service
     |
     v
MySQL Repository
     |
     v
database/sql
     |
     v
MySQL Driver
     |
     v
MySQL Database
```

### Checklist pembelajaran

- [ ] Memahami `database/sql`.
- [ ] Memahami fungsi MySQL driver.
- [ ] Berhasil membuat database.
- [ ] Berhasil menjalankan migration.
- [ ] Memahami database connection pool.
- [ ] Memahami `PingContext`.
- [ ] Memahami `ExecContext`.
- [ ] Memahami `QueryContext`.
- [ ] Memahami `QueryRowContext`.
- [ ] Memahami parameterized queries.
- [ ] Berhasil mengganti memory repository dengan MySQL.
- [ ] Berhasil menguji seluruh CRUD.
- [ ] Memastikan data tetap ada setelah server restart.

---

## 14. References

- [Go database/sql](https://pkg.go.dev/database/sql)
- [Go MySQL Driver](https://github.com/go-sql-driver/mysql)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [golang-migrate](https://github.com/golang-migrate/migrate)
- [Go Context](https://pkg.go.dev/context)

---

## Next Lesson

**Lesson 04 — Authentication with Go**

Kita akan membangun sistem authentication untuk TaskForge.

Materi yang akan dipelajari:

- User registration.
- Password hashing menggunakan bcrypt.
- Login.
- Password verification.
- JWT access token.
- Token validation.
- Authentication middleware.
- Protected API endpoints.

Setelah lesson berikutnya, TaskForge tidak hanya bisa menyimpan task, tetapi juga mulai mengenali siapa yang sedang menggunakan API.