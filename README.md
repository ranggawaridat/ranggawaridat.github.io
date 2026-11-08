# Rangga Waridat

Blog pribadi untuk mendokumentasikan proses belajar software development, terutama backend dengan Go. Isinya berupa catatan, eksperimen, dan hal-hal yang dipelajari saat membangun project.

Situs ini dibuat dengan [Jekyll](https://jekyllrb.com/) dan dipublikasikan melalui GitHub Pages.

**Situs:** [ranggawaridat.github.io](https://ranggawaridat.github.io)

## Menambahkan project

Buat folder baru langsung di dalam `projects/` dan letakkan `index.html` sebagai halaman utama, misalnya `projects/nama-project/index.html`. Project akan otomatis muncul di bagian **Projects** pada halaman utama; tidak perlu menambahkan daftar project secara manual.

Opsional, tambahkan front matter berikut di bagian paling atas `index.html` untuk mengatur informasi kartu:

```yaml
---
project_title: "Nama Project"
project_description: "Deskripsi singkat project."
project_category: "WEB APP"
---
```

Folder di dalam folder project (misalnya `web/`) tidak akan ditampilkan sebagai project terpisah.