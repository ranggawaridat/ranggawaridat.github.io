---
layout: post
title: "Git Cheatsheet"
date: 2026-09-29
description: "Cheat sheet perintah Git yang sering digunakan untuk mengelola repository, branch, commit, remote, dan perubahan kode."
---

## Setup

### Check Git Version

```bash
git --version
```

### Set Username

```bash
git config --global user.name "Your Name"
```

### Set Email

```bash
git config --global user.email "you@example.com"
```

### Check Configuration

```bash
git config --list
```

---

## Repository

### Initialize Repository

```bash
git init
```

### Clone Repository

```bash
git clone <repository-url>
```

Example:

```bash
git clone git@github.com:username/project.git
```

---

## Status & Changes

### Check Status

```bash
git status
```

### See Changes

```bash
git diff
```

### See Staged Changes

```bash
git diff --staged
```

---

## Add & Commit

### Add One File

```bash
git add <file>
```

### Add All Changes

```bash
git add .
```

### Commit

```bash
git commit -m "your commit message"
```

### Add & Commit

```bash
git commit -am "your commit message"
```

> `-a` hanya bekerja untuk file yang sudah pernah di-track Git.

---

## Log

### View Commit History

```bash
git log
```

### Compact Log

```bash
git log --oneline
```

### Graph

```bash
git log --oneline --graph --all
```

---

## Branch

### List Branches

```bash
git branch
```

### Create Branch

```bash
git branch <branch-name>
```

### Switch Branch

```bash
git switch <branch-name>
```

### Create & Switch

```bash
git switch -c <branch-name>
```

### Delete Branch

```bash
git branch -d <branch-name>
```

### Rename Current Branch

```bash
git branch -m <new-name>
```

---

## Merge

### Merge Branch

```bash
git switch main
git merge <branch-name>
```

### Abort Merge

```bash
git merge --abort
```

---

## Remote

### Check Remote

```bash
git remote -v
```

### Add Remote

```bash
git remote add origin <repository-url>
```

### Change Remote URL

```bash
git remote set-url origin <repository-url>
```

### Remove Remote

```bash
git remote remove origin
```

---

## Push & Pull

### Push

```bash
git push
```

### Push New Branch

```bash
git push -u origin <branch-name>
```

Setelah itu cukup:

```bash
git push
```

### Pull

```bash
git pull
```

### Fetch

```bash
git fetch
```

### Fetch All Branches

```bash
git fetch --all
```

### Push Local Branch to Remote

```bash
git push origin <branch-name>
```

---

## Undo Changes

### Unstage File

```bash
git restore --staged <file>
```

### Discard Changes

```bash
git restore <file>
```

> Hati-hati: perubahan yang belum di-commit bisa hilang.

### Undo Last Commit but Keep Changes

```bash
git reset --soft HEAD~1
```

### Undo Last Commit and Unstage Changes

```bash
git reset HEAD~1
```

### Hard Reset

```bash
git reset --hard HEAD~1
```

> Hati-hati: perubahan dapat hilang.

---

## Stash

### Save Changes Temporarily

```bash
git stash
```

### List Stashes

```bash
git stash list
```

### Apply Latest Stash

```bash
git stash pop
```

### Apply Without Removing Stash

```bash
git stash apply
```

### Delete Stash

```bash
git stash drop
```

---

## Tag

### Create Tag

```bash
git tag v1.0.0
```

### List Tags

```bash
git tag
```

### Push Tag

```bash
git push origin v1.0.0
```

### Push All Tags

```bash
git push --tags
```

---

## Remote HTTPS → SSH

Check remote:

```bash
git remote -v
```

Change to SSH:

```bash
git remote set-url origin git@github.com:username/project.git
```

Test SSH:

```bash
ssh -T git@github.com
```

---

## Common Workflow

Workflow Git yang paling sering digunakan:

```bash
git status

git add .

git commit -m "add new feature"

git push
```

Untuk bekerja dengan branch:

```bash
git switch -c feature/todo

# coding...

git add .
git commit -m "add todo feature"

git push -u origin feature/todo
```

---

## Quick Reference

| Task          | Command                       |
| ------------- | ----------------------------- |
| Initialize    | `git init`                    |
| Clone         | `git clone <url>`             |
| Status        | `git status`                  |
| Add           | `git add .`                   |
| Commit        | `git commit -m "message"`     |
| Log           | `git log --oneline`           |
| Branch        | `git branch`                  |
| Switch        | `git switch <branch>`         |
| Create branch | `git switch -c <branch>`      |
| Merge         | `git merge <branch>`          |
| Pull          | `git pull`                    |
| Push          | `git push`                    |
| Fetch         | `git fetch`                   |
| Remote        | `git remote -v`               |
| Stash         | `git stash`                   |
| Restore       | `git restore <file>`          |
| Unstage       | `git restore --staged <file>` |
| Tag           | `git tag <name>`              |

---

## Most Used Commands

Kalau cuma mau mengingat perintah yang paling penting:

```bash
git status
git add .
git commit -m "message"
git push
git pull
git switch -c feature/name
git switch main
git merge feature/name
git log --oneline
git remote -v
```
