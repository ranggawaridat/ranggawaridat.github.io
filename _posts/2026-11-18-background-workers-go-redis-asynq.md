---
layout: post
title: "Background Workers dengan Go, Redis, dan Asynq"
date: 2026-11-18
description: "Catatan engineering tentang background processing, worker architecture, Redis Task Queue, Asynq, file processing, reliability, dan production-ready workers menggunakan Go."
categories: [golang, backend-engineering]
tags: [go, golang, redis, asynq, worker, background-jobs, concurrency, backend, distributed-systems]
---

> Not every task deserves to block an HTTP request.
> Some work should happen quietly in the background.

Dalam backend engineering, tidak semua pekerjaan harus diselesaikan ketika pengguna sedang menunggu HTTP response.

Bayangkan pengguna mengunggah video berdurasi 30 menit. Server harus melakukan transcoding, membuat thumbnail, mengompresi video, dan menyimpan beberapa resolusi.

Jika seluruh proses dilakukan langsung di HTTP handler, pengguna harus menunggu terlalu lama.

Di sinilah **Background Worker** berperan.

Worker memungkinkan aplikasi menerima pekerjaan terlebih dahulu, kemudian memprosesnya secara asynchronous tanpa menghalangi request utama.

Dalam ekosistem Go, salah satu kombinasi yang menarik untuk dipelajari adalah:

- Go sebagai bahasa pemrograman.
- Redis sebagai penyimpanan dan infrastruktur antrean.
- Asynq sebagai distributed task queue.
- Worker sebagai eksekutor pekerjaan.
- Object Storage sebagai tempat penyimpanan hasil pemrosesan.

Artikel ini membahas bagaimana merancang, membangun, dan mengoperasikan background worker yang reliable menggunakan Go.

---

# 1. Understanding Background Processing

## 1.1 Synchronous Processing

Synchronous processing berarti aplikasi harus menyelesaikan pekerjaan sebelum memberikan response kepada pengguna.

Contoh:

```text
Client
  |
  v
HTTP Request
  |
  v
Go API
  |
  v
Generate PDF
  |
  v
Send Email
  |
  v
HTTP Response
```

Misalnya sebuah endpoint membuat invoice:

```go
func CreateInvoice(c *gin.Context) {
    invoice := createInvoice()

    generatePDF(invoice)
    sendEmail(invoice)

    c.JSON(200, gin.H{
        "message": "Invoice created",
    })
}
```

Masalahnya, request bergantung pada seluruh pekerjaan tersebut.

Jika email provider lambat, response API ikut lambat.

Jika proses generate PDF gagal, keseluruhan request bisa gagal meskipun invoice sebenarnya sudah berhasil dibuat.

## 1.2 Asynchronous Processing

Dengan asynchronous processing, aplikasi cukup menerima dan menjadwalkan pekerjaan.

```text
Client
  |
  v
HTTP Request
  |
  v
Go API
  |
  +-------> HTTP Response
  |
  v
Task Queue
  |
  v
Background Worker
  |
  +-------> Generate PDF
  |
  +-------> Send Email
  |
  +-------> Upload File
```

API tidak perlu menunggu seluruh pekerjaan selesai.

Contoh:

```go
func CreateInvoice(c *gin.Context) {
    invoice := createInvoice()

    enqueueGeneratePDF(invoice.ID)

    c.JSON(202, gin.H{
        "message": "Invoice processing scheduled",
    })
}
```

HTTP status `202 Accepted` menunjukkan bahwa request diterima untuk diproses, bukan berarti seluruh pekerjaan sudah selesai.

## 1.3 Kapan Menggunakan Background Worker?

Gunakan background worker ketika pekerjaan:

- Membutuhkan waktu relatif lama.
- Tidak perlu diselesaikan sebelum HTTP response.
- Membutuhkan retry ketika terjadi kegagalan.
- Memerlukan pemrosesan secara bertahap.
- Membutuhkan concurrency control.
- Memiliki jadwal eksekusi tertentu.

Contoh penggunaan:

| Kategori | Pekerjaan |
|---|---|
| Document | Generate PDF, Excel, invoice |
| Notification | Email, OTP, SMS, push notification |
| File | Upload, compression, image resizing |
| Video | Transcoding, thumbnail, HLS |
| Data | Import CSV, export database |
| Maintenance | Cleanup, backup, scheduled jobs |
| Integration | Webhook delivery, third-party API |

---

# 2. Anatomy of a Worker System

Sebelum menggunakan Asynq, pahami komponen dasar sebuah worker architecture.

