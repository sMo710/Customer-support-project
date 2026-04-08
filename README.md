# MindX Service AI - Customer Support System

Production-style customer support platform with:
- Customer chat with AI responses
- Ticket creation and lifecycle management
- Admin dashboard for ticket operations
- Real-time updates with WebSocket
- Analytics dashboard

---

## Tech Stack Used

### Backend
- Java 21
- Spring Boot
- Spring Web (REST APIs)
- Spring Data JPA / Hibernate
- Spring Security (JWT-based auth)
- Spring WebSocket (STOMP + SockJS)
- Maven

### Frontend
- React.js
- React Router
- Axios
- Recharts (analytics charts)
- STOMP + SockJS client

### Database
- MySQL

---

## Features Implemented

### Authentication & Authorization
- User registration and login
- Role-based access (`CUSTOMER`, `ADMIN`)
- JWT-protected APIs

### Customer Chat Flow
- Customer sends query
- Ticket is created automatically
- User message is stored in DB
- AI response is generated and stored in DB
- Messages are displayed in chat UI

### Ticket Management
- Get all tickets
- Get ticket by ID with full conversation
- Update ticket status (`OPEN`, `RESOLVED`, `NEEDS_HUMAN`)
- Search tickets and view stats

### Smart Escalation Logic
- Auto-escalates to `NEEDS_HUMAN` for high-risk queries (e.g. refund/complaint/angry)
- Human handoff-friendly messaging

### Order-Aware Conversation Behavior
- Maintains ticket-level order context (`lastOrderId`)
- Reuses provided order ID for follow-up actions where applicable

### Real-Time Updates
- WebSocket topic updates for ticket messages/status
- Admin and customer views can receive near real-time updates

### Admin & Analytics UI
- Admin dashboard with filters and ticket sections
- Ticket detail chat page for admin replies
- Analytics page with KPI cards and charts

### UX & Validation
- Clean modern UI with shared styling system
- Register page password policy and confirm-password validation
- Input/message empty-check validation

---

## Setup Instructions

## Prerequisites
- Java 21+
- Node.js 18+ and npm
- MySQL 8+

## 1) Clone
```bash
git clone https://github.com/sMo710/Customer-support-project.git
cd Customer-support-project
```

## 2) Configure Backend Environment
Set environment variables (recommended) before starting backend:

- `DB_USERNAME` (example: `root`)
- `DB_PASSWORD` (your MySQL password)
- `GROQ_API_KEY` (your AI provider key)
- `JWT_SECRET` (long random secret string)

Windows CMD example:
```cmd
set DB_USERNAME=root
set DB_PASSWORD=your_db_password
set GROQ_API_KEY=your_groq_key
set JWT_SECRET=your_long_random_secret
```

> Database used by default: `bonsai_serviceai`

## 3) Run Backend
```cmd
cd serviceai
mvnw.cmd spring-boot:run
```
Backend runs on `http://localhost:8080`.

## 4) Run Frontend
Open a new terminal:
```cmd
cd frontend
npm install
npm start
```
Frontend runs on `http://localhost:3000`.

## 5) Default Flow to Verify
1. Register a customer/admin account
2. Login as customer and send a chat query
3. Login as admin and open dashboard/ticket details
4. Update status and send admin reply
5. Check analytics page

---

## Project Structure

```text
serviceai/   -> Spring Boot backend
frontend/    -> React frontend
```

---

## Notes
- Keep secrets in environment variables, not in committed files.
- If Maven shows JDK mismatch, ensure `mvnw.cmd -v` is using Java 21+.
