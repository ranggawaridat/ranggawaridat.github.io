# From Hello World to Real-World Applications with Go

Ketika pertama kali belajar Go, mungkin kita memulainya dengan kode yang sangat sederhana:

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}
```

Program tersebut berjalan.

Kita senang karena berhasil membuat program pertama.

Lalu kita belajar variable, function, struct, slice, interface, dan berbagai hal lainnya.

Sampai akhirnya muncul sebuah pertanyaan:

> **"Setelah belajar semua ini, sebenarnya aku bisa membuat apa?"**

Menurutku, pertanyaan ini jauh lebih penting daripada sekadar menghafalkan syntax.

Karena belajar programming bukan hanya tentang bisa menulis kode.

Kita juga perlu belajar bagaimana mengubah kode menjadi **sesuatu yang benar-benar bisa digunakan.**

Dan untuk memahami itu, kita perlu keluar sedikit dari dunia `Hello World`.

---

## Jangan Terlalu Lama Tinggal di Tutorial

Ada fase dalam belajar programming ketika kita merasa harus belajar semuanya terlebih dahulu.

Misalnya ketika belajar Go:

* harus memahami semua syntax
* harus memahami interface
* harus memahami goroutine
* harus memahami concurrency
* harus memahami framework
* harus memahami Docker
* harus memahami cloud

Baru setelah itu merasa siap membuat aplikasi.

Masalahnya, fase "siap" tersebut mungkin tidak pernah datang.

Karena semakin banyak kita belajar, semakin banyak pula hal baru yang kita temukan.

Menurutku, cara yang lebih masuk akal adalah:

```text
Belajar sedikit
     ↓
Buat sesuatu
     ↓
Menemukan masalah
     ↓
Belajar untuk menyelesaikan masalah
     ↓
Buat lagi
```

Jadi kita tidak belajar semua hal terlebih dahulu.

Kita belajar **karena project membutuhkannya.**

---

# Dari Hello World ke Todo App

Untuk melihat prosesnya, mari kita ambil project yang sangat sederhana:

**Todo App.**

Mungkin Todo terdengar terlalu sederhana.

Tapi justru karena sederhana, kita bisa melihat bagaimana sebuah aplikasi tumbuh.

Awalnya:

```text
Hello World
```

Kemudian:

```text
Go Program
```

Lalu:

```text
HTTP Server
```

Kemudian:

```text
REST API
```

Lalu:

```text
Database
```

Kemudian:

```text
Testing
```

Dan akhirnya:

```text
Application
```

Satu project kecil bisa membawa kita melewati banyak konsep penting.

---

# 1. Mulai dari Program Go Sederhana

Kita mulai dengan membuat project:

```bash
mkdir todo-app
cd todo-app
go mod init todo-app
```

Kemudian buat `main.go`:

```go
package main

import "fmt"

func main() {
    fmt.Println("Todo App")
}
```

Saat dijalankan:

```bash
go run .
```

kita mendapatkan:

```text
Todo App
```

Tidak ada yang istimewa.

Tapi ini adalah fondasinya.

Sebuah aplikasi besar juga dimulai dari program yang bisa dijalankan.

---

# 2. Mengubah Program Menjadi Server

Sekarang kita ingin program tersebut bisa menerima request.

Go sudah menyediakan package `net/http`, jadi kita tidak perlu langsung menggunakan framework.

```go
package main

import (
    "fmt"
    "net/http"
)

func main() {
    http.HandleFunc("/health", health)

    fmt.Println("Server running on :8080")

    http.ListenAndServe(":8080", nil)
}

