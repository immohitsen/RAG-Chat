from pathlib import Path
from typing import List, Any
from langchain_community.document_loaders import PyPDFLoader, TextLoader, CSVLoader
from langchain_community.document_loaders import Docx2txtLoader
from langchain_community.document_loaders.excel import UnstructuredExcelLoader
from langchain_community.document_loaders import JSONLoader

def load_single_document(file_path: str) -> List[Any]:
    """
    Load a single file and convert to LangChain document structure.
    Supported: PDF, TXT, CSV, Excel, Word, JSON
    """
    path = Path(file_path).resolve()
    ext = path.suffix.lower()

    try:
        if ext == '.pdf':
            loader = PyPDFLoader(str(path))
        elif ext == '.txt':
            # Try UTF-8 first, fallback to latin-1 if it fails (common for windows-encoded txt)
            try:
                loader = TextLoader(str(path), encoding='utf-8')
                return loader.load()
            except UnicodeDecodeError:
                print(f"[DEBUG] UTF-8 failed for {path}, retrying with latin-1")
                loader = TextLoader(str(path), encoding='latin-1')
        elif ext == '.csv':
            loader = CSVLoader(str(path))
        elif ext in ['.xlsx', '.xls']:
            loader = UnstructuredExcelLoader(str(path))
        elif ext == '.docx':
            loader = Docx2txtLoader(str(path))
        elif ext == '.json':
            loader = JSONLoader(str(path))
        else:
            print(f"[WARNING] Unsupported file type: {ext}")
            return []

        return loader.load()
    except Exception as e:
        print(f"[ERROR] Failed to load {path}: {e}")
        return []

def load_all_documents(data_dir: str) -> List[Any]:
    """
    Load all supported files from the data directory.
    """
    data_path = Path(data_dir).resolve()
    print(f"[DEBUG] Scanning directory: {data_path}")
    documents = []

    # Supported extensions
    extensions = ['.pdf', '.txt', '.csv', '.xlsx', '.xls', '.docx', '.json']
    
    for ext in extensions:
        files = list(data_path.glob(f'**/*{ext}'))
        for f in files:
            docs = load_single_document(str(f))
            if docs:
                documents.extend(docs)

    print(f"[DEBUG] Total loaded documents: {len(documents)}")
    return documents

# Example usage
if __name__ == "__main__":
    docs = load_all_documents("data")
    print(f"Loaded {len(docs)} documents.")
    print("Example document:", docs[0] if docs else None)