from pathlib import Path
import fitz  # PyMuPDF
from langfuse import observe 

@observe(as_type="span") 
def extract_text_from_pdf(file_path: str) -> list[dict]:
    """Extract text page by page from a PDF. Returns list of {page_number, text}."""
    doc = fitz.open(file_path)
    pages = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        if text.strip():
            pages.append({"page_number": page_num + 1, "text": text})
    doc.close()
    return pages
