# Premium RAG Pipeline 🧠

A full-stack, production-ready **Retrieval-Augmented Generation (RAG)** application featuring a beautiful dark glassmorphism UI. 

Chat with your technical documents, academic papers, and notes using local semantic search and cloud LLMs.

![RAG Interface Demo](image.png)

## ✨ Architecture & Data Flow

This application uses a modular RAG architecture designed for high-performance local retrieval:

```text
[ Document Upload ] → LangChain Loaders (PDF, TXT, CSV, JSON)
       ↓
[ Text Chunking ]   → RecursiveCharacterTextSplitter (1000 chars, 200 overlap)
       ↓
[ Embedding ]       → SentenceTransformers (all-MiniLM-L6-v2) generates 384-dim vectors
       ↓
[ Vector DB ]       → FAISS (Facebook AI Similarity Search) indexes vectors with L2 distance
       ↓
[ User Query ]      → Embedded query searches FAISS for Top-K chunks
       ↓
[ Generation ]      → Groq API (Llama 3) receives Augmented Prompt & generates answer
```

### Key Technical Decisions:
- **Local Embeddings**: `all-MiniLM-L6-v2` runs locally to eliminate embedding API costs and ensure data privacy during indexing.
- **FAISS vs DB**: Using FAISS over a database for ultra-fast, in-memory L2 distance calculations. Indexes are persisted to disk (`/faiss_store`).
- **Live Terminal Sync**: A custom `sys.stdout` interceptor in FastAPI parses `tqdm` progress bars and streams live chunking/embedding status to the React frontend.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, TailwindCSS (Pure CSS Glassmorphism), Lucide Icons
- **Backend**: FastAPI, Uvicorn, Python `asyncio`
- **AI/ML**: LangChain, FAISS, SentenceTransformers, Groq (Llama 3)

## 📡 API Endpoints (FastAPI)

The backend provides a RESTful interface documented automatically via Swagger UI (`/api/docs`):

- `POST /api/upload` - Processes file, chunks text, generates embeddings, and updates FAISS index.
- `POST /api/chat` - Accepts `query` and `top_k`. Returns `{ answer, sources: [{ snippet, file, confidence }] }`.
- `GET /api/documents` - Lists all currently indexed documents.
- `GET /api/logs` - Streams real-time Python `stdout` logs for the frontend Activity Terminal.

## 🚀 Dev Setup (Local Environment)

*Note: This architecture uses local file storage and local memory-heavy embedding models. It is highly optimized for local execution.*

### 1. Backend Setup
```bash
# Install dependencies (uv package manager recommended)
uv sync   # or: pip install -r requirements.txt

# Configure environment variables
echo "GROQ_API_KEY=your_key_here" > .env

# Start the FastAPI server (Hot-reload enabled)
python -m uvicorn backend.main:app --reload
```
*Backend runs on `http://localhost:8000`. Swagger docs at `http://localhost:8000/api/docs`*

### 2. Frontend Setup
```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite dev server
npm run dev
```
*Frontend runs on `http://localhost:3000`*

## 📂 Repository Structure

- `frontend/` - React UI, custom glassmorphism CSS (`index.css`), Axios API hooks.
- `backend/`
  - `main.py` - FastAPI application factory and CORS configuration.
  - `logger.py` - Thread-safe `stdout` capture for streaming terminal progress.
  - `routers/` - API route definitions.
  - `src/` - Core RAG Logic
    - `data_loader.py` - Multi-format parsers.
    - `embedding.py` - Chunking and local transformer integration.
    - `vectorstore.py` - FAISS index management and persistence.
    - `search.py` - Retrieval logic and Groq LLM prompting.
  - `data/` & `faiss_store/` - Local persistence outputs.