```text
                PRODUCER
                   |
                   v
              Create Task
                   |
                   v
                QUEUE
                   |
                   v
                WORKER
                   |
                   v
              Process Task
                   |
             +-----+-----+
             |           |
             v           v
          SUCCESS      FAILURE
             |           |
             v           v
          COMPLETED    RETRY
```

Ada empat komponen utama.

### Producer

Komponen yang membuat dan memasukkan pekerjaan ke antrean.

Biasanya berupa HTTP handler, service, scheduler, atau komponen internal aplikasi.

### Task

Representasi pekerjaan yang harus dilakukan.

Task biasanya memiliki:

- Task type.
- Payload.
- Retry configuration.
- Timeout.
- Queue name.
- Scheduling information.

### Queue

Tempat task menunggu untuk diproses.

Queue memungkinkan producer dan worker bekerja secara independen.

### Worker

Komponen yang mengambil task dari antrean dan menjalankan pekerjaan sesuai task type.

Worker dapat berjalan sebagai proses terpisah dari HTTP API.

---

# 3. Redis + Asynq

## 3.1 Apa Itu Asynq?

Asynq adalah distributed task queue untuk Go yang menggunakan Redis sebagai backend.

Repository:

https://github.com/hibiken/asynq

Asynq menyediakan berbagai kemampuan untuk mengelola background task:

- Task enqueueing.
- Multiple queues.
- Worker concurrency.
- Automatic retry.
- Scheduled tasks.
- Periodic tasks.
- Task timeout.
- Task uniqueness.
- Task recovery.
- Task inspection melalui Asynqmon.

Redis menyediakan infrastruktur penyimpanan dan koordinasi, sedangkan Asynq mengelola mekanisme task queue dan worker.

## 3.2 Arsitektur Dasar

```text
                 Go API
                   |
                   v
             Asynq Client
                   |
                   v
                  Redis
                   |
          +--------+--------+
          |        |        |
          v        v        v
        Queue    Queue    Queue
        email    pdf      video
          |        |        |
          v        v        v
        Worker   Worker   Worker
          |        |        |
          v        v        v
        SMTP     PDF     FFmpeg
```

Pemisahan queue memungkinkan pekerjaan yang berbeda memiliki konfigurasi worker dan kapasitas yang berbeda.

Contohnya, video transcoding membutuhkan resource CPU yang jauh lebih besar daripada pengiriman email.

Karena itu, keduanya sebaiknya tidak selalu menggunakan kapasitas worker yang sama.

## 3.3 Instalasi

```bash
go mod init worker-platform

go get github.com/hibiken/asynq
```

Jalankan Redis:

```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine
```

---

# 4. Anatomy of an Asynq Task

Dalam Asynq, task memiliki type dan payload.

Contoh task untuk generate PDF:

```go
const TypeGeneratePDF = "document:generate_pdf"

type GeneratePDFPayload struct {
    InvoiceID int64 `json:"invoice_id"`
    UserID    int64 `json:"user_id"`
}
```

Task type mengidentifikasi jenis pekerjaan.

Payload membawa data yang diperlukan worker untuk menjalankan pekerjaan.

## 4.1 Creating a Task

```go
func NewGeneratePDFTask(invoiceID, userID int64) (*asynq.Task, error) {
    payload, err := json.Marshal(GeneratePDFPayload{
        InvoiceID: invoiceID,
        UserID:    userID,
    })

    if err != nil {
        return nil, err
    }

    return asynq.NewTask(
        TypeGeneratePDF,
        payload,
    ), nil
}
```

## 4.2 Enqueueing a Task

```go
client := asynq.NewClient(
    asynq.RedisClientOpt{
        Addr: "localhost:6379",
    },
)

defer client.Close()

task, err := NewGeneratePDFTask(1001, 25)
if err != nil {
    log.Fatal(err)
}

info, err := client.Enqueue(
    task,
    asynq.Queue("pdf"),
    asynq.MaxRetry(5),
    asynq.Timeout(5*time.Minute),
)

if err != nil {
    log.Fatal(err)
}

log.Println("Task ID:", info.ID)
```

Producer hanya bertugas menjadwalkan pekerjaan.

Producer tidak perlu mengetahui bagaimana PDF dihasilkan.

---

# 5. Building the Worker

Worker bertugas menerima task dan menjalankan handler yang sesuai.

## 5.1 Task Handler

```go
type PDFHandler struct {
    // Database repository
    // Storage service
    // PDF generator
}

func (h *PDFHandler) ProcessTask(
    ctx context.Context,
    task *asynq.Task,
) error {
    var payload GeneratePDFPayload

    if err := json.Unmarshal(
        task.Payload(),
        &payload,
    ); err != nil {
        return fmt.Errorf("decode payload: %w", err)
    }

    return h.GeneratePDF(ctx, payload)
}
```