func health(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintln(w, "OK")
}
```

Jalankan:

```bash
go run .
```

Kemudian buka:

```text
http://localhost:8080/health
```

Sekarang kita mendapatkan:

```text
OK
```

Hal kecil ini sebenarnya cukup penting.

Program kita sekarang sudah bisa:

1. menerima HTTP request
2. menjalankan function
3. mengirim response

Kita sudah mulai masuk ke dunia backend.

---

# 3. Membuat Todo

Sekarang kita membutuhkan data.

Kita bisa membuat struct:

```go
type Todo struct {
    ID        int    `json:"id"`
    Title     string `json:"title"`
    Completed bool   `json:"completed"`
}
```

Untuk sementara, kita simpan Todo di memory:

```go
var todos = []Todo{
    {
        ID:        1,
        Title:     "Belajar Go",
        Completed: false,
    },
}
```

Kemudian kita buat endpoint:

```text
GET /todos
```

yang mengembalikan data tersebut dalam bentuk JSON.

```go
func getTodos(w http.ResponseWriter, r *http.Request) {
    json.NewEncoder(w).Encode(todos)
}
```

Sekarang browser bisa mendapatkan:

```json
[
    {
        "id": 1,
        "title": "Belajar Go",
        "completed": false
    }
]
```

Kita sudah memiliki API sederhana.

---

# 4. Membuat Data Baru

Tidak cukup hanya membaca data.

Kita juga ingin membuat Todo.

Misalnya:

```http
POST /todos
```

dengan request:

```json
{
    "title": "Belajar REST API"
}
```

Kemudian server membuat:

```json
{
    "id": 2,
    "title": "Belajar REST API",
    "completed": false
}
```

Di sini kita mulai belajar konsep yang sebenarnya sering digunakan dalam backend:

* HTTP method
* request body
* JSON
* response
* status code
* validation

Ternyata membuat endpoint sederhana saja sudah membawa kita ke banyak konsep.

---

# 5. Masalah Pertama: Data Hilang

Kemudian kita menemukan masalah.

Data Todo masih berada di memory.

Kalau server dihentikan:

```text
Ctrl + C
```

kemudian dijalankan lagi:

```bash
go run .
```

Todo kita hilang.

Kenapa?

Karena kita belum menggunakan database.

Dan ini contoh yang menurutku menarik dalam belajar programming.

Kita tidak perlu belajar database hanya karena tutorial mengatakan:

> "Sekarang waktunya belajar database."

Kita belajar database karena **aplikasi kita membutuhkannya.**

---

# 6. Menambahkan SQLite

Untuk aplikasi sederhana, SQLite sudah cukup.

Kita bisa memiliki:

```text
todo.db
```

yang menyimpan data Todo.

Sekarang alurnya berubah:

```text
Request
   ↓
Go
   ↓
SQLite
   ↓
Response
```

Data tidak lagi hilang ketika server dimatikan.

Di sini kita mulai belajar:

* SQL
* table
* insert
* select
* update
* delete
* database connection

Dan Todo App yang tadinya hanya beberapa baris kode mulai terasa seperti aplikasi sungguhan.

---

# 7. Mulai Memisahkan Kode

Semakin banyak fitur yang kita tambahkan, semakin banyak pula kode yang kita miliki.

Kalau semuanya dimasukkan ke `main.go`, file tersebut akan cepat menjadi berantakan.

Maka kita mulai memisahkan tanggung jawab.

Misalnya:

```text
backend/
├── main.go
└── internal/
    └── todo/
        ├── handler.go
        ├── service.go
        ├── repository.go
        └── model.go
```

Sekarang setiap bagian memiliki pekerjaan yang lebih jelas.

### Handler

Mengurus HTTP.

```text
Request
↓
Handler
```

### Service

Mengurus business logic.

```text
Handler
↓
Service
```

### Repository

Mengurus database.

```text
Service
↓
Repository
↓
SQLite
```

Akhirnya alurnya menjadi:

```text
Client
   ↓
Handler
   ↓
Service
   ↓
Repository
   ↓
SQLite
```

Ini bukan berarti semua project Go harus memiliki struktur seperti ini.

Justru kita sebaiknya tidak membuat struktur tersebut hanya karena terlihat profesional.

Kita membuatnya ketika project mulai membutuhkannya.

---

# 8. Mulai Mengenal Interface

Di bagian ini kita bisa mulai menggunakan interface.

Misalnya:

```go
type Repository interface {
    Create(todo Todo) error
    FindAll() ([]Todo, error)
}
```

Kemudian service:

```go
type service struct {
    repo Repository
}
```

Hal yang menarik adalah service tidak perlu mengetahui detail database.

Service hanya tahu bahwa `repo` menyediakan operasi yang dibutuhkan.

Misalnya:

```text
Service:

"Repository, tolong buatkan Todo."

Repository:

"Siap."

Service:

"Repository, berikan semua Todo."

Repository:

