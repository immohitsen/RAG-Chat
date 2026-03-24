# RAG Pipeline - Learning Project

A hands-on project to learn **RAG (Retrieval Augmented Generation)** pipeline with vector database storage.

## What is RAG?

RAG enhances AI responses by:
1. **Retrieving** relevant information from a knowledge base
2. **Augmenting** the prompt with retrieved context
3. **Generating** accurate, context-aware responses

## What I Built

A complete data ingestion pipeline:
- Load documents (PDF, TXT, CSV)
- Split into chunks
- Generate embeddings
- Store in vector database

## Tech Stack

- **LangChain** - Document loading & text splitting
- **Sentence Transformers** - Text embeddings (`all-MiniLM-L6-v2`)
- **ChromaDB** - Vector database
- **PyPDF/PyMuPDF** - PDF processing

## Project Structure

```
RAG/
├── data/
│   ├── pdf/              # Source PDFs
│   ├── text_files/       # Text documents
│   └── chromadb_data/    # Vector database
├── notebook/
│   ├── document.ipynb    # Document loading basics
│   └── pdf_loader.ipynb  # Complete RAG pipeline
└── requirements.txt
```

## What I Learned

### 1. Document Loading ([document.ipynb](notebook/document.ipynb))
- LangChain `Document` structure (page_content + metadata)
- `TextLoader`, `PyPDFLoader`, `CSVLoader`
- `DirectoryLoader` for batch processing

### 2. RAG Pipeline ([pdf_loader.ipynb](notebook/pdf_loader.ipynb))
- **Load**: Process all PDFs from directory
- **Split**: `RecursiveCharacterTextSplitter` (chunk_size=1000, overlap=200)
- **Embed**: Generate 384-dim vectors with Sentence Transformers
- **Store**: Persist in ChromaDB

Example: Processed a blood report PDF → 2 pages → 6 chunks → stored in vector DB

## Key Code Patterns

### Text Splitting
```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)
chunks = splitter.split_documents(documents)
```

### Embeddings
```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")
embeddings = model.encode(texts)  # 384-dim vectors
```

### Vector DB
```python
import chromadb

client = chromadb.PersistentClient(path="./chromadb_data")
collection = client.get_or_create_collection(name="documents")
collection.add(embeddings=embeddings, documents=texts, metadatas=metadata)
```

## Installation

```bash
pip install -r requirements.txt
# or
uv sync
```

## Next Steps

- [ ] Implement semantic search
- [ ] Add query retrieval
- [ ] Integrate with LLM
- [ ] Build simple chat interface

## Key Concepts

**Why Chunking?** LLMs have context limits; smaller chunks enable precise retrieval

**Why Embeddings?** Enable semantic search (meaning-based, not just keyword matching)

**Why Vector DB?** Fast similarity search at scale with persistent storage

---

**Status**: Data ingestion pipeline ✓ | **Next**: Retrieval & Generation
