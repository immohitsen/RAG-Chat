from langchain_core.messages import HumanMessage

CLASSIFIER_PROMPT = """You are an intent classifier. Classify the user query into exactly one of these:

- chitchat  → greetings, small talk, casual conversation, thanks, bye, jokes, "how are you"
- knowledge → anything that could be a question, request for information, or needs an answer

When in doubt, always choose: knowledge

Reply with ONE word only. No punctuation. No explanation.

Query: {query}"""


class IntentClassifier:
    def __init__(self, llm):
        self.llm = llm
        print("[IntentClassifier] Ready (Groq-based).")

    def classify(self, query: str) -> str:
        prompt = CLASSIFIER_PROMPT.format(query=query.strip())
        response = self.llm.invoke([HumanMessage(content=prompt)])
        label = response.content.strip().lower().rstrip(".")

        if label not in {"chitchat", "knowledge"}:
            return "knowledge"  # safe default — never skip RAG if unsure
        return label
