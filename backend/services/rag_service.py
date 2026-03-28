"""
RAG Service - Wrapper around MongoDB Vector Store pipeline
"""
import os
import sys
from pathlib import Path

# Import from src/
from src.search import RAGSearch
from src.data_loader import load_single_document

class RAGServiceWrapper:
    """Singleton wrapper around RAGSearch to maintain state"""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RAGServiceWrapper, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        print("[RAG Service] Initializing MongoDB RAG pipeline...")
        self.rag_search = RAGSearch()
        self._initialized = True
        print("[RAG Service] MongoDB RAG pipeline ready!")

    def query(self, query_text: str, top_k: int = 3, selected_files: list = None):
        """
        Query the RAG system with optional file filtering
        Returns: (answer, sources_list)
        """
        # Get detailed results from MongoDB
        results = self.rag_search.vectorstore.search(query_text, top_k=top_k * 3 if selected_files else top_k)

        # Filter by selected files if provided
        if selected_files:
            filtered_results = []
            for r in results:
                source = r.get("metadata", {}).get("source", "")
                if any(file in source for file in selected_files):
                    filtered_results.append(r)
            results = filtered_results[:top_k]

        # Build context
        texts = [r["metadata"].get("text", "") for r in results if r.get("metadata")]
        context = "\n\n".join(texts)

        if not context:
            return "No relevant documents found in selected files.", []

        # Generate answer
        prompt = f"""Summarize the following context for the query: '{query_text}'\n\nContext:\n{context}\n\nSummary:"""
        response = self.rag_search.llm.invoke([prompt])
        answer = response.content

        # Format sources
        sources = []
        for r in results:
            metadata = r.get("metadata", {})
            sources.append({
                "file": metadata.get("source", "Unknown"),
                "page": metadata.get("page"),
                "snippet": metadata.get("text", "")[:200],
                "confidence": round(1.0 - r.get("distance", 0.5), 2)
            })

        return answer, sources

    def add_document(self, file_path: str):
        """Add document to MongoDB Vector Store"""
        print(f"[RAG Service] Loading document to MongoDB: {file_path}")
        docs = load_single_document(file_path)
        if not docs:
            raise ValueError(f"Could not load document: {file_path}")

        count = self.rag_search.vectorstore.add_documents(docs)
        print(f"[RAG Service] Added {count} chunks from {Path(file_path).name} to MongoDB Atlas.")
        return count

    def get_stats(self):
        """Get MongoDB vector store statistics"""
        return self.rag_search.vectorstore.get_stats()

    def get_indexed_files(self):
        """Get list of files from MongoDB"""
        files = self.rag_search.vectorstore.get_unique_files()
        # Ensure format matches what frontend expects
        return [
            {
                "filename": f["filename"],
                "full_path": f["full_path"],
                "chunk_count": f["chunk_count"]
            } for f in files
        ]

    def delete_file(self, filename: str):
        """Delete file from MongoDB Atlas"""
        count = self.rag_search.vectorstore.delete_by_filename(filename)
        
        # Also clean up local file if it exists (for backend hygiene)
        file_path = Path(f"data/uploaded/{filename}")
        if file_path.exists():
            file_path.unlink()
            
        return count

# Singleton instance
rag_service = RAGServiceWrapper()