## 5.2 Implementing the Processing Logic

```go
func (h *PDFHandler) GeneratePDF(
    ctx context.Context,
    payload GeneratePDFPayload,
) error {
    // 1. Load invoice from database.
    // 2. Generate PDF.
    // 3. Upload PDF to object storage.
    // 4. Update invoice status.
    // 5. Return error if processing fails.

    return nil
}
```

Sebaiknya handler tidak menampung seluruh business logic.

Pisahkan task handler, application service, repository, dan external integration.

## 5.3 Registering the Worker

```go
mux := asynq.NewServeMux()

pdfHandler := &PDFHandler{}

mux.HandleFunc(
    TypeGeneratePDF,
    pdfHandler.ProcessTask,
)

server := asynq.NewServer(
    asynq.RedisClientOpt{
        Addr: "localhost:6379",
    },
    asynq.Config{
        Concurrency: 10,
        Queues: map[string]int{
            "critical": 6,
            "pdf":      3,
            "default":  1,
        },
    },
)

if err := server.Run(mux); err != nil {
    log.Fatal(err)
}
```

Konfigurasi tersebut memberikan total kapasitas concurrency sebesar 10.

Worker dapat menangani beberapa task secara bersamaan.

Namun concurrency tidak berarti setiap jenis pekerjaan aman dijalankan dalam jumlah yang sama. Video transcoding, misalnya, perlu pembatasan resource tersendiri.

---

# 6. Types of Background Workers

Tidak ada daftar worker yang dibatasi oleh Asynq.

Worker merupakan program yang menjalankan business logic berdasarkan task yang diterima.

Berikut kategori pekerjaan yang umum ditemukan dalam backend system.

## 6.1 Document Processing Workers

Bertanggung jawab memproses berbagai jenis dokumen.

| Worker | Fungsi |
|---|---|
| PDF Worker | Generate invoice dan laporan |
| Excel Worker | Generate spreadsheet |
| Document Converter | DOCX ke PDF |
| OCR Worker | Ekstraksi teks dari dokumen |
| Watermark Worker | Menambahkan watermark |
| Compression Worker | Mengompresi dokumen |

Contoh pipeline:

```text
Invoice Created
      |
      v
Generate PDF Task
      |
      v
PDF Worker
      |
      v
PDF Generator
      |
      v
Object Storage
      |
      v
Update Invoice
```

## 6.2 Notification Workers

Bertanggung jawab mengirimkan komunikasi kepada pengguna.

| Worker | Fungsi |
|---|---|
| Email Worker | Mengirim email |
| OTP Worker | Mengirim OTP |
| SMS Worker | Mengirim SMS |
| Push Worker | Push notification |
| WhatsApp Worker | Mengirim WhatsApp |
| Webhook Worker | Mengirim webhook |

Contoh:

```text
User Registered
      |
      v
Send Verification Email Task
      |
      v
Email Worker
      |
      v
Email Provider
      |
      v
Update Delivery Status
```

Untuk email delivery, pertimbangkan idempotency agar retry tidak menyebabkan email duplikat yang tidak diinginkan.

## 6.3 File Processing Workers

Bertanggung jawab menangani file yang diunggah pengguna.

| Worker | Fungsi |
|---|---|
| Upload Worker | Memindahkan file ke storage |
| Image Worker | Resize gambar |
| Thumbnail Worker | Membuat thumbnail |
| Compression Worker | Mengompresi gambar |
| Backup Worker | Membuat backup |
| Cleanup Worker | Menghapus file sementara |

Contoh:

```text
Client Upload
      |
      v
Go API
      |
      v
Redis Queue
      |
      v
File Worker
      |
      v
S3 / MinIO
      |
      v
Database Update
```

Untuk file besar, pertimbangkan presigned URL agar client bisa mengunggah langsung ke object storage.

Worker kemudian melakukan validasi dan pemrosesan lanjutan.

## 6.4 Video Processing Workers

Ini salah satu jenis worker yang membutuhkan perhatian khusus karena konsumsi resource-nya cukup besar.

FFmpeg merupakan tool yang umum digunakan untuk pemrosesan multimedia.

Website:

https://ffmpeg.org/

| Worker | Fungsi |
|---|---|
| Transcoding Worker | Convert format video |
| Thumbnail Worker | Mengambil frame video |
| Compression Worker | Mengurangi ukuran video |
| Audio Extraction Worker | Mengekstrak audio |
| HLS Worker | Membuat segmen streaming |
| Metadata Worker | Membaca metadata video |
| Subtitle Worker | Memproses subtitle |