"Siap."
```

Service tidak perlu tahu apakah repository menggunakan SQLite, PostgreSQL, atau database lainnya.

Di sinilah interface mulai terasa manfaatnya.

Bukan sekadar syntax yang harus dihafalkan.

---

# 9. Testing

Setelah aplikasi mulai memiliki beberapa bagian, kita mulai memiliki masalah baru.

Bagaimana kita tahu perubahan yang kita buat tidak merusak kode sebelumnya?

Jawabannya:

**testing.**

Misalnya kita ingin memastikan service berhasil membuat Todo.

Kita bisa menulis:

```go
func TestCreateTodo(t *testing.T) {
    // arrange

    // act

    // assert
}
```

Testing membuat kita bisa memeriksa perilaku program secara otomatis.

Tanpa testing, kita mungkin harus mencoba semuanya secara manual.

Dengan testing, kita bisa mengatakan:

> "Kalau input-nya seperti ini, hasil yang kuharapkan harus seperti ini."

Kemudian Go akan membantu memeriksanya.

---

# 10. Membuat Frontend Sederhana

Sampai sekarang kita sudah memiliki backend.

Tetapi backend saja belum terlalu nyaman digunakan oleh pengguna biasa.

Kita membutuhkan interface.

Untuk project belajar, kita bahkan tidak perlu framework frontend.

Cukup:

```text
frontend/
├── index.html
├── style.css
└── app.js
```

HTML:

```html
<h1>Todo App</h1>

<input id="title" placeholder="Todo..." />

<button id="add">
    Add
</button>

<ul id="todos"></ul>
```

Kemudian JavaScript mengambil data dari Go API:

```javascript
async function loadTodos() {
    const response = await fetch(
        "http://localhost:8080/todos"
    );

    const todos = await response.json();

    console.log(todos);
}

loadTodos();
```

Sekarang kita memiliki dua bagian:

```text
Frontend
    ↓
HTTP
    ↓
Go Backend
    ↓
SQLite
```

Dan ini sudah sangat mirip dengan aplikasi web yang sebenarnya.

---

# 11. Git Mengubah Cara Kita Bekerja

Ketika project mulai berkembang, kita juga perlu mengelola perubahan kode.

Kita mulai menggunakan Git.

```bash
git init
```

Kemudian:

```bash
git add .
git commit -m "initial todo app"
```

Setelah itu project bisa disimpan di GitHub.

Git bukan hanya tempat untuk menyimpan kode.

Menurutku, Git juga membantu kita melihat perjalanan sebuah project.

Misalnya:

```text
Initial project
      ↓
Add API
      ↓
Add SQLite
      ↓
Add repository
      ↓
Add service
      ↓
Add tests
      ↓
Add frontend
```

Kita bisa melihat bagaimana project yang awalnya kosong perlahan tumbuh.

---

# 12. Deployment

Ada satu tahap terakhir yang membuat project terasa jauh lebih nyata.

**Deployment.**

Selama ini aplikasi berjalan di:

```text
localhost
```

Artinya hanya komputer kita yang bisa mengaksesnya.

Deployment membuat aplikasi kita berjalan di server yang bisa diakses melalui internet.

Alurnya menjadi:

```text
Browser
   ↓
Internet
   ↓
Server
   ↓
Go Application
   ↓
Database
```

Sekarang aplikasi yang kita buat tidak hanya hidup di laptop.

Orang lain bisa menggunakannya.

Dan menurutku, di sinilah ada perubahan kecil dalam cara kita melihat programming.

Kita tidak lagi sekadar menulis program.

Kita mulai **membangun produk kecil.**

---

# Apa yang Sebenarnya Kita Pelajari?

Kalau dilihat sekilas, project kita hanya:

> Todo App.

Tapi sebenarnya kita sudah menyentuh banyak hal.

### Go

* struct
* function
* package
* interface
* error handling

### Backend

* HTTP
* REST API
* JSON
* request
* response
* status code

### Database

* SQL
* SQLite
* CRUD
* repository

### Architecture

* handler
* service
* repository
* interface

### Testing

* unit test
* mock
* assertion

### Frontend

* HTML
* CSS
* JavaScript
* `fetch()`

### Workflow

* Git
* GitHub
* deployment

Dan semuanya dipelajari melalui **satu project.**

---

# Jangan Mengejar Teknologi

Setelah mulai masuk dunia programming, kita akan melihat banyak teknologi.

```text
Docker
Redis
PostgreSQL
Kafka
RabbitMQ
Kubernetes
GraphQL
gRPC
Microservices
Cloud
```

Melihat semua itu bisa membuat kita berpikir:

> "Aku harus belajar semuanya."

Padahal belum tentu.

Misalnya project kita belum memiliki masalah caching.

Kenapa harus langsung belajar Redis?

Kalau belum membutuhkan containerization.

Kenapa harus langsung belajar Docker?

Kalau aplikasinya masih sederhana.

Kenapa harus menggunakan microservices?

Kita tidak perlu menyelesaikan masalah yang belum kita miliki.

Lebih baik:

```text
Project
   ↓
