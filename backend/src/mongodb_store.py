import os
import re
from typing import List, Any, Dict, Optional
from concurrent.futures import ThreadPoolExecutor
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
from src.embedding import EmbeddingPipeline

# Regex patterns for structured entities that vector/BM25 both fail on
_ENTITY_PATTERNS = [
    re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'),   # email
    re.compile(r'[\+]?[\d][\d\s\-\(\)]{8,15}'),                         # phone
    re.compile(r'\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b'),          # date
    re.compile(r'\b[A-Z]{2,}-[\w\-]{3,}\b'),                            # ID/code e.g. INV-2024-001
    re.compile(r'https?://\S+'),                                          # URL
]

# When query mentions entity TYPE (e.g. "email of candidate"), search docs for that pattern
_ENTITY_TYPE_KEYWORDS = {
    'email':  (r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',  ['email', 'e-mail', 'mail']),
    'phone':  (r'[\+]?[\d][\d\s\-\(\)]{8,15}',                       ['phone', 'mobile', 'contact number', 'cell', 'number']),
    'date':   (r'\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b',        ['date', 'dob', 'born', 'joining date']),
    'url':    (r'https?://\S+',                                        ['url', 'link', 'website', 'site']),
}

def _extract_entity(query: str) -> Optional[str]:
    """Return the first structured entity VALUE found in the query, or None."""
    for pattern in _ENTITY_PATTERNS:
        match = pattern.search(query)
        if match:
            return match.group(0)
    return None

def _detect_entity_type_pattern(query: str) -> Optional[str]:
    """
    If query mentions an entity TYPE keyword (e.g. 'email', 'phone'),
    return the regex pattern to search for that entity in documents.
    """
    q = query.lower()
    for _, (pattern, keywords) in _ENTITY_TYPE_KEYWORDS.items():
        if any(kw in q for kw in keywords):
            return pattern
    return None

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

    def add_documents(self, documents: List[Any], user_id: str = None):
        """Chunk, embed and store documents in MongoDB"""
        chunks = self.emb_pipe.chunk_documents(documents)
        embeddings = self.emb_pipe.embed_chunks(chunks)

        records = []
        for i, chunk in enumerate(chunks):
            record = {
                "text": chunk.page_content,
                "metadata": chunk.metadata,
                "embedding": embeddings[i].tolist(),
                "source": chunk.metadata.get("source", "Unknown"),
                "user_id": user_id
            }
            records.append(record)

        if records:
            self.collection.insert_many(records)
            print(f"[MongoDB Store] Inserted {len(records)} chunks into Atlas.")
        return len(chunks)

    def search(self, query_text: str, top_k: int = 5, user_id: str = None, selected_files: list = None) -> List[Dict]:
        """Perform vector search using Atlas Vector Search aggregation"""
        import re
        query_embedding = self.model.encode(query_text).tolist()

        post_match = {}
        if user_id:
            post_match["user_id"] = user_id
        if selected_files:
            post_match["source"] = {"$in": [re.compile(re.escape(f) + "$") for f in selected_files]}

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
            *(
                [{"$match": post_match}] if post_match else []
            ),
            {
                "$project": {
                    "_id": 1,
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
                "id": str(res["_id"]),
                "distance": 1.0 - res.get("score", 0), # Convert score to a pseudo-distance for compatibility
                "metadata": {
                    "text": res.get("text", ""),
                    "source": res.get("source", "Unknown"),
                    **res.get("metadata", {})
                }
            })
            
        return formatted_results

    def keyword_search(self, query_text: str, top_k: int = 5, user_id: str = None, selected_files: list = None) -> List[Dict]:
        """BM25-style keyword search using MongoDB text index"""
        import re
        match_filter = {"$text": {"$search": query_text}}
        if user_id:
            match_filter["user_id"] = user_id
        if selected_files:
            match_filter["source"] = {"$in": [re.compile(re.escape(f) + "$") for f in selected_files]}

        pipeline = [
            {"$match": match_filter},
            {"$addFields": {"text_score": {"$meta": "textScore"}}},
            {"$sort": {"text_score": -1}},
            {"$limit": top_k},
            {"$project": {"text": 1, "metadata": 1, "source": 1, "text_score": 1}}
        ]

        results = list(self.collection.aggregate(pipeline))

        formatted = []
        for res in results:
            formatted.append({
                "id": str(res["_id"]),
                "distance": 1.0 - min(res.get("text_score", 0) / 10.0, 1.0),  # normalize to 0-1
                "metadata": {
                    "text": res.get("text", ""),
                    "source": res.get("source", "Unknown"),
                    **res.get("metadata", {})
                }
            })
        
        return formatted
    
    def exact_search(self, pattern: str, top_k: int = 5, user_id: str = None, selected_files: list = None) -> List[Dict]:
        """
        Regex search on the text field.
        - Called with a literal entity value (e.g. 'mohit@gmail.com') → re.escape'd
        - Called with a type pattern (e.g. email regex) → used as-is
        """
        match_filter = {"text": {"$regex": pattern, "$options": "i"}}
        if user_id:
            match_filter["user_id"] = user_id
        if selected_files:
            match_filter["source"] = {"$in": [re.compile(re.escape(f) + "$") for f in selected_files]}

        results = list(self.collection.find(match_filter, {
            "_id": 1, "text": 1, "metadata": 1, "source": 1
        }).limit(top_k))

        return [{
            "id": str(res["_id"]),
            "distance": 0.0,  # exact match — treat as perfect score
            "metadata": {
                "text": res.get("text", ""),
                "source": res.get("source", "Unknown"),
                **res.get("metadata", {})
            }
        } for res in results]

    def hybrid_search(self, query_text: str, top_k: int = 5, user_id: str = None, selected_files: list = None) -> List[Dict]:
        """Hybrid search: vector + keyword, merged with Reciprocal Rank Fusion"""
        K = 60  # RRF constant — higher = less weight on top ranks

        # Check for actual entity value first, then fall back to entity type keyword
        entity = _extract_entity(query_text)
        if entity:
            exact_pattern = re.escape(entity)          # search for literal value
        else:
            exact_pattern = _detect_entity_type_pattern(query_text)  # search for any entity of that type

        # Run searches in parallel — exact_search only when an entity/type is detected
        with ThreadPoolExecutor(max_workers=3) as executor:
            vec_future = executor.submit(self.search, query_text, top_k, user_id, selected_files)
            kw_future = executor.submit(self.keyword_search, query_text, top_k, user_id, selected_files)
            ex_future = executor.submit(self.exact_search, exact_pattern, top_k, user_id, selected_files) if exact_pattern else None
            vector_results = vec_future.result()
            keyword_results = kw_future.result()
            exact_results = ex_future.result() if ex_future else []

        # Build RRF score map: {doc_id: {score, metadata}}
        rrf_scores = {}

        for rank, result in enumerate(vector_results):
            doc_id = result.get("id", f"vec_{rank}")
            rrf_scores.setdefault(doc_id, {"score": 0.0, "result": result})
            rrf_scores[doc_id]["score"] += 1.0 / (K + rank + 1)

        for rank, result in enumerate(keyword_results):
            doc_id = result.get("id", f"kw_{rank}")
            rrf_scores.setdefault(doc_id, {"score": 0.0, "result": result})
            rrf_scores[doc_id]["score"] += 1.0 / (K + rank + 1)

        # Exact matches get a fixed boost — they rank above everything else
        for rank, result in enumerate(exact_results):
            doc_id = result.get("id", f"ex_{rank}")
            rrf_scores.setdefault(doc_id, {"score": 0.0, "result": result})
            rrf_scores[doc_id]["score"] += 1.0 / (K + rank + 1) + 0.5  # +0.5 boost

        # Sort by RRF score descending
        sorted_results = sorted(rrf_scores.values(), key=lambda x: x["score"], reverse=True)

        # Convert RRF score back to distance format (1 - score, normalized)
        final = []
        for item in sorted_results[:top_k]:
            r = item["result"].copy()
            r["distance"] = max(0.0, 1.0 - (item["score"] * K))  # rough normalization
            final.append(r)

        return final

    def get_all_chunks(self, user_id: str = None, selected_files: list = None) -> List[Dict]:
        """
        Fetch ALL chunks for a user's documents directly from MongoDB.
        Used for listing/enumeration queries where vector similarity is unreliable
        because technical content scores low against generic queries like 'list all projects'.
        """
        import re
        match = {}
        if user_id:
            match["user_id"] = user_id
        if selected_files:
            match["source"] = {"$in": [re.compile(re.escape(f) + "$") for f in selected_files]}

        raw = list(self.collection.find(match, {"_id": 1, "text": 1, "metadata": 1, "source": 1}))
        print(f"[MongoDB Store] Full fetch: {len(raw)} chunks for listing query.")

        return [{
            "id": str(r["_id"]),
            "distance": 0.0,   # treat all as perfect match — LLM does the filtering
            "metadata": {
                "text": r.get("text", ""),
                "source": r.get("source", "Unknown"),
                **r.get("metadata", {})
            }
        } for r in raw]



    def delete_by_filename(self, filename: str, user_id: str = None):
        """Delete all chunks belonging to a specific filename"""
        import re
        query = {
            "$or": [
                {"source": filename},
                {"source": {"$regex": re.escape(filename)}},
            ]
        }
        if user_id:
            query["user_id"] = user_id
        result = self.collection.delete_many(query)
        print(f"[MongoDB Store] Deleted {result.deleted_count} chunks for {filename}.")
        return result.deleted_count

    def get_stats(self):
        """Get collection stats"""
        total = self.collection.count_documents({})
        return {"total_vectors": total, "loaded": True}

    def get_unique_files(self, user_id: str = None):
        """Get list of unique files with chunk counts"""
        match_stage = {}
        if user_id:
            match_stage["user_id"] = user_id

        pipeline = []
        if match_stage:
            pipeline.append({"$match": match_stage})
        pipeline.append({"$group": {"_id": "$source", "chunk_count": {"$sum": 1}}})

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
