# AstroNLP AI - Microservices Astrology & AI Platform

AstroNLP AI is a high-performance, AI-powered astrology platform that generates birth charts, provides detailed planetary predictions, and features a RAG-powered chatbot and PDF report generator.

## Architecture Outline
- **API Gateway (Go / Gin)**: Gateway service on port `8080` handling CORS, rate limiting, and JWT validation.
- **Auth Service (Go)**: Port `8081` managing registration, logins, and token claims.
- **User Service (Go)**: Port `8082` for user profile queries and updates.
- **Chart Service (Go)**: Port `8083` calculating planetary longitudes, Nakshatras, Houses, Dashas, and Yogas/Doshas natively.
- **Prediction Service (Python FastAPI)**: Port `8084` orchestrating AI chatbot responses (Qdrant RAG + Gemini), Compatibility evaluations, and PDF Report compilation.
- **Frontend (React + TS + Vite)**: Port `3000` with a deep-space glassmorphism UI.

---

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Go (v1.20+)
- Python (v3.8+)
- Node.js (v18+)

---

### Windows Quick Start (Recommended)
If you are on Windows, you can start the entire stack (Docker infrastructure, all 5 backend microservices, and the frontend dev server) with a single command:
```bash
.\start-all.ps1
```
To stop all services and tear down containers:
```bash
.\stop-all.ps1
```

---

### Step 1: Spin Up Infrastructure Services (Manual Setup)
Start PostgreSQL, Redis, Qdrant, NATS, and MinIO in the background:
```bash
docker compose up -d
```
*Wait ~10 seconds for databases to initialize. The SQL schemas in `scripts/init.sql` will execute automatically.*

---

### Step 2: Set Environment Variables (Optional)
If you have a Gemini API key for the AI chatbot and predictions, set it:
```bash
# On Windows Powershell
$env:GEMINI_API_KEY="your-gemini-api-key"

# On Linux/macOS
export GEMINI_API_KEY="your-gemini-api-key"
```
*If not set, the Prediction service will seamlessly fallback to robust rule-based predictions and mock chatbot interpretations.*

---

### Step 3: Launch Python Prediction Service
Initialize the virtual environment, install requirements, and start FastAPI:
```bash
cd services/prediction
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
python main.py
```
*Upon startup, the script connects to Qdrant, creates the `astrology_knowledge` collection, and embeds/seeds the knowledge base automatically.*

---

### Step 4: Run Go Services
You can run the API Gateway and Go microservices in separate terminals. In the root directory:

**Start API Gateway (Port 8080)**:
```bash
go run gateway/main.go
```

**Start Auth Service (Port 8081)**:
```bash
PORT=8081 go run services/auth/main.go
```

**Start User Service (Port 8082)**:
```bash
PORT=8082 go run services/user/main.go
```

**Start Chart Service (Port 8083)**:
```bash
PORT=8083 go run services/chart/main.go
```

---

### Step 5: Start React Frontend
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Verification & Testing Flows
1. **Register/Login**: Create a user on the launch screen.
2. **Chart Generation**: Enter birth parameters. The UI will instantly display a custom glowing SVG Birth Chart wheel with calculated signs, planet house placements, and Vimshottari dasha cycles.
3. **Ask AI**: Ask a question like "Explain Rahu Mahadasha." In the Chat tab. You will see citation snippets sourced dynamically from the Qdrant RAG database.
4. **Partner Compatibility**: Enter a partner's details in the Compatibility tab. The system evaluates Moon-Nakshatra relationships and renders a comparative breakdown.
5. **PDF Archives**: Trigger "Generate New PDF" in the Reports tab. The background task compiles details into a PDF layout, uploads it to MinIO object storage, and updates the link for instant save.
