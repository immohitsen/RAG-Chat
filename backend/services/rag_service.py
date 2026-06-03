"""
RAG Service - Wrapper around MongoDB Vector Store pipeline
"""
import sys
from pathlib import Path

from langchain_core.messages import SystemMessage, HumanMessage
from sentence_transformers import CrossEncoder

# Import from src/
from src.search import RAGSearch
from src.data_loader import load_single_document
from src.intent_classifier import IntentClassifier

SIMILARITY_THRESHOLD = 0.60

CHITCHAT_SYSTEM = "You are a friendly conversational assistant. Respond naturally and casually."
GENERAL_SYSTEM = """You are a document-based QA assistant. You can ONLY answer questions based on the documents uploaded by the user.

For this query, no relevant information was found in the uploaded documents.
Respond by:
1. Telling the user that no relevant information was found in their uploaded documents
2. Telling them what you CAN do: answer questions based on their uploaded documents
Do NOT answer from general knowledge. Do NOT pretend to be a general-purpose assistant."""

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
        self.classifier = IntentClassifier(self.rag_search.llm)

        print("[RAG Service] Loading cross-encoder reranker...")
        self.reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

        self._initialized = True
        print("[RAG Service] MongoDB RAG pipeline ready!")

    def classify_intent(self, query: str) -> str:
        return self.classifier.classify(query)

    def respond_direct(self, query: str, mode: str, chat_history: list = None) -> tuple:
        system = CHITCHAT_SYSTEM if mode == "chitchat" else GENERAL_SYSTEM
        history_msgs = self.build_history_messages(chat_history or [])
        response = self.rag_search.llm.invoke([
            SystemMessage(content=system),
            *history_msgs,
            HumanMessage(content=query)
        ])
        return response.content, []

    def summarize_old_messages(self, messages: list) -> str:
        """Compress older messages into a short summary using LLM"""
        history_text = "\n".join(
            f"{m['role'].capitalize()}: {m['content']}" for m in messages
        )
        prompt = f"""Summarize this conversation briefly in 2-3 sentences, keeping key topics and facts:

{history_text}

Summary:"""
        response = self.rag_search.llm.invoke([HumanMessage(content=prompt)])
        return response.content.strip()

    def build_history_messages(self, chat_history: list) -> list:
        """
        Summary Buffer: last 4 messages full, older ones summarized.
        Returns list of LangChain messages.
        """
        if not chat_history:
            return []

        RECENT_COUNT = 4
        history_msgs = []

        if len(chat_history) > RECENT_COUNT:
            older = chat_history[:-RECENT_COUNT]
            summary = self.summarize_old_messages(older)
            history_msgs.append(SystemMessage(content=f"Earlier conversation summary: {summary}"))

        for m in chat_history[-RECENT_COUNT:]:
            if m["role"] == "user":
                history_msgs.append(HumanMessage(content=m["content"]))
            else:
                history_msgs.append(SystemMessage(content=f"Assistant: {m['content']}"))

        return history_msgs

    def query(self, query_text: str, top_k: int = 3, selected_files: list = None, chat_history: list = None, user_id: str = None):
        """
        Query the RAG system with optional file filtering and chat history.
        Returns: (answer, sources_list)
        """
        # selected_files=None means no filter, selected_files=[] means nothing selected → no results
        if selected_files is not None and len(selected_files) == 0:
            return self.respond_direct(query_text, "general", chat_history)

        # Detect listing/enumeration queries — these need broader coverage
        # e.g. "list all projects", "what are all the skills", "every experience"
        LISTING_KEYWORDS = {"all", "list", "every", "enumerate", "complete", "full", "entire", "summarize", "summary"}
        query_words = set(query_text.lower().split())
        is_listing_query = bool(query_words & LISTING_KEYWORDS)

        # Listing queries: fetch ALL chunks directly from MongoDB — skip vector search entirely.
        # Vector search finds "similar" chunks, not "all" chunks about a topic.
        # A chunk about "QAOA entropy engine" scores near 0 against "list all projects",
        # so it would never surface via similarity. Full fetch + LLM extraction is the right approach.
        if is_listing_query:
            results = self.rag_search.vectorstore.get_all_chunks(
                user_id=user_id, selected_files=selected_files
            )
        else:
            # Precision queries: use hybrid search + reranking as normal
            candidate_k = top_k * 3
            results = self.rag_search.vectorstore.hybrid_search(
                query_text, top_k=candidate_k, user_id=user_id, selected_files=selected_files
            )
            results = [r for r in results if (1.0 - r.get("distance", 1.0)) >= SIMILARITY_THRESHOLD]

            if not results:
                return self.respond_direct(query_text, "general", chat_history)

            # Re-rank and trim to top_k
            if len(results) > 1:
                candidate_texts = [r["metadata"].get("text", "") for r in results if r.get("metadata")]
                pairs = [(query_text, t) for t in candidate_texts]
                rerank_scores = self.reranker.predict(pairs)
                scored = sorted(zip(rerank_scores, results), key=lambda x: x[0], reverse=True)
                results = [r for _, r in scored[:top_k]]


        # Build context — group by source file so LLM sees each document's content together
        from collections import defaultdict
        chunks_by_file = defaultdict(list)
        for r in results:
            metadata = r.get("metadata", {})
            text = metadata.get("text", "")
            source = metadata.get("source", "Unknown")
            filename = Path(source).name if source != "Unknown" else "Unknown"
            chunks_by_file[filename].append(text)

        unique_sources = list(chunks_by_file.keys())
        context_parts = []
        for filename, chunks in chunks_by_file.items():
            combined = "\n\n".join(chunks)
            context_parts.append(f"[Source: {filename}]\n{combined}")
        context = "\n\n---\n\n".join(context_parts)

        if not context:
            return self.respond_direct(query_text, "general", chat_history)

        # Build system prompt — tell LLM how many source files are present
        multi_doc_note = (
            f"There are {len(unique_sources)} source documents: {', '.join(unique_sources)}. "
            "Present your answer SEPARATELY for each document, clearly labeled with the filename. "
            "NEVER merge or mix information across documents. "
        ) if len(unique_sources) > 1 else ""

        # Build messages with history + current query
        history_msgs = self.build_history_messages(chat_history or [])
        system = SystemMessage(content=(
            "You are a document-based QA assistant. Answer the user's question using ONLY the provided document context. "
            "Each chunk of context is labeled with [Source: filename] indicating which document it came from. "
            f"{multi_doc_note}"
            "When answering questions about a specific person or document, ONLY use chunks from that person's file. "
            "NEVER mix information across different source files. "
            "Use the conversation history to understand follow-up questions and references to previous answers. "
            "ALWAYS format your response using markdown: "
            "use bullet points (- item) for lists of achievements, projects, skills, or experiences; "
            "use **bold** for section headers or candidate names; "
            "use tables when comparing multiple candidates side by side; "
            "NEVER write lists as a single run-on paragraph or comma-separated sentence."
        ))
        user_msg = HumanMessage(content=f"Document context:\n{context}\n\nQuestion: {query_text}")

        response = self.rag_search.llm.invoke([system] + history_msgs + [user_msg])
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

    def add_document(self, file_path: str, user_id: str = None):
        """Add document to MongoDB Vector Store"""
        print(f"[RAG Service] Loading document to MongoDB: {file_path}")
        docs = load_single_document(file_path)
        if not docs:
            raise ValueError(f"Could not load document: {file_path}")

        count = self.rag_search.vectorstore.add_documents(docs, user_id=user_id)
        print(f"[RAG Service] Added {count} chunks from {Path(file_path).name} to MongoDB Atlas.")
        return count

    def get_stats(self):
        """Get MongoDB vector store statistics"""
        return self.rag_search.vectorstore.get_stats()

    def get_indexed_files(self, user_id: str = None):
        """Get list of files from MongoDB"""
        files = self.rag_search.vectorstore.get_unique_files(user_id=user_id)
        return [
            {
                "filename": f["filename"],
                "full_path": f["full_path"],
                "chunk_count": f["chunk_count"]
            } for f in files
        ]

    def delete_file(self, filename: str, user_id: str = None):
        """Delete file from MongoDB Atlas"""
        count = self.rag_search.vectorstore.delete_by_filename(filename, user_id=user_id)

        file_path = Path(f"data/uploaded/{filename}")
        if file_path.exists():
            file_path.unlink()

        return count

# Singleton instance
rag_service = RAGServiceWrapper()