Contoh arsitektur:

```text
           Video Uploaded
                  |
                  v
             Go API
                  |
                  v
             Redis Queue
                  |
                  v
            Video Worker
                  |
                  v
                FFmpeg
                  |
          +-------+-------+
          |       |       |
          v       v       v
         360p    720p   1080p
          |       |       |
          +-------+-------+
                  |
                  v
             S3 / MinIO
                  |
                  v
            Update Database
```

Contoh perintah FFmpeg:

```bash
ffmpeg -i input.mp4 \
  -vf scale=-2:720 \
  -c:v libx264 \
  -preset medium \
  -crf 23 \
  -c:a aac \
  output-720p.mp4
```

Jangan menjalankan proses FFmpeg dalam jumlah tidak terbatas.

Batasi concurrency berdasarkan CPU, memory, disk I/O, dan kebutuhan transcoding.

Gunakan `exec.CommandContext` agar proses eksternal dapat dihentikan ketika context dibatalkan atau timeout terjadi.

---

# 7. Queue Architecture

Salah satu kemampuan penting Asynq adalah multiple queues.

Jangan mencampurkan semua pekerjaan ke satu queue tanpa mempertimbangkan karakteristik pekerjaannya.

Contoh:

```go
Queues: map[string]int{
    "critical": 6,
    "email":    4,
    "pdf":      3,
    "upload":   2,
    "video":    1,
    "default":  1,
}
```

Angka tersebut merupakan bobot prioritas, bukan batas jumlah worker untuk setiap queue.

Contoh pemisahan:

| Queue | Jenis pekerjaan | Karakteristik |
|---|---|---|
| critical | Pekerjaan penting | Prioritas tinggi |
| email | Email delivery | I/O-bound |
| pdf | Generate PDF | CPU dan I/O |
| upload | File processing | Network dan disk I/O |
| video | FFmpeg | CPU dan memory intensive |
| default | Task umum | Campuran |

Untuk pekerjaan berat, lebih baik menjalankan worker process tersendiri.

Misalnya:

```text
                Redis
                  |
        +---------+---------+
        |         |         |
        v         v         v
     Email     PDF       Video
     Worker    Worker    Worker
        |         |         |
        v         v         v
      SMTP     Generator   FFmpeg
```

Dengan pemisahan tersebut, video processing tidak mudah menghabiskan kapasitas yang diperlukan email worker.

---

# 8. Reliability Engineering

Membuat worker berjalan adalah hal mudah.

Membuat worker yang tetap benar ketika terjadi kegagalan adalah bagian engineering yang sebenarnya.

## 8.1 Retry

Task bisa gagal karena:

- External API tidak tersedia.
- Database timeout.
- Network interruption.
- Storage provider mengalami gangguan.

Asynq mendukung retry otomatis.

```go
client.Enqueue(
    task,
    asynq.MaxRetry(5),
)
```

Namun jangan menganggap semua error harus di-retry.

Bedakan:

- Transient error: kemungkinan berhasil jika dicoba lagi.
- Permanent error: input invalid atau resource tidak ditemukan.
- Unknown error: perlu observasi dan evaluasi.

## 8.2 Idempotency

Bayangkan worker menerima task pembayaran dua kali.

Tanpa idempotency, transaksi dapat diproses dua kali.

Contoh:

```go
func ProcessPayment(
    ctx context.Context,
    paymentID string,
) error {
    // Check whether payment was already processed.
    // If already completed, return nil.
    // Otherwise, process payment.
    // Persist the result atomically.

    return nil
}
```

Gunakan unique constraint, status transition, idempotency key, atau mekanisme deduplikasi yang sesuai.

Ingat:

**Task queue tidak otomatis menjamin business operation hanya terjadi sekali.**

## 8.3 Timeout

Pekerjaan yang terlalu lama perlu dibatasi.

```go
client.Enqueue(
    task,
    asynq.Timeout(5*time.Minute),
)
```

Pastikan business logic juga menghormati `context.Context`.

Untuk proses eksternal, gunakan context-aware execution.

## 8.4 Dead-Letter Handling

Task yang terus gagal tidak boleh dibiarkan tanpa pengawasan.

Buat strategi untuk:

- Mencatat kegagalan.
- Menyimpan alasan error.
- Melakukan alert.
- Memeriksa payload.
- Memutuskan apakah task aman untuk dijalankan ulang.

Asynq menyediakan retry dan mekanisme pengelolaan task gagal. Dead-letter workflow yang lebih khusus dapat dirancang sesuai kebutuhan aplikasi.