Masalah
   ↓
Cari solusi
   ↓
Belajar teknologi
   ↓
Implementasi
```

Daripada:

```text
Belajar semua teknologi
   ↓
Bingung mau digunakan untuk apa
```

---

# Dari "Belajar Go" Menjadi "Membangun dengan Go"

Menurutku ada perbedaan besar antara dua kalimat ini.

> Aku sedang belajar Go.

dan:

> Aku sedang membangun aplikasi menggunakan Go.

Kalimat pertama berfokus pada bahasa.

Kalimat kedua berfokus pada kemampuan.

Kita tetap perlu belajar syntax.

Kita tetap perlu memahami konsep.

Tetapi akhirnya pengetahuan tersebut harus digunakan untuk membuat sesuatu.

Karena programming bukan hanya tentang mengetahui bagaimana menulis:

```go
func hello() {
    fmt.Println("Hello")
}
```

Tetapi juga mengetahui bagaimana kode tersebut menjadi bagian dari sistem yang lebih besar.

---

# Project Kecil Adalah Latihan yang Bagus

Kita tidak harus langsung membuat:

* social media
* e-commerce
* banking system
* streaming platform
* AI application

Project sederhana justru bisa menjadi latihan yang sangat bagus.

Misalnya:

```text
Todo App
Notes App
URL Shortener
Expense Tracker
Student Cash App
Book Library
```

Yang penting adalah membawa project tersebut sampai selesai.

Bukan hanya:

```text
Coding
```

tetapi:

```text
Coding
 ↓
Database
 ↓
API
 ↓
Testing
 ↓
Git
 ↓
Deployment
```

---

# Dari Satu Project ke Project Berikutnya

Setelah Todo selesai, kita bisa membuat project berikutnya.

Tidak perlu mengulang semuanya dengan cara yang sama.

Misalnya project kedua memiliki:

```text
Authentication
```

Project ketiga:

```text
File Upload
```

Project keempat:

```text
Pagination
```

Project kelima:

```text
External API
```

Project berikutnya:

```text
Background Job
```

Sedikit demi sedikit, kita akan menemukan pola yang sama.

Awalnya mungkin terasa seperti banyak hal yang berbeda.

Lama-lama kita mulai melihat bahwa sebagian besar aplikasi memiliki pola yang berulang.

```text
Request
   ↓
Validate
   ↓
Business Logic
   ↓
Database
   ↓
Response
```

Dan ketika pola tersebut mulai terasa familiar, kita tidak lagi selalu mulai dari nol.

---

# Penutup

Saya pikir salah satu kesalahan ketika belajar programming adalah terlalu fokus pada pertanyaan:

> **"Apa yang harus saya pelajari selanjutnya?"**

Kadang pertanyaan yang lebih berguna adalah:

> **"Apa yang bisa saya bangun dengan apa yang sudah saya tahu?"**

Karena ketika kita mulai membangun, kita akan menemukan sendiri apa yang belum kita ketahui.

Kita akan menemukan error.

Kita akan menemukan database yang tidak bekerja.

Kita akan bingung dengan interface.

Kita akan salah membuat API.

Kita akan memperbaiki code.

Kita akan menjalankan test.

Kita akan melakukan commit.

Dan mungkin deployment pertama kita juga gagal. 😄

Tapi justru dari situlah proses belajar sebenarnya terjadi.

Kita mulai dari:

```text
Hello World
```

Kemudian:

```text
Go
 ↓
HTTP
 ↓
API
 ↓
Database
 ↓
Architecture
 ↓
Testing
 ↓
Frontend
 ↓
Git
 ↓
Deployment
```

Pada akhirnya, tujuan belajar Go bukan hanya supaya kita bisa mengatakan:

> "Aku tahu Go."

Tetapi supaya suatu hari kita bisa mengatakan:

> **"Aku punya masalah, dan aku tahu bagaimana mulai membangunnya menjadi sebuah aplikasi."**

Dan mungkin, semuanya memang harus dimulai dari satu program kecil:

```go
fmt.Println("Hello, World!")
```

Lalu satu langkah kecil setelahnya.

Dan satu langkah lagi.

Sampai tanpa sadar, `Hello World` yang dulu hanya mencetak satu kalimat sudah berubah menjadi sesuatu yang benar-benar bisa digunakan orang lain. ❤️
