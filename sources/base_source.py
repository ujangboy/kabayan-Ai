from abc import ABC, abstractmethod
from typing import List, Optional
from pydantic import BaseModel

class Document(BaseModel):
    content: str
    metadata: dict = {}
    timestamp_start: Optional[int] = None # in seconds
    timestamp_end: Optional[int] = None # in seconds

class BaseSource(ABC):
    @abstractmethod
    def extract(self) -> List[Document]:
        """
        Extract content from the source and return a list of Document objects.
        Each Document represents a chunk of the source.
        """
        pass
