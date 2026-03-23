"""Base class for all embedding providers."""
from abc import ABC, abstractmethod
from typing import Optional, List


class BaseEmbeddingProvider(ABC):
    """Base interface for embedding providers.

    Providers generate vector embeddings from text. Used by memory,
    knowledge, and RAG systems for semantic search.
    """

    @abstractmethod
    def embed(self, texts: list, prefix: str = 'search_document') -> Optional[List[list]]:
        """Embed a list of texts.

        Args:
            texts: List of strings to embed.
            prefix: Task prefix (e.g., 'search_document', 'search_query').

        Returns:
            List of float lists (embeddings), or None on failure.
        """
        ...

    @property
    @abstractmethod
    def available(self) -> bool:
        """Whether this provider is ready to generate embeddings."""
        ...
