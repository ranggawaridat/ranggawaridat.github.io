---
layout: post
title: "DNS dan TLS: Domain Resolution & Secure Communication"
date: 2026-11-09
description: "Catatan tentang cara kerja DNS, DNS records, recursive resolution, TLS handshake, sertifikat digital, HTTPS, dan implementasinya pada Go API di VPS."
---

# DNS dan TLS: Domain Resolution & Secure Communication

## 1. Pendahuluan

Ketika pengguna mengakses sebuah aplikasi melalui alamat seperti `https://api.example.com`, terdapat beberapa proses jaringan yang terjadi sebelum aplikasi dapat menerima request.

Dua teknologi penting dalam proses tersebut adalah:

- **DNS (Domain Name System):** menerjemahkan nama domain menjadi informasi jaringan, seperti alamat IP.
- **TLS (Transport Layer Security):** melindungi komunikasi dengan enkripsi, integritas data, dan autentikasi identitas server.

DNS membantu client menemukan server tujuan, sedangkan TLS memastikan komunikasi dengan server berlangsung secara aman.

Secara sederhana, alurnya adalah:

```text
Client
  |
  v
DNS Resolution
  |
  v
Server IP Address
  |
  v
TCP Connection
  |
  v
TLS Handshake
  |
  v
HTTPS Request
  |
  v
Server Response
```

---

# 2. DNS (Domain Name System)

## 2.1 Apa Itu DNS?

DNS adalah sistem penamaan hierarkis dan terdistribusi yang digunakan untuk menerjemahkan nama domain menjadi informasi terkait jaringan.

Manusia lebih mudah mengingat:

```text
api.example.com
```

Daripada mengingat:

```text
203.0.113.10
```

Komputer menggunakan alamat IP untuk melakukan komunikasi jaringan. DNS menyediakan mekanisme agar aplikasi dapat menemukan alamat IP berdasarkan nama domain.

DNS tidak hanya menangani alamat IP. DNS juga menyimpan berbagai informasi lain melalui DNS Record.

## 2.2 DNS Hierarchy

DNS memiliki struktur hierarkis yang terdiri dari beberapa tingkatan.

```text
                    Root (.)
                       |
              -----------------
              |               |
             .com            .dev
              |               |
          example.com     example.dev
              |
          api.example.com
```

Komponen utama dalam DNS resolution:

1. **Stub Resolver**

   Komponen pada perangkat client yang mengirimkan permintaan resolusi DNS ke recursive resolver.

2. **Recursive Resolver**

   Server yang bertugas mencari jawaban DNS untuk client. Resolver dapat menggunakan cache sebelum melakukan pencarian lebih lanjut.

3. **Root DNS Server**

   Memberikan informasi mengenai nameserver untuk Top-Level Domain (TLD) yang diminta.

4. **TLD DNS Server**

   Mengarahkan pencarian menuju authoritative nameserver untuk domain tertentu.

5. **Authoritative DNS Server**

   Menyediakan jawaban resmi untuk DNS zone yang dikelolanya.

## 2.3 Proses DNS Resolution

Misalnya aplikasi ingin mengakses:

```text
api.example.com
```

Client belum mengetahui alamat IP server.

Secara konseptual, proses resolusinya:

```text
Client
  |
  | Query: api.example.com
  v
Recursive Resolver
  |
  | Query Root
  v
Root DNS Server
  |
  | Referral ke .com
  v
TLD DNS Server
  |
  | Referral ke authoritative NS
  v
Authoritative DNS Server
  |
  | Answer: 203.0.113.10
  v
Recursive Resolver
  |
  | Response
  v
Client
```

Setelah mendapatkan alamat IP, client dapat melanjutkan proses koneksi TCP dan TLS.

**Catatan:** Tidak semua query harus melewati seluruh hierarki DNS. Recursive resolver dapat mengembalikan jawaban dari cache jika masih valid.

## 2.4 Jenis DNS Record

DNS menggunakan berbagai jenis record untuk menyimpan informasi.

| Record | Fungsi | Contoh |
|---|---|---|
| A | Menghubungkan domain ke IPv4 | `203.0.113.10` |
| AAAA | Menghubungkan domain ke IPv6 | `2001:db8::10` |
| CNAME | Membuat alias ke domain lain | `www → example.com` |
| MX | Menentukan mail server | `mail.example.com` |
| TXT | Menyimpan informasi teks | SPF, DKIM, verifikasi domain |
| NS | Menentukan authoritative nameserver | `ns1.example.net` |
| PTR | Reverse DNS, IP ke nama domain | `203.0.113.10 → example.com` |
| SRV | Menentukan lokasi layanan | Host dan port layanan |