## 8.5 Graceful Shutdown

Ketika worker dihentikan, pekerjaan yang sedang berjalan harus ditangani dengan benar.

Gunakan mekanisme shutdown yang disediakan Asynq dan pastikan handler menghormati context.

Jangan mematikan proses secara paksa sebelum pekerjaan yang sedang berjalan memperoleh kesempatan untuk berhenti dengan aman.

---

# 9. Database and Task Consistency

Salah satu masalah yang sering muncul adalah ketidakkonsistenan antara database dan queue.

Misalnya:

```text
1. Insert order ke database.
2. Enqueue SendEmail task.
3. Redis mengalami gangguan.
4. Task gagal masuk queue.
```

Order sudah tercatat, tetapi email tidak pernah dijadwalkan.

Salah satu solusi untuk kasus seperti ini adalah **Transactional Outbox Pattern**.

```text
           Database Transaction
                  |
          +-------+-------+
          |               |
          v               v
       Insert Order   Insert Outbox
          |               |
          +-------+-------+
                  |
                  v
              Commit
                  |
                  v
           Outbox Publisher
                  |
                  v
              Redis Queue
                  |
                  v
                Worker
```

Order dan outbox event disimpan dalam satu transaksi database.

Publisher kemudian mengambil outbox record dan memasukkannya ke Asynq.

Outbox record harus dikelola dengan status dan mekanisme deduplikasi karena publisher juga bisa mengalami retry.

---

# 10. Production Architecture

Ketika jumlah pekerjaan bertambah, worker sebaiknya dipisahkan menjadi beberapa deployment.

```text
                  Internet
                     |
                     v
                  API Gateway
                     |
                     v
                  Go API
                     |
                     v
                   Redis
                     |
       +-------------+-------------+
       |             |             |
       v             v             v
   Email Queue    PDF Queue    Video Queue
       |             |             |
       v             v             v
   Email Worker   PDF Worker   Video Worker
       |             |             |
       v             v             v
   SMTP/API       Generator      FFmpeg
       |             |             |
       +-------------+-------------+
                     |
                     v
                Object Storage
                     |
                     v
                  Database
```

Komponen production yang perlu dipertimbangkan:

### Infrastructure

- Docker.
- Redis persistence dan availability.
- Object Storage.
- Database.
- Worker deployment terpisah.

### Observability

- Structured logging.
- Prometheus metrics.
- Grafana dashboard.
- Task failure monitoring.
- Queue latency monitoring.
- Processing duration.

### Security

- Validasi payload.
- File type validation.
- File size limits.
- Isolasi temporary directory.
- Resource limits.
- Credential management.
- Proteksi terhadap file berbahaya.

---

# 11. Worker Engineering Checklist

Sebelum sebuah worker dianggap production-ready, pastikan hal berikut sudah dipertimbangkan.

| Area | Checklist |
|---|---|
| Architecture | Producer dan worker terpisah |
| Task | Payload memiliki schema yang jelas |
| Concurrency | Kapasitas worker dibatasi |
| Retry | Retry policy sesuai jenis error |
| Idempotency | Duplicate execution aman |
| Timeout | Task memiliki batas waktu |
| Recovery | Kegagalan dapat dipulihkan |
| Shutdown | Graceful shutdown tersedia |
| Monitoring | Metrics dan logs tersedia |
| Storage | Temporary file dibersihkan |
| Security | Input dan file divalidasi |
| Scaling | Worker dapat ditambah secara horizontal |

---

# 12. Final Thoughts

Background worker bukan sekadar goroutine yang berjalan di belakang layar.

Worker engineering melibatkan banyak disiplin:

- Concurrency engineering.
- Queue management.
- Distributed processing.
- Failure handling.
- Resource management.
- Storage engineering.
- Observability.
- System architecture.

Redis + Asynq merupakan titik awal yang sangat baik untuk memahami disiplin tersebut menggunakan Go.

> A good backend doesn't just execute tasks.
> It knows how to schedule them, survive failures, recover safely, and scale when demand grows.

**The real engineering begins when things fail.**


Reference:
- [Asynq Documentation & Source Code](https://github.com/hibiken/asynq?utm_source=chatgpt.com)
- [Asynqmon](https://github.com/hibiken/asynqmon?utm_source=chatgpt.com)
- [Redis Documentation](https://github.com/hibiken/asynqmon?utm_source=chatgpt.com)
- [Go Concurrency Patterns](https://go.dev/blog/pipelines?utm_source=chatgpt.com)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html?utm_source=chatgpt.com)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/?utm_source=chatgpt.com)
