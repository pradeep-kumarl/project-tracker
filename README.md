# Project Tracker Web Application

A modern, secure 3-tier Project & Task Management system with automated notifications, Excel bulk upload, and CI/CD ready architecture.

## 🚀 Quick Setup & Run Instructions

### 1. Backend Server
```bash
cd E:\stackly\project-tracker\backend
npm install
npm start
```
*Backend runs at:* `http://localhost:5000`

### 2. Frontend Web App
```bash
cd E:\stackly\project-tracker\frontend
npm install
npm start
```
*Frontend runs at:* `http://localhost:3000`

---

## 🔒 Security & Anti-Hacking Features

1. **SQL Injection Security**: Uses MySQL parameterized prepared statements (`?` parameters) across all database operations.
2. **XSS Protection**: HTML output rendering uses strict data sanitization.
3. **Environment Security**: All sensitive SMTP credentials and DB passwords isolated in `.env` and kept out of version control.
4. **CORS Middleware**: Restricts backend API exposure.

---

## 🐳 Docker Deployment
```bash
docker-compose up --build
```
