from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_pages(pages: list[dict], chunk_size: int = 1000, chunk_overlap: int = 200) -> list[dict]:
    """Split page texts into overlapping chunks. Preserves page_number metadata."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = []
    chunk_index = 0
    for page in pages:
        texts = splitter.split_text(page["text"])
        for text in texts:
            chunks.append({
                "chunk_index": chunk_index,
                "text": text,
                "page_number": page["page_number"],
            })
            chunk_index += 1
    return chunks
