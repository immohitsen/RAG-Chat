# RAG Pipeline - Production-Ready Q&A System

A complete **RAG (Retrieval Augmented Generation)** system for intelligent question-answering over technical documents with LLM integration.

## What is RAG?

RAG enhances AI responses by:
1. **Retrieving** relevant information from a knowledge base using semantic search
2. **Augmenting** the LLM prompt with retrieved context
3. **Generating** accurate, context-aware responses grounded in your documents

## What I Built

A **full-stack RAG pipeline** with:
- Multi-format document loading (PDF, TXT, CSV, Excel, Word, JSON)
- Intelligent text chunking with overlap
- Semantic embeddings generation
- Dual vector database support (FAISS + ChromaDB)
- LLM-powered answer generation with Groq
- Advanced features: citations, confidence scores, streaming, query history

## Tech Stack

- **LangChain** - Document loading & text splitting
- **Sentence Transformers** - Semantic embeddings (`all-MiniLM-L6-v2`, 384-dim)
- **FAISS** - Fast similarity search (Facebook AI)
- **ChromaDB** - Alternative vector database with persistence
- **Groq** - LLM API (Llama 3.1 8B Instant)
- **PyPDF/PyMuPDF** - PDF processing

## Project Structure

```
RAG/
├── src/                      # Production code modules
│   ├── data_loader.py        # Multi-format document loading
│   ├── embedding.py          # Text chunking & embedding generation
│   ├── vectorstore.py        # FAISS vector database wrapper
│   └── search.py             # RAG retrieval + LLM generation
├── data/
│   ├── pdf/                  # Source PDFs (10 CS course notes)
│   ├── text_files/           # Text documents
│   └── chromadb_data/        # ChromaDB persistence
├── faiss_store/              # FAISS index + metadata
├── notebook/
│   ├── document.ipynb        # Document loading experiments
│   └── pdf_loader.ipynb      # Advanced RAG features demo
├── app.py                    # Main entry point
├── main.py                   # Basic hello world
├── .env                      # API keys (GROQ_API_KEY)
├── pyproject.toml            # uv package config
└── requirements.txt          # Dependencies
```

## Features

### Core Pipeline (Production Code - `src/`)

1. **Document Loading** ([data_loader.py](src/data_loader.py))
   - Supports: PDF, TXT, CSV, Excel (.xlsx), Word (.docx), JSON
   - Recursive directory scanning
   - Batch processing with error handling
   - Metadata preservation (source file, page numbers)

2. **Text Processing** ([embedding.py](src/embedding.py))
   - `RecursiveCharacterTextSplitter` (chunk_size=1000, overlap=200)
   - Preserves context across chunks
   - Configurable separators: `\n\n` → `\n` → space → characters

3. **Vector Database** ([vectorstore.py](src/vectorstore.py))
   - FAISS `IndexFlatL2` for fast similarity search
   - Persistent storage (index + metadata)
   - Query methods with configurable top-k retrieval

4. **RAG Search** ([search.py](src/search.py))
   - Semantic retrieval with similarity scoring
   - Groq LLM integration (Llama 3.1 8B)
   - Context-aware answer generation

### Advanced Features (Notebooks - `notebook/`)

From [pdf_loader.ipynb](notebook/pdf_loader.ipynb):
- **Citations**: Automatic source attribution with page numbers
- **Confidence Scores**: Similarity-based relevance scoring
- **Context Preview**: First 200 chars of retrieved chunks
- **Answer Summarization**: 2-sentence summaries
- **Query History**: Session tracking
- **Streaming**: Simulated token-by-token output

### Current Dataset

- **10 PDF files** (CS course notes from Unacademy)
- **Topics**: DBMS, OS, Algorithms, Computer Architecture, Networks, etc.
- **Processing Stats**:
  - 1879 total pages
  - 2987 chunks
  - 2987 × 384-dim embeddings

## Quick Start

### 1. Installation

```bash
# Using uv (recommended)
uv sync

# Or using pip
pip install -r requirements.txt
```

### 2. Setup Environment

Create a `.env` file with your Groq API key:
```bash
GROQ_API_KEY=your_api_key_here
```

Get a free API key from: https://console.groq.com/

### 3. Run the Pipeline

```python
# app.py - Main entry point
from src.data_loader import load_all_documents
from src.vectorstore import FaissVectorStore
from src.search import RAGSearch

# Option 1: Build vector store from scratch
docs = load_all_documents("data")
store = FaissVectorStore("faiss_store")
store.build_from_documents(docs)

# Option 2: Load existing vector store
store = FaissVectorStore("faiss_store")
store.load()

# Query with RAG
rag_search = RAGSearch()
answer = rag_search.search_and_summarize("What is DBMS?", top_k=3)
print(answer)
```

