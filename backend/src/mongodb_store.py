import os
from typing import List, Any, Dict
import numpy as np
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
from src.embedding import EmbeddingPipeline
from src.data_loader import load_single_document

class MongoDBVectorStore:
    def __init__(
        self, 
        mongodb_uri: str = None,
        db_name: str = "rag_database",
        collection_name: str = "vectors",
        index_name: str = "vector_index",
        embedding_model: str = "all-MiniLM-L6-v2"
    ):
        self.mongodb_uri = mongodb_uri or os.getenv("MONGODB_URI")
        if not self.mongodb_uri:
            raise ValueError("MONGODB_URI not found in environment variables")
            
        self.client = MongoClient(self.mongodb_uri)
        self.db = self.client[db_name]
        self.collection = self.db[collection_name]
        self.index_name = index_name
        
        self.model_name = embedding_model
        self.model = SentenceTransformer(embedding_model)
        self.emb_pipe = EmbeddingPipeline(model_name=embedding_model)
        
        print(f"[MongoDB Store] Initialized with collection: {collection_name}")

    def add_documents(self, documents: List[Any]):
        """Chunk, embed and store documents in MongoDB"""
        chunks = self.emb_pipe.chunk_documents(documents)
        embeddings = self.emb_pipe.embed_chunks(chunks)
        
        records = []
        for i, chunk in enumerate(chunks):
            record = {
                "text": chunk.page_content,
                "metadata": chunk.metadata,
                "embedding": embeddings[i].tolist(),
                "source": chunk.metadata.get("source", "Unknown")
            }
            records.append(record)
            
        if records:
            self.collection.insert_many(records)
            print(f"[MongoDB Store] Inserted {len(records)} chunks into Atlas.")
        return len(chunks)

    def search(self, query_text: str, top_k: int = 5) -> List[Dict]:
        """Perform vector search using Atlas Vector Search aggregation"""
        query_embedding = self.model.encode(query_text).tolist()
        
        pipeline = [
            {
                "$vectorSearch": {
                    "index": self.index_name,
                    "path": "embedding",
                    "queryVector": query_embedding,
                    "numCandidates": top_k * 10,
                    "limit": top_k
                }
            },
            {
                "$project": {
                    "text": 1,
                    "metadata": 1,
                    "source": 1,
                    "score": {"$meta": "vectorSearchScore"}
                }
            }
        ]
        
        results = list(self.collection.aggregate(pipeline))
        
        # Format results to match the previous Faiss store return type
        formatted_results = []
        for res in results:
            formatted_results.append({
                "distance": 1.0 - res.get("score", 0), # Convert score to a pseudo-distance for compatibility
                "metadata": {
                    "text": res.get("text", ""),
                    "source": res.get("source", "Unknown"),
                    **res.get("metadata", {})
                }
            })
            
        return formatted_results

    def delete_by_filename(self, filename: str):
        """Delete all chunks belonging to a specific filename"""
        # We search in the 'source' field (which usually contains the full path or filename)
        result = self.collection.delete_many({"source": {"$regex": filename}})
        print(f"[MongoDB Store] Deleted {result.deleted_count} chunks for {filename}.")
        return result.deleted_count

    def get_stats(self):
        """Get collection stats"""
        total = self.collection.count_documents({})
        return {"total_vectors": total, "loaded": True}

    def get_unique_files(self):
        """Get list of unique files with chunk counts"""
        pipeline = [
            {"$group": {"_id": "$source", "chunk_count": {"$sum": 1}}}
        ]
        results = list(self.collection.aggregate(pipeline))
        
        files = []
        for res in results:
            source = res["_id"] or "Unknown"
            files.append({
                "filename": os.path.basename(source) if source != "Unknown" else "Legacy Documents",
                "full_path": source,
                "chunk_count": res["chunk_count"]
            })
        return files
