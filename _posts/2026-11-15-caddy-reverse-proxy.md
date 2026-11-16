---
layout: post
title: "Caddy sebagai Reverse Proxy untuk Banyak Aplikasi Go di Satu VPS"
date: 2026-11-15
description: "Memahami Caddy, reverse proxy, DNS, routing berdasarkan domain dan path, serta deployment beberapa aplikasi Go pada satu VPS."
---

Saat menjalankan aplikasi di VPS, kita sering memulai dengan membuka port secara langsung. Misalnya aplikasi Go berjalan di port `8080`, lalu diakses melalui `http://IP-VPS:8080`.

Cara tersebut sederhana dan cocok untuk eksperimen. Namun, ketika jumlah aplikasi bertambah, mengelola banyak port publik mulai terasa kurang praktis.

Bayangkan satu VPS menjalankan tiga program Go:

- REST API pada port `3001`.
- AI agent pada port `3002`.
- Dashboard pada port `3003`.

Kita ingin masing-masing aplikasi memiliki alamat sendiri:

- `api.example.com`
- `agent.example.com`
- `panel.example.com`

Ketiganya bisa menggunakan satu IP publik dan satu pintu masuk HTTP/HTTPS. Komponen yang menangani pembagian request tersebut adalah **reverse proxy**. Dalam tulisan ini, saya menggunakan **Caddy**.

## 1. Apa itu Caddy?

