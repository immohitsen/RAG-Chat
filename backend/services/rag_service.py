"""
RAG Service - Wrapper around src/ pipeline
This service DOES NOT modify src/ code, only uses it
"""
import os
import sys
from pathlib import Path

# Import from src/
from src.search import RAGSearch
from src.vectorstore import FaissVectorStore
from src.data_loader import load_all_documents, load_single_document

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

        print("[RAG Service] Initializing RAG pipeline...")
        self.rag_search = RAGSearch()
        self._initialized = True
        print("[RAG Service] RAG pipeline ready!")

    def query(self, query_text: str, top_k: int = 3, selected_files: list = None):
        """
        Query the RAG system with optional file filtering
        Returns: (answer, sources_list)
        """
        # Get detailed results for sources (fetch more if filtering)
        fetch_k = top_k * 3 if selected_files else top_k
        results = self.rag_search.vectorstore.query(query_text, top_k=fetch_k)

        # Filter by selected files if provided
        if selected_files:
            filtered_results = []
            for r in results:
                source = r.get("metadata", {}).get("source", "")
                # Check if any selected file is in the source path
                if any(file in source for file in selected_files):
                    filtered_results.append(r)
            results = filtered_results[:top_k]  # Take only top_k after filtering

        # Build context from filtered results
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

            # Better confidence calculation for L2 distance
            # L2 distance: 0 = perfect match, higher = worse match
            # Convert to percentage: use exponential decay
            distance = r["distance"]
            if distance == 0:
                confidence = 1.0  # Perfect match
            else:
                # Use exponential decay: e^(-distance/scale)
                # Scale = 10 gives reasonable range
                import math
                confidence = math.exp(-distance / 10.0)

            sources.append({
                "file": metadata.get("source", "Unknown"),
                "page": metadata.get("page"),
                "snippet": metadata.get("text", "")[:200],
                "confidence": round(confidence, 2)
            })

        return answer, sources

    def add_document(self, file_path: str):
        """
        Add a new document to the vector store
        Returns: number of chunks added
        """
        # Load the specific document only
        print(f"[RAG Service] Loading single document: {file_path}")
        docs = load_single_document(file_path)

        if not docs:
            raise ValueError(f"Could not load document: {file_path}")

        # Add to existing vector store
        from src.embedding import EmbeddingPipeline
        emb_pipe = EmbeddingPipeline()
        chunks = emb_pipe.chunk_documents(docs)
        embeddings = emb_pipe.embed_chunks(chunks)

        import numpy as np
        metadatas = [{"text": chunk.page_content, "source": str(file_path)} for chunk in chunks]

        self.rag_search.vectorstore.add_embeddings(
            np.array(embeddings).astype('float32'),
            metadatas
        )
        self.rag_search.vectorstore.save()

        print(f"[RAG Service] Added {len(chunks)} chunks from {Path(file_path).name}")
        return len(chunks)

    def get_stats(self):
        """Get vector store statistics"""
        if self.rag_search.vectorstore.index is None:
            return {"loaded": False, "total_vectors": 0}

        return {
            "loaded": True,
            "total_vectors": self.rag_search.vectorstore.index.ntotal
        }

    def get_indexed_files(self):
        """Get list of all indexed files with metadata"""
        if not self.rag_search.vectorstore.metadata:
            return []

        # Extract unique files from metadata
        files = {}
        for meta in self.rag_search.vectorstore.metadata:
            source = meta.get("source", "Unknown")

            # Better naming for unknown sources
            if source == "Unknown":
                display_name = "Legacy Documents (re-upload recommended)"
            else:
                display_name = Path(source).name

            if source not in files:
                files[source] = {
                    "filename": display_name,
                    "full_path": source,
                    "chunk_count": 0
                }
            files[source]["chunk_count"] += 1

        return list(files.values())

    def delete_file(self, filename: str):
        """
        Delete a file from vector store and rebuild index
        Returns: number of chunks removed
        """
        import numpy as np

        # Handle legacy documents (chunks with no source info)
        is_legacy = filename == "Legacy Documents (re-upload recommended)"

        # Find indices to keep
        indices_to_keep = []
        new_metadata = []
        chunks_removed = 0

        for idx, meta in enumerate(self.rag_search.vectorstore.metadata):
            source = meta.get("source", "")

            if is_legacy:
                should_remove = (source == "Unknown" or source == "")
            else:
                should_remove = (filename in source)

            if should_remove:
                chunks_removed += 1
            else:
                indices_to_keep.append(idx)
                new_metadata.append(meta)

        if chunks_removed == 0:
            raise ValueError(f"File '{filename}' not found in index")

        # Rebuild FAISS index with remaining vectors
        if len(indices_to_keep) == 0:
            # All vectors deleted - create empty index
            self.rag_search.vectorstore.index = None
            self.rag_search.vectorstore.metadata = []
        else:
            # Get existing vectors
            total_vectors = self.rag_search.vectorstore.index.ntotal
            dim = self.rag_search.vectorstore.index.d

            # Reconstruct all vectors
            all_vectors = np.zeros((total_vectors, dim), dtype='float32')
            for i in range(total_vectors):
                all_vectors[i] = self.rag_search.vectorstore.index.reconstruct(i)

            # Keep only selected vectors
            kept_vectors = all_vectors[indices_to_keep]

            # Create new index
            import faiss
            new_index = faiss.IndexFlatL2(dim)
            new_index.add(kept_vectors)

            # Update vectorstore
            self.rag_search.vectorstore.index = new_index
            self.rag_search.vectorstore.metadata = new_metadata

        # Save updated index
        self.rag_search.vectorstore.save()

        # Delete physical file if it exists
        file_path = Path(f"data/uploaded/{filename}")
        if file_path.exists():
            file_path.unlink()
            print(f"[RAG Service] Deleted file: {file_path}")

        print(f"[RAG Service] Removed {chunks_removed} chunks from index")
        return chunks_removed

# Singleton instance
rag_service = RAGServiceWrapper()