Contoh konfigurasi DNS zone:

```dns
example.com.       3600 IN A      203.0.113.10
api.example.com.   3600 IN A      203.0.113.10
www.example.com.   3600 IN CNAME example.com.
example.com.       3600 IN MX 10  mail.example.com.
```

## 2.5 TTL dan DNS Caching

TTL (Time To Live) menentukan berapa lama sebuah DNS response dapat disimpan dalam cache.

Contoh:

```text
api.example.com → 203.0.113.10
TTL = 3600
```

Artinya jawaban tersebut dapat disimpan selama maksimal 3600 detik.

Caching mengurangi jumlah DNS query dan mempercepat resolusi domain.

Namun, caching juga memiliki konsekuensi ketika alamat IP server berubah.

Misalnya:

```text
IP Lama: 203.0.113.10
IP Baru: 198.51.100.20
```

Resolver yang masih menyimpan jawaban lama mungkin tetap memberikan IP lama sampai cache kedaluwarsa atau diperbarui.

Karena itu, sebelum migrasi server, administrator sering menurunkan TTL agar perubahan DNS dapat diadopsi lebih cepat oleh resolver.

## 2.6 DNS Transport Protocol

DNS tradisional umumnya menggunakan:

- UDP port 53 untuk query standar.
- TCP port 53 untuk kondisi tertentu, respons besar, dan zone transfer.

Beberapa teknologi DNS modern:

| Teknologi | Deskripsi |
|---|---|
| DoT | DNS over TLS |
| DoH | DNS over HTTPS |
| DoQ | DNS over QUIC |
| DNSSEC | Memverifikasi autentisitas dan integritas data DNS |

DNSSEC tidak mengenkripsi DNS query. Fungsinya adalah memberikan validasi kriptografis terhadap data DNS.

## 2.7 Praktik Menggunakan dig

`dig` adalah utilitas untuk melakukan DNS query dan menganalisis hasilnya.

Melihat DNS record:

```bash
dig example.com
```

Melihat IPv4:

```bash
dig example.com A
```

Melihat IPv6:

```bash
dig example.com AAAA
```

Melihat nameserver:

```bash
dig example.com NS
```

Melihat mail server:

```bash
dig example.com MX
```

Melihat TXT:

```bash
dig example.com TXT
```

Menggunakan resolver tertentu:

```bash
dig @1.1.1.1 example.com
dig @8.8.8.8 example.com
```

Menampilkan jawaban secara singkat:

```bash
dig +short example.com
```

Menelusuri hierarki DNS:

```bash
dig +trace example.com
```

### DNS Response Status

| Status | Makna |
|---|---|
| NOERROR | Query berhasil diproses |
| NXDOMAIN | Nama domain tidak ditemukan |
| SERVFAIL | Resolver gagal menyelesaikan query |
| REFUSED | Server menolak query |

---

# 3. TLS (Transport Layer Security)

## 3.1 Apa Itu TLS?

TLS adalah protokol keamanan yang digunakan untuk melindungi komunikasi melalui jaringan.

TLS menyediakan tiga properti keamanan utama:

1. **Confidentiality:** menjaga agar isi komunikasi tidak dapat dibaca pihak yang tidak berwenang.
2. **Integrity:** memastikan perubahan data dapat dideteksi.
3. **Authentication:** membantu memverifikasi identitas server.

TLS merupakan penerus SSL. SSL sudah usang dan tidak direkomendasikan untuk penggunaan modern.

Versi TLS modern yang umum digunakan adalah TLS 1.2 dan TLS 1.3.

## 3.2 HTTP vs HTTPS

HTTP merupakan protokol komunikasi aplikasi.

HTTPS adalah HTTP yang dilindungi TLS.

```text
HTTP
  |
  v
TCP
  |
  v
IP
```

Sedangkan HTTPS:

```text
HTTP
  |
  v
TLS
  |
  v
TCP
  |
  v
IP
```

Pada HTTP/3, HTTP berjalan di atas QUIC yang menggunakan UDP, bukan TCP.

HTTPS melindungi data HTTP, termasuk request body, response body, dan sebagian besar header aplikasi.

Namun, TLS tidak menyembunyikan seluruh metadata jaringan. Alamat IP tujuan dan sejumlah informasi koneksi masih dapat terlihat.

## 3.3 TLS Handshake

Sebelum pertukaran data aplikasi dilakukan, client dan server perlu membangun koneksi TLS.

Pada TLS 1.3, gambaran umum full handshake adalah:

```text
Client                         Server
  |                               |
  | -------- ClientHello -------> |
  |                               |
  | <-------- ServerHello ------- |
  | <--- Encrypted Extensions --- |
  | <-------- Certificate ------- |
  | <---- CertificateVerify ----- |
  | <---------- Finished -------- |
  |                               |
  | --------- Finished ---------> |
  |                               |
  | ===== Encrypted Data ======== |
```

### 1. ClientHello

Client mengirim informasi mengenai kemampuan TLS yang didukung.

Informasi tersebut dapat mencakup:

- Supported TLS versions.
- Cipher suites.
- Key share.
- Server Name Indication (SNI).
- Application-Layer Protocol Negotiation (ALPN).

### 2. ServerHello

Server memilih parameter koneksi yang disepakati berdasarkan kemampuan client dan server.

Pada TLS 1.3, server juga memberikan key share untuk menyelesaikan proses key exchange.

### 3. Certificate

Server mengirim sertifikat digital yang berisi identitas domain dan public key.

Client memverifikasi sertifikat berdasarkan:

- Masa berlaku.
- Kecocokan nama domain.
- Rantai sertifikat.
- Tanda tangan digital.
- Status pencabutan sertifikat, jika pemeriksaan dilakukan.

### 4. CertificateVerify

Server membuktikan kepemilikan private key yang sesuai dengan public key pada sertifikat melalui tanda tangan digital atas informasi handshake.

### 5. Finished

Kedua pihak mengirim pesan Finished untuk membuktikan bahwa handshake berhasil dan pesan sebelumnya tidak dimodifikasi.

Setelah proses tersebut selesai, komunikasi aplikasi dapat menggunakan kunci enkripsi simetris yang telah diturunkan dari shared secrets.

## 3.4 Asymmetric dan Symmetric Cryptography

TLS menggunakan konsep kriptografi asimetris dan simetris.

### Asymmetric Cryptography

Menggunakan dua kunci:

- Public key.
- Private key.

Public key dapat dibagikan, sedangkan private key harus dijaga kerahasiaannya.

Dalam TLS, sertifikat mengikat identitas server dengan public key. Server menggunakan private key untuk membuktikan kepemilikan identitas tersebut.

### Symmetric Cryptography

Menggunakan secret key untuk mengenkripsi dan mendekripsi data.

Setelah handshake, TLS menggunakan symmetric encryption untuk melindungi komunikasi aplikasi.

Contoh algoritma:

- AES-GCM.
- ChaCha20-Poly1305.

Kriptografi simetris lebih efisien untuk mengenkripsi data dalam jumlah besar.

**Catatan:** TLS 1.3 umumnya menggunakan ephemeral Diffie-Hellman untuk key exchange. Public key sertifikat tidak digunakan untuk mengenkripsi seluruh komunikasi.

## 3.5 Digital Certificate

Sertifikat digital digunakan untuk menghubungkan identitas domain dengan public key.

Contoh informasi sertifikat:

```text
Subject:
  CN = api.example.com

Issuer:
  Let's Encrypt

Validity:
  Not Before: ...
  Not After: ...

Subject Alternative Name:
  DNS:api.example.com

Public Key:
  ...
```

Komponen penting:

- **Subject:** identitas yang tercantum dalam sertifikat.
- **Issuer:** Certificate Authority yang menerbitkan atau menandatangani sertifikat.
- **Validity:** periode berlakunya sertifikat.
- **SAN:** daftar nama domain atau identitas yang dicakup sertifikat.
- **Public Key:** kunci publik yang terikat pada identitas sertifikat.

Browser modern memeriksa kecocokan hostname melalui Subject Alternative Name (SAN).

## 3.6 Certificate Authority

Certificate Authority (CA) merupakan pihak yang menerbitkan atau menandatangani sertifikat digital berdasarkan proses validasi.

Contoh CA:

- Let's Encrypt.
- DigiCert.
- GlobalSign.

Rantai kepercayaan sertifikat secara sederhana:

```text
Trusted Root CA
      |
      v
Intermediate CA
      |
      v
Server Certificate
      |
      v
api.example.com
```

Sistem operasi dan browser memiliki kumpulan root CA yang dipercaya.

Jika sertifikat dan rantai kepercayaannya valid serta nama domain cocok, client dapat mempercayai identitas server.

## 3.7 SNI dan ALPN

Dua ekstensi TLS yang penting dalam deployment modern adalah SNI dan ALPN.

### SNI (Server Name Indication)

SNI memberi tahu server nama domain yang ingin diakses client.

Contoh:

```text
SNI: api.example.com
```