[Caddy](https://caddyserver.com/) adalah web server dan reverse proxy yang ditulis menggunakan Go. Salah satu fitur yang membuatnya menarik adalah dukungan HTTPS otomatis. Untuk konfigurasi domain yang memenuhi persyaratan, Caddy dapat memperoleh dan memperbarui sertifikat TLS tanpa perlu mengatur proses renewal secara manual.

Caddy dapat digunakan untuk:

- Menyajikan website statis.
- Menjadi reverse proxy untuk aplikasi Go, Node.js, Python, dan service lainnya.
- Mengarahkan beberapa domain ke aplikasi berbeda.
- Melakukan TLS termination.
- Menambahkan header atau mengatur perilaku proxy.
- Menangani sertifikat HTTPS secara otomatis.

Caddy bukan DNS provider. Caddy tidak membuat record DNS untuk domain kita. DNS tetap perlu diarahkan ke IP VPS melalui provider DNS.

## 2. Memahami reverse proxy

Reverse proxy adalah server yang menerima request dari client, kemudian meneruskannya ke server aplikasi di belakangnya.

Tanpa reverse proxy, client berkomunikasi langsung dengan port aplikasi:

```text
Browser
   |
   | http://IP-VPS:3001
   v
Go API :3001
```

Dengan reverse proxy, client hanya perlu mengetahui alamat Caddy:

```text
Browser
   |
   | https://api.example.com
   v
Caddy :80 / :443
   |
   | http://127.0.0.1:3001
   v
Go API :3001
```

Caddy menjadi gerbang masuk. Aplikasi Go tetap berjalan pada port internal dan tidak harus diekspos langsung ke internet.

### Reverse proxy vs forward proxy

Keduanya sama-sama proxy, tetapi posisi dan tujuannya berbeda.

| Jenis | Mewakili | Contoh penggunaan |
|---|---|---|
| Forward proxy | Client | Mengatur akses client ke internet |
| Reverse proxy | Server | Menerima request publik dan meneruskannya ke backend |

Analogi sederhananya: forward proxy seperti kurir yang mewakili pelanggan untuk mengambil barang. Reverse proxy seperti resepsionis gedung yang menerima tamu lalu mengarahkannya ke ruangan yang tepat.

## 3. Satu IP publik untuk banyak domain

Satu IP publik dapat melayani banyak domain. Misalnya VPS memiliki IP `203.0.113.10` dan kita memiliki tiga subdomain.

Di DNS provider, buat record seperti berikut:

| Type | Name | Value |
|---|---|---|
| A | `api` | `203.0.113.10` |
| A | `agent` | `203.0.113.10` |
| A | `panel` | `203.0.113.10` |

Hasilnya:

```text
api.example.com    ─┐
agent.example.com  ─┼──> 203.0.113.10
panel.example.com  ─┘
```

Ketiganya mengarah ke IP yang sama. DNS hanya membantu client menemukan alamat IP server. DNS tidak menentukan aplikasi mana yang harus menerima request.

Lalu bagaimana Caddy membedakannya?

Browser mengirim informasi nama host melalui HTTP `Host` header. Untuk HTTPS, nama domain juga dikirim saat proses TLS melalui Server Name Indication (SNI). Caddy menggunakan informasi tersebut untuk memilih konfigurasi site yang sesuai.

## 4. Menjalankan beberapa aplikasi Go

Sebagai contoh, kita memiliki tiga aplikasi Go. Masing-masing mendengarkan pada loopback interface dengan port berbeda.

```go
// API
http.ListenAndServe("127.0.0.1:3001", apiHandler)

// Agent
http.ListenAndServe("127.0.0.1:3002", agentHandler)

// Dashboard
http.ListenAndServe("127.0.0.1:3003", dashboardHandler)
```

Penggunaan `127.0.0.1` membuat service hanya dapat diakses dari mesin VPS itu sendiri. Caddy yang berjalan pada VPS yang sama tetap dapat mengaksesnya.

Hindari menggunakan `:3001` atau `0.0.0.0:3001` jika service tersebut memang tidak perlu menerima koneksi langsung dari jaringan luar.

## 5. Konfigurasi Caddy untuk banyak domain

Caddy menggunakan file konfigurasi bernama `Caddyfile`. Pada instalasi Linux melalui package resmi, lokasi yang umum digunakan adalah `/etc/caddy/Caddyfile`.

Contoh konfigurasi:

```caddyfile
api.example.com {
    reverse_proxy 127.0.0.1:3001
}

agent.example.com {
    reverse_proxy 127.0.0.1:3002
}

panel.example.com {
    reverse_proxy 127.0.0.1:3003
}
```

Penjelasan:

- Request ke `api.example.com` diteruskan ke port `3001`.
- Request ke `agent.example.com` diteruskan ke port `3002`.
- Request ke `panel.example.com` diteruskan ke port `3003`.

Caddy akan mencoba mengaktifkan HTTPS otomatis untuk hostname publik yang memenuhi persyaratan. Pastikan DNS sudah mengarah ke VPS dan port TCP `80` serta `443` dapat dijangkau dari internet.

### Validasi dan reload konfigurasi

Sebelum menerapkan perubahan, validasi konfigurasi:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

Jika valid, format file lalu reload service:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Untuk melihat status service:

```bash
sudo systemctl status caddy
```

Untuk melihat log:

```bash
sudo journalctl -u caddy -f
```

Reload lebih disarankan daripada menghentikan service setiap kali konfigurasi berubah karena Caddy dapat menerapkan konfigurasi baru tanpa sengaja memutus semua koneksi yang sedang berjalan.

## 6. Bagaimana jika belum punya domain?

Caddy tidak mewajibkan domain untuk semua skenario. Kita tetap bisa menggunakannya dengan IP publik atau port.

### Opsi A: Akses aplikasi langsung melalui port

Tanpa Caddy:

```text
http://203.0.113.10:3001
http://203.0.113.10:3002
http://203.0.113.10:3003
```

Pastikan aplikasi bind ke interface yang dapat menerima koneksi dari luar, lalu buka port yang dibutuhkan di firewall. Cara ini praktis untuk eksperimen, tetapi setiap aplikasi menjadi pintu masuk publik tersendiri.

### Opsi B: Satu IP, satu port Caddy, routing berdasarkan path

Caddy juga dapat membedakan aplikasi berdasarkan path URL:

```caddyfile
:80 {
    handle_path /api/* {
        reverse_proxy 127.0.0.1:3001
    }

    handle_path /agent/* {
        reverse_proxy 127.0.0.1:3002
    }

    handle_path /panel/* {
        reverse_proxy 127.0.0.1:3003
    }
}
```

Request akan diarahkan seperti berikut:

| URL | Backend |
|---|---|
| `http://203.0.113.10/api/` | `127.0.0.1:3001/` |
| `http://203.0.113.10/agent/` | `127.0.0.1:3002/` |
| `http://203.0.113.10/panel/` | `127.0.0.1:3003/` |

Perhatikan penggunaan `handle_path`. Directive ini menghapus prefix yang cocok sebelum request diteruskan. Jadi `/api/users` akan diteruskan ke backend sebagai `/users`.

Jika aplikasi Go memang mengharapkan prefix `/api`, gunakan `handle` alih-alih `handle_path`:

```caddyfile
:80 {
    handle /api/* {
        reverse_proxy 127.0.0.1:3001
    }
}
```

### Opsi C: IP publik tanpa HTTPS

Untuk HTTP biasa pada port 80, konfigurasi berikut dapat digunakan:

```caddyfile
:80 {
    reverse_proxy 127.0.0.1:3001
}
```

Alamat `:80` menyatakan listener HTTP pada port 80 tanpa hostname tertentu. Caddy tidak memerlukan domain untuk konfigurasi ini.

Contoh lain, jika ingin memakai port khusus:

```caddyfile
:8080 {
    reverse_proxy 127.0.0.1:3001
}
```

Akses melalui:

```text
http://203.0.113.10:8080
```

Pastikan port tersebut dibuka di firewall dan firewall provider VPS.

> HTTP tanpa TLS tidak mengenkripsi data saat transit. Jangan gunakan HTTP publik untuk mengirim password, session cookie, API key, access token, atau data sensitif lainnya. Untuk penggunaan privat, pertimbangkan VPN. Untuk layanan publik, gunakan HTTPS.

## 7. Firewall dan batas akses

Jika Caddy menjadi satu-satunya pintu masuk publik, idealnya hanya port yang diperlukan yang dibuka dari internet.

Contoh menggunakan UFW:

```bash
# SSH
sudo ufw allow 22/tcp

# HTTP dan HTTPS untuk Caddy
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Aktifkan firewall jika belum aktif
sudo ufw enable

# Periksa aturan
sudo ufw status
```

Jangan membuka port backend `3001`, `3002`, dan `3003` jika aplikasi hanya perlu diakses oleh Caddy melalui loopback.

Sebelum mengaktifkan UFW pada VPS, pastikan akses SSH sudah diizinkan agar tidak terkunci dari server sendiri. Sesuaikan port SSH jika tidak menggunakan port default.

Selain UFW, periksa juga firewall atau security group yang disediakan provider VPS.

## 8. TLS termination

Ketika menggunakan HTTPS, browser membuat koneksi TLS ke Caddy. Setelah koneksi aman terbentuk, Caddy meneruskan request ke aplikasi backend.

```text
Browser
   |
   | HTTPS (TLS)
   v
Caddy :443
   |
   | HTTP di loopback
   v
Go API :3001
```

Proses ketika proxy menerima dan mengakhiri koneksi TLS dari client disebut **TLS termination**.

Dalam konfigurasi sederhana, koneksi dari Caddy ke backend menggunakan HTTP biasa karena komunikasi berlangsung di mesin yang sama melalui loopback. Jika backend berada di mesin lain atau melewati jaringan yang tidak sepenuhnya dipercaya, pertimbangkan TLS juga pada koneksi upstream.

HTTPS melindungi data antara browser dan Caddy. HTTPS tidak otomatis membuat aplikasi backend aman. Validasi input, autentikasi, otorisasi, rate limiting, dan pengelolaan secret tetap menjadi tanggung jawab aplikasi dan infrastruktur.

## 9. Alur request dari browser sampai aplikasi Go

Mari rangkum alur ketika seseorang membuka `https://api.example.com/users`.

1. Browser mencari alamat IP `api.example.com` melalui DNS.
2. DNS mengembalikan IP publik VPS.
3. Browser membuka koneksi ke VPS melalui port `443`.
4. Browser mengirim informasi hostname saat negosiasi TLS melalui SNI.
5. Caddy menyajikan sertifikat TLS untuk domain tersebut.
6. Setelah koneksi aman terbentuk, browser mengirim HTTP request.
7. Caddy mencocokkan hostname dengan site block `api.example.com`.
8. Caddy meneruskan request ke `127.0.0.1:3001`.
9. Aplikasi Go memproses request dan mengembalikan response.
10. Caddy mengirim response kembali ke browser melalui koneksi HTTPS.

Dengan pola ini, satu VPS dapat menjalankan banyak aplikasi tanpa harus mengekspos setiap port backend ke internet.

## 10. Kapan menggunakan domain, port, atau path?

Ketiganya adalah pilihan routing yang berbeda.

| Pendekatan | Contoh | Cocok untuk |
|---|---|---|
| Port | `IP:3001` | Testing dan service sederhana |
| Subdomain | `api.example.com` | Aplikasi publik yang terpisah |
| Path | `example.com/api` | Beberapa service di bawah satu hostname |

Untuk deployment jangka panjang, subdomain biasanya lebih mudah dipisahkan berdasarkan aplikasi. Path-based routing juga berguna, tetapi perlu memperhatikan konfigurasi base path pada frontend, routing aplikasi, cookie, dan URL redirect.

## 11. Contoh arsitektur VPS untuk beberapa service

Misalnya saya membangun satu VPS yang menjalankan API, dashboard, agent, database, dan cache.

```text
                         INTERNET
                            |
                     DNS: example.com
                            |
                     PUBLIC VPS IP
                            |
                      CADDY :80/:443
                            |
          +-----------------+-----------------+
          |                 |                 |
    api.example.com   panel.example.com  agent.example.com
          |                 |                 |
      Go API :3001     Go Panel :3002     Go Agent :3003
          |                 |                 |
          +-----------------+-----------------+
                            |
                    INTERNAL SERVICES
                       /          \
                PostgreSQL       Redis
                   :5432          :6379
```

Database dan Redis tidak perlu menerima koneksi publik jika hanya digunakan oleh aplikasi di VPS yang sama.

Contoh pembagian port:

| Service | Bind address | Port | Akses publik |
|---|---|---:|---|
| Caddy | `0.0.0.0` | 80 | Ya |
| Caddy | `0.0.0.0` | 443 | Ya |
| Go API | `127.0.0.1` | 3001 | Tidak |
| Go Panel | `127.0.0.1` | 3002 | Tidak |
| Go Agent | `127.0.0.1` | 3003 | Tidak |
| PostgreSQL | `127.0.0.1` | 5432 | Tidak |
| Redis | `127.0.0.1` | 6379 | Tidak |

Bind address pada tabel merupakan contoh untuk service yang berjalan langsung pada host. Jika menggunakan Docker, pengaturan jaringan dan port publishing perlu disesuaikan. Jangan memublikasikan port database hanya karena container perlu berkomunikasi dengan container lain.

## 12. Hal yang perlu diperhatikan

Beberapa hal penting ketika menggunakan Caddy di production:

- **DNS harus benar.** Record domain perlu mengarah ke IP VPS sebelum proses penerbitan sertifikat publik berhasil.
- **Port 80 dan 443 harus dapat dijangkau.** Proses validasi sertifikat dan akses HTTPS membutuhkan konfigurasi jaringan yang sesuai.
- **Jangan expose backend tanpa alasan.** Gunakan loopback atau jaringan privat untuk service internal.
- **Perhatikan WebSocket.** Caddy `reverse_proxy` mendukung WebSocket, tetapi aplikasi tetap perlu menangani koneksi dan autentikasi dengan benar.
- **Simpan konfigurasi dengan rapi.** Pisahkan site block agar mudah dipelihara ketika jumlah aplikasi bertambah.
- **Pantau log.** Gunakan `journalctl` untuk memeriksa error saat Caddy gagal memuat konfigurasi atau menghubungi backend.
- **Jangan menganggap reverse proxy sebagai firewall aplikasi.** Caddy membantu mengatur lalu lintas, tetapi tidak menggantikan kontrol keamanan di backend.

## Kesimpulan

Caddy memudahkan kita mengelola beberapa aplikasi pada satu VPS. Dengan reverse proxy, setiap aplikasi Go dapat berjalan pada port internal yang berbeda, sementara pengguna mengaksesnya melalui domain atau path yang lebih mudah diingat.

Hal yang paling penting untuk dipahami adalah pembagian tanggung jawab:

- DNS menerjemahkan hostname menjadi IP.
- Caddy menerima request dan memilih backend berdasarkan hostname atau path.
- Aplikasi Go menjalankan logika bisnis.
- Firewall membatasi port yang dapat dijangkau dari luar.
- TLS melindungi komunikasi antara client dan reverse proxy.

Untuk eksperimen, akses melalui IP dan port tetap bisa digunakan. Ketika aplikasi mulai dipublikasikan, gunakan domain, HTTPS, dan backend yang tidak terekspos langsung ke internet.

Caddy bukan sekadar web server di depan aplikasi. Ia adalah salah satu komponen penting untuk membangun deployment VPS yang rapi, terstruktur, dan mudah dikembangkan.
