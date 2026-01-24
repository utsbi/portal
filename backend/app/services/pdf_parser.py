from typing import List, Dict, Any
from pypdf import PdfReader
import io


class PDFParser:
    """Service for extracting text and metadata from PDF files."""
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def extract_text_with_metadata(self, file_bytes: bytes, filename: str
    ) -> List[Dict[str, Any]]:
        """Extract text from a PDF file with page-level metadata."""
        pages_data = []
        
        try:
            pdf_reader = PdfReader(io.BytesIO(file_bytes))
            total_pages = len(pdf_reader.pages)
            
            for page_num, page in enumerate(pdf_reader.pages, start=1):
                text = page.extract_text()
                
                if text and text.strip():
                    pages_data.append({
                        "content": self._clean_text(text),
                        "metadata": {
                            "filename": filename,
                            "page_number": page_num,
                            "total_pages": total_pages,
                            "file_type": "pdf"
                        }
                    })
            
        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {str(e)}")
        
        return pages_data
    
    def chunk_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks for embedding."""
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        
        chunks = splitter.split_text(text)
        return [chunk.strip() for chunk in chunks if chunk.strip()]
    
    def chunk_pages(self, pages_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Chunk extracted page data into smaller pieces for embedding."""
        chunked_data = []
        
        for page_data in pages_data:
            text = page_data["content"]
            base_metadata = page_data["metadata"]
            
            chunks = self.chunk_text(text)
            
            for chunk_idx, chunk in enumerate(chunks):
                chunked_data.append({
                    "content": chunk,
                    "metadata": {
                        **base_metadata,
                        "chunk_index": chunk_idx,
                        "total_chunks_in_page": len(chunks)
                    }
                })
        
        return chunked_data
    
    def _clean_text(self, text: str) -> str:
        """Clean extracted text by normalizing whitespace."""
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            cleaned_line = ' '.join(line.split())
            if cleaned_line:
                cleaned_lines.append(cleaned_line)
        
        return '\n'.join(cleaned_lines)