Hal ini memungkinkan satu IP address melayani beberapa domain dengan sertifikat berbeda.

### ALPN (Application-Layer Protocol Negotiation)

ALPN digunakan untuk menegosiasikan protokol aplikasi yang akan digunakan.

Contoh:

```text
h2
http/1.1
```

Dengan ALPN, client dan server dapat menyepakati penggunaan HTTP/2 atau HTTP/1.1 melalui TLS.

## 3.8 Mutual TLS (mTLS)

Dalam HTTPS biasa, client umumnya memverifikasi sertifikat server.

Pada mutual TLS, kedua pihak saling mengautentikasi menggunakan sertifikat.

```text
Client Certificate
        |
        v
      Server
        |
        v
Server Certificate
        |
        v
      Client
```

mTLS sering digunakan pada:

- Komunikasi antar-service.
- Internal API.
- Sistem enterprise.
- Infrastruktur microservices.
- Zero-trust network architecture.

---

# 4. DNS dan TLS dalam Praktik

DNS dan TLS saling berkaitan dalam proses akses aplikasi melalui domain.

Misalnya aplikasi memiliki alamat:

```text
https://api.example.com
```

Alur komunikasi:

```text
1. Client meminta resolusi api.example.com
             |
             v
2. DNS resolver mengembalikan IP server
             |
             v
3. Client membuat TCP connection ke port 443
             |
             v
4. TLS handshake dilakukan
             |
             v
5. Server mengirim sertifikat
             |
             v
6. Client memverifikasi sertifikat
             |
             v
7. Koneksi TLS siap digunakan
             |
             v
8. Client mengirim HTTP request
             |
             v
9. Server mengirim HTTP response
```

## 4.1 Mengamati DNS dengan dig

```bash
dig api.example.com A
```

Mencari IPv6:

```bash
dig api.example.com AAAA
```

Menggunakan resolver Cloudflare:

```bash
dig @1.1.1.1 api.example.com
```

Melihat jalur delegasi:

```bash
dig +trace api.example.com
```

## 4.2 Mengamati TLS dengan OpenSSL

Menghubungkan ke server menggunakan TLS:

```bash
openssl s_client \
  -connect api.example.com:443 \
  -servername api.example.com
```

Menampilkan informasi sertifikat:

```bash
openssl s_client \
  -connect api.example.com:443 \
  -servername api.example.com \
  </dev/null 2>/dev/null |
openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

Opsi `-servername` digunakan untuk mengirim SNI.

## 4.3 Mengamati HTTPS dengan curl

```bash
curl -v https://api.example.com
```

Perintah ini membantu melihat:

- Proses koneksi.
- Informasi TLS.
- Sertifikat server.
- HTTP request.
- HTTP response.

Melihat response headers:

```bash
curl -I https://api.example.com
```

---

# 5. Implementasi DNS dan TLS pada Go API di VPS

Salah satu skenario deployment sederhana:

```text
Internet
   |
   v
DNS Provider
   |
   v
api.example.com
   |
   v
VPS Public IP
   |
   v
Caddy Reverse Proxy
   |
   v
Go API :8080
```

## 5.1 Konfigurasi DNS

Tambahkan record pada DNS provider:

| Type | Name | Value |
|---|---|---|
| A | api | IP VPS |

Jika VPS juga memiliki IPv6 yang dapat dijangkau, tambahkan record AAAA yang sesuai.

Verifikasi:

```bash
dig +short api.example.com
```

## 5.2 Menjalankan Go HTTP Server

Contoh sederhana:

```go
package main

import (
    "fmt"
    "log"
    "net/http"
)