### 4. Explore Advanced Features

Open [pdf_loader.ipynb](notebook/pdf_loader.ipynb) to see:
- Citations and source attribution
- Confidence scoring
- Query history tracking
- Answer summarization

## Code Examples

### Basic RAG Query
```python
from src.search import RAGSearch

rag = RAGSearch()
answer = rag.search_and_summarize("What is multiprogramming?", top_k=3)
print(answer)
```

### Custom Vector Store Query
```python
from src.vectorstore import FaissVectorStore

store = FaissVectorStore("faiss_store")
store.load()

# Direct similarity search
results = store.query("explain ACID properties", top_k=5)
for r in results:
    print(f"Score: {r['distance']:.4f}")
    print(f"Text: {r['metadata']['text'][:200]}...")
```

### Load Different Document Types
```python
from src.data_loader import load_all_documents

# Automatically detects and loads: PDF, TXT, CSV, XLSX, DOCX, JSON
docs = load_all_documents("data")
print(f"Loaded {len(docs)} documents")
```

## How It Works

```
User Query: "What is DBMS?"
     ↓
1. Convert query to 384-dim embedding
     ↓
2. FAISS searches 2987 chunks for top-3 most similar
     ↓
3. Retrieved chunks with metadata:
   - "DBMS is software that manages inter-related data..."
   - Source: Unacademy-DBMS.pdf, Page 1
   - Similarity: 0.29
     ↓
4. Build prompt: Context + Query
     ↓
5. Groq LLM (Llama 3.1 8B) generates answer
     ↓
Answer: "A DBMS is software that helps maintain and utilize
         huge amounts of data..."
```

## Key Learnings

### RAG Pipeline Architecture
- **Chunking**: Breaks documents into 1000-char segments with 200-char overlap to maintain context
- **Embeddings**: Converts text to dense vectors, enabling semantic (meaning-based) search vs keyword matching
- **Vector DB**: FAISS uses L2 distance for fast similarity search across millions of vectors
- **LLM Integration**: Context-aware generation grounds answers in your documents, reducing hallucination

### Production Considerations
- **FAISS vs ChromaDB**: FAISS faster for search, ChromaDB better for metadata filtering
- **Chunk Size**: Trade-off between context (larger) and precision (smaller)
- **Top-k Selection**: More chunks = better context but slower, token limits
- **Similarity Threshold**: Filter low-quality matches (< 0.2 typically noise)

## What's Implemented

✅ **Completed Features**:
- [x] Multi-format document loading (6 formats)
- [x] Intelligent text chunking with overlap
- [x] Semantic embeddings generation
- [x] FAISS vector database with persistence
- [x] ChromaDB alternative implementation
- [x] Semantic similarity search
- [x] LLM integration (Groq API)
- [x] Context-aware answer generation
- [x] Citations and source tracking
- [x] Confidence scoring
- [x] Query history

## Architecture Diagram

```
┌─────────────────┐
│  Data Sources   │
│  (PDF/TXT/CSV)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Data Loader    │  ← LangChain loaders
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Text Splitter  │  ← RecursiveCharacterTextSplitter
│  (1000/200)     │     Chunk size / Overlap
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Embeddings     │  ← Sentence Transformers
│  (384-dim)      │     all-MiniLM-L6-v2
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vector Store   │  ← FAISS IndexFlatL2
│  (2987 vectors) │     Persistent storage
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Query     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Similarity     │  ← top-k retrieval
│  Search         │     L2 distance
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM (Groq)     │  ← Context + Query → Answer
│  Llama 3.1 8B   │
└─────────────────┘
```

## 🌐 Full-Stack Web Application (NEW!)

This project now includes a **production-ready web interface**!

### Tech Stack
- **Backend**: FastAPI + Uvicorn (REST API)
- **Frontend**: React + Vite + TailwindCSS
- **Integration**: Axios for API calls

### Quick Start

**1. Install dependencies:**
```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
cd ..
```

**2. Run both servers:**
```bash
# Terminal 1 - Backend
python -m uvicorn backend.main:app --reload

# Terminal 2 - Frontend
cd frontend && npm run dev
```

**3. Open browser:**
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/api/docs

### Features
- ✅ Beautiful chat interface
- ✅ Drag-and-drop file upload
- ✅ Real-time document indexing
- ✅ Source citations with confidence scores
- ✅ Responsive design (mobile-friendly)
- ✅ Auto-generated API documentation

**📖 See [SETUP.md](SETUP.md) for detailed setup instructions**

---

## License

MIT License - Feel free to use this for learning or production!

---

**Status**: ✅ Full RAG pipeline operational | 🌐 Web UI available | 🎯 Production-ready
