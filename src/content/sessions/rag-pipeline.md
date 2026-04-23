---
title: "RAG Pipeline Deep-Dive: From Naive to Production"
description: "End-to-end Retrieval-Augmented Generation: chunking strategies, embedding models, vector stores, reranking, evaluation with RAGAS, and common failure modes."
date: "2026-04-05"
author: "Tatsat Pandey"
tags: ["RAG", "Vector Search", "Embeddings", "LLM", "RAGAS"]
bannerGradient: "linear-gradient(135deg, #f0883e, #f778ba)"
featured: true
---

## Why RAG?

Large language models know a lot, but they don't know *your* data. RAG (Retrieval-Augmented Generation) bridges this gap: instead of fine-tuning the model, you **retrieve** relevant context at query time and inject it into the prompt.

> **The core idea:** User asks a question → search your knowledge base → feed the top results into the LLM prompt → get a grounded answer with citations.

RAG is the #1 production pattern for enterprise LLM applications because it's cheaper than fine-tuning, doesn't require training infrastructure, and lets you update knowledge in real time.

## The RAG Pipeline

```
User Query
    │
    ▼
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Embedding   │ ──► │  Vector     │ ──► │  Reranker    │
│  Model       │     │  Search     │     │  (optional)  │
└──────────────┘     └─────────────┘     └──────┬───────┘
                                                │
                                                ▼
                                    ┌──────────────────┐
                                    │  LLM Generation  │
                                    │  (with context)  │
                                    └──────────────────┘
```

## Step 1: Chunking — The Foundation

How you chunk documents determines retrieval quality more than any other decision.

| Strategy | How It Works | Best For |
|----------|-------------|----------|
| **Fixed-size** | Split every N tokens with overlap | Simple documents, quick start |
| **Recursive** | Split by paragraphs → sentences → words | Structured text (docs, articles) |
| **Semantic** | Split when embedding similarity drops | Mixed-format documents |
| **Parent-child** | Small chunks for retrieval, return parent context | When you need surrounding context |

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=50,
    separators=["\n\n", "\n", ". ", " "],
)
chunks = splitter.split_documents(documents)
```

**Rule of thumb:** Start with 512-token chunks, 50-token overlap. Tune based on your evaluation metrics.

## Step 2: Embedding Models

Embeddings convert text into dense vectors that capture semantic meaning.

| Model | Dimensions | Speed | Quality | Cost |
|-------|-----------|-------|---------|------|
| `text-embedding-3-small` (OpenAI) | 1536 | Fast | Good | $0.02/1M tokens |
| `text-embedding-3-large` (OpenAI) | 3072 | Medium | Better | $0.13/1M tokens |
| `nomic-embed-text` (open-source) | 768 | Fast | Good | Free |
| `embed-v4` (Cohere) | 1024 | Fast | Great | $0.10/1M tokens |

```python
from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vector = embeddings.embed_query("What is retrieval-augmented generation?")
```

## Step 3: Vector Stores

| Store | Type | Best For |
|-------|------|----------|
| **Chroma** | In-process | Prototyping, small datasets |
| **pgvector** | PostgreSQL extension | Already using Postgres |
| **Pinecone** | Managed cloud | Production, zero-ops |
| **Qdrant** | Self-hosted or cloud | High performance, filtering |

```python
from langchain_chroma import Chroma

vectorstore = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings,
    persist_directory="./chroma_db",
)

# Retrieve top-k relevant chunks
retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
docs = retriever.invoke("How does chunking affect retrieval?")
```

## Step 4: Hybrid Search

Pure vector search misses exact keyword matches. Hybrid search combines **dense retrieval** (embeddings) with **sparse retrieval** (BM25/keyword) for better coverage.

```python
from langchain.retrievers import EnsembleRetriever
from langchain_community.retrievers import BM25Retriever

bm25 = BM25Retriever.from_documents(chunks, k=5)
dense = vectorstore.as_retriever(search_kwargs={"k": 5})

hybrid = EnsembleRetriever(
    retrievers=[bm25, dense],
    weights=[0.4, 0.6],  # Tune these weights
)
```

## Step 5: Reranking

Initial retrieval is fast but noisy. A reranker scores each result against the original query using a cross-encoder, dramatically improving precision.

```python
from langchain.retrievers import ContextualCompressionRetriever
from langchain_cohere import CohereRerank

reranker = CohereRerank(model="rerank-v3.5", top_n=3)
retriever = ContextualCompressionRetriever(
    base_compressor=reranker,
    base_retriever=hybrid,
)
```

**Impact:** Adding a reranker typically improves answer quality by 15-30% on benchmarks.

## Step 6: Evaluation with RAGAS

You can't improve what you don't measure. RAGAS provides metrics specifically designed for RAG:

- **Faithfulness** — Does the answer stick to the retrieved context? (no hallucination)
- **Answer Relevancy** — Does the answer actually address the question?
- **Context Precision** — Are the retrieved chunks actually relevant?
- **Context Recall** — Did we find all the relevant information?

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision

result = evaluate(
    dataset=eval_dataset,
    metrics=[faithfulness, answer_relevancy, context_precision],
)
print(result)  # {'faithfulness': 0.87, 'answer_relevancy': 0.91, ...}
```

## Common Failure Modes

| Problem | Symptom | Fix |
|---------|---------|-----|
| **Lost in the middle** | LLM ignores context in the middle of long prompts | Put most relevant chunks first and last |
| **Chunk boundary splits** | Key info split across chunks | Increase overlap, use parent-child chunking |
| **Wrong retrieval** | Good answer in DB but not retrieved | Add hybrid search, try different embeddings |
| **Hallucination despite context** | LLM makes up facts not in retrieved docs | Use faithfulness evaluation, add "only use provided context" instruction |
| **Stale data** | Answers reference outdated information | Set up incremental indexing pipeline |

## Key Takeaways

1. Chunking strategy matters more than model choice — experiment early
2. Always use hybrid search (BM25 + dense) in production
3. Add a reranker — it's the highest-ROI improvement you can make
4. Evaluate with RAGAS before and after every change
5. Start simple (Chroma + OpenAI embeddings), optimize when you have metrics

## Resources

- [RAGAS Evaluation Framework](https://docs.ragas.io/) — Metrics for RAG pipelines
- [LangChain RAG Tutorial](https://python.langchain.com/docs/tutorials/rag/) — End-to-end walkthrough
- [Chroma Docs](https://docs.trychroma.com/) — In-process vector store
- [Pinecone Learning Center](https://www.pinecone.io/learn/) — Vector search patterns