func main() {
    http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintln(w, "API is healthy")
    })

    log.Println("Server listening on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

Jalankan:

```bash
go run main.go
```

Tes:

```bash
curl http://127.0.0.1:8080/health
```

## 5.3 Menggunakan Caddy sebagai Reverse Proxy

Contoh konfigurasi Caddyfile:

```caddyfile
api.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Caddy dapat mengelola sertifikat TLS secara otomatis apabila domain mengarah ke VPS dan persyaratan validasi sertifikat terpenuhi.

Pastikan:

- DNS record benar.
- Port 80 dan 443 dapat diakses dari internet.
- Firewall mengizinkan koneksi.
- Server memiliki akses jaringan yang diperlukan untuk validasi CA.

Setelah konfigurasi aktif, tes:

```bash
curl -v https://api.example.com/health
```

Caddy akan menerima HTTPS dari client dan meneruskan request ke Go API melalui koneksi lokal.

Untuk deployment produksi, Go API sebaiknya dijalankan sebagai systemd service atau container agar proses tetap berjalan setelah sesi terminal berakhir.

---

# 6. Troubleshooting DNS dan TLS

| Masalah | Kemungkinan penyebab | Tools |
|---|---|---|
| Domain tidak ditemukan | Record DNS salah atau NXDOMAIN | `dig` |
| IP domain belum berubah | DNS cache atau TTL | `dig` |
| DNS gagal dijawab | Resolver bermasalah atau SERVFAIL | `dig` |
| Connection refused | Tidak ada service yang listening | `ss`, `curl` |
| Connection timeout | Firewall atau routing | `tcpdump`, `traceroute` |
| Certificate expired | Sertifikat kedaluwarsa | `openssl s_client` |
| Certificate mismatch | SAN tidak cocok dengan domain | `openssl x509` |
| TLS handshake failure | Konfigurasi TLS atau kompatibilitas | `curl -v`, `openssl` |
| HTTPS tidak bisa diakses | Port 443 atau konfigurasi reverse proxy | `ss`, `curl`, `journalctl` |

## 6.1 DNS Troubleshooting

```bash
dig api.example.com
dig @1.1.1.1 api.example.com
dig +trace api.example.com
```

Bandingkan hasil dari resolver berbeda untuk mengetahui apakah masalah berasal dari DNS authoritative atau cache resolver.

## 6.2 TLS Troubleshooting

```bash
openssl s_client \
  -connect api.example.com:443 \
  -servername api.example.com
```

Periksa:

- Certificate chain.
- Certificate validity.
- Hostname.
- TLS version.
- Cipher suite.
- Verification result.

Untuk memeriksa HTTP response:

```bash
curl -v https://api.example.com
```

---

# 7. Security Considerations

Beberapa hal penting saat mengelola DNS dan TLS:

1. Gunakan TLS 1.2 atau TLS 1.3 dan hindari SSL serta versi TLS lama yang tidak aman.
2. Jaga private key sertifikat agar tidak dapat diakses sembarang pengguna.
3. Gunakan certificate renewal otomatis.
4. Pastikan SAN sertifikat sesuai dengan domain.
5. Gunakan DNSSEC jika diperlukan untuk memvalidasi autentisitas data DNS.
6. Jangan menganggap DNS biasa sudah terenkripsi.
7. Gunakan DoH atau DoT jika membutuhkan perlindungan tambahan untuk query DNS.
8. Hindari menonaktifkan verifikasi sertifikat TLS pada aplikasi produksi.
9. Pertimbangkan mTLS untuk komunikasi service-to-service yang membutuhkan autentikasi dua arah.
10. Monitor masa berlaku sertifikat dan kegagalan DNS resolution.

---

# 8. Ringkasan

| Komponen | Tanggung Jawab |
|---|---|
| DNS | Menerjemahkan nama domain menjadi informasi jaringan |
| DNS Resolver | Mencari jawaban DNS untuk client |
| DNS Record | Menyimpan informasi domain |
| TTL | Mengatur masa berlaku cache DNS |
| DNSSEC | Memvalidasi autentisitas dan integritas data DNS |
| TLS | Melindungi komunikasi jaringan |
| Certificate | Mengikat identitas dengan public key |
| CA | Menerbitkan atau menandatangani sertifikat |
| SNI | Menentukan domain tujuan pada TLS handshake |
| ALPN | Menegosiasikan protokol aplikasi |
| mTLS | Mengautentikasi client dan server |

## 9. Referensi

- [RFC 1034 — Domain Names: Concepts and Facilities](https://www.rfc-editor.org/rfc/rfc1034)
- [RFC 1035 — Domain Names: Implementation and Specification](https://www.rfc-editor.org/rfc/rfc1035)
- [RFC 4033 — DNS Security Introduction and Requirements](https://www.rfc-editor.org/rfc/rfc4033)
- [RFC 7858 — DNS over TLS](https://www.rfc-editor.org/rfc/rfc7858)
- [RFC 8484 — DNS Queries over HTTPS](https://www.rfc-editor.org/rfc/rfc8484)
- [RFC 8446 — The Transport Layer Security (TLS) Protocol Version 1.3](https://www.rfc-editor.org/rfc/rfc8446)
- [RFC 9113 — HTTP/2](https://www.rfc-editor.org/rfc/rfc9113)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

**Catatan akhir:** DNS bertanggung jawab membantu client menemukan server, sedangkan TLS bertanggung jawab melindungi komunikasi dengan server tersebut. Keduanya merupakan fondasi penting untuk membangun, mengamankan, dan melakukan deployment Go API di internet.