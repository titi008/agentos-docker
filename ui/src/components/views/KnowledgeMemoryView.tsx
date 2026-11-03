'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useStore } from '@/store'
import {
  getMemoriesAPI,
  createMemoryAPI,
  updateMemoryAPI,
  deleteMemoryAPI,
  getLearningsAPI,
  deleteLearningAPI,
  getKnowledgeContentAPI,
  uploadKnowledgeTextAPI,
  deleteKnowledgeContentAPI,
  searchKnowledgeAPI
} from '@/api/os'
import {
  UserMemorySchema,
  LearningResponse,
  ContentResponseSchema,
  VectorSearchResult
} from '@/types/os'
import {
  Brain,
  Database,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Edit2,
  X,
  Upload,
  CheckCircle2,
  Sparkles,
  Tag,
  BookOpen
} from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { toast } from 'sonner'

dayjs.extend(relativeTime)

type KnowledgeMemoryTab = 'memories' | 'learnings' | 'knowledge'

export const KnowledgeMemoryView = () => {
  const { selectedEndpoint, authToken, userId } = useStore()
  const [activeTab, setActiveTab] =
    useState<KnowledgeMemoryTab>('memories')

  // Memories state
  const [memories, setMemories] = useState<UserMemorySchema[]>([])
  const [memorySearch, setMemorySearch] = useState('')
  const [isMemoriesLoading, setIsMemoriesLoading] = useState(false)
  const [isCreateMemoryOpen, setIsCreateMemoryOpen] = useState(false)
  const [newMemoryText, setNewMemoryText] = useState('')
  const [newMemoryTopics, setNewMemoryTopics] = useState('')
  const [editingMemory, setEditingMemory] =
    useState<UserMemorySchema | null>(null)

  // Learnings state
  const [learnings, setLearnings] = useState<LearningResponse[]>([])
  const [isLearningsLoading, setIsLearningsLoading] = useState(false)

  // Knowledge base state
  const [knowledgeDocs, setKnowledgeDocs] = useState<
    ContentResponseSchema[]
  >([])
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false)
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false)
  const [uploadDocName, setUploadDocName] = useState('')
  const [uploadDocContent, setUploadDocContent] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  // Vector Search Tester state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<VectorSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const fetchMemories = useCallback(async () => {
    if (!selectedEndpoint) return
    setIsMemoriesLoading(true)
    try {
      const res = await getMemoriesAPI(
        selectedEndpoint,
        authToken,
        memorySearch || undefined,
        userId
      )
      setMemories(res)
    } finally {
      setIsMemoriesLoading(false)
    }
  }, [selectedEndpoint, authToken, memorySearch, userId])

  const fetchLearnings = useCallback(async () => {
    if (!selectedEndpoint) return
    setIsLearningsLoading(true)
    try {
      const res = await getLearningsAPI(selectedEndpoint, authToken, userId)
      setLearnings(res)
    } finally {
      setIsLearningsLoading(false)
    }
  }, [selectedEndpoint, authToken, userId])

  const fetchKnowledge = useCallback(async () => {
    if (!selectedEndpoint) return
    setIsKnowledgeLoading(true)
    try {
      const res = await getKnowledgeContentAPI(selectedEndpoint, authToken)
      setKnowledgeDocs(res)
    } finally {
      setIsKnowledgeLoading(false)
    }
  }, [selectedEndpoint, authToken])

  useEffect(() => {
    if (activeTab === 'memories') fetchMemories()
    if (activeTab === 'learnings') fetchLearnings()
    if (activeTab === 'knowledge') fetchKnowledge()
  }, [activeTab, fetchMemories, fetchLearnings, fetchKnowledge])

  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemoryText.trim()) return

    const topics = newMemoryTopics
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    if (editingMemory) {
      const ok = await updateMemoryAPI(
        selectedEndpoint,
        editingMemory.memory_id,
        newMemoryText.trim(),
        topics,
        authToken,
        userId
      )
      if (ok) {
        setEditingMemory(null)
        setNewMemoryText('')
        setNewMemoryTopics('')
        setIsCreateMemoryOpen(false)
        fetchMemories()
      }
    } else {
      const ok = await createMemoryAPI(
        selectedEndpoint,
        newMemoryText.trim(),
        topics,
        authToken,
        userId
      )
      if (ok) {
        setNewMemoryText('')
        setNewMemoryTopics('')
        setIsCreateMemoryOpen(false)
        fetchMemories()
      }
    }
  }

  const handleDeleteMemory = async (memoryId: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) return
    const ok = await deleteMemoryAPI(selectedEndpoint, memoryId, authToken, userId)
    if (ok) fetchMemories()
  }

  const handleDeleteLearning = async (learningId: string) => {
    if (!confirm('Are you sure you want to delete this profile learning?'))
      return
    const ok = await deleteLearningAPI(selectedEndpoint, learningId, authToken)
    if (ok) {
      toast.success('Learning removed')
      fetchLearnings()
    }
  }

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadDocName.trim() || !uploadDocContent.trim()) return

    setIsUploading(true)
    try {
      const ok = await uploadKnowledgeTextAPI(
        selectedEndpoint,
        uploadDocName.trim(),
        uploadDocContent.trim(),
        authToken
      )
      if (ok) {
        setUploadDocName('')
        setUploadDocContent('')
        setIsUploadDocOpen(false)
        fetchKnowledge()
      }
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteDocument = async (contentId: string) => {
    if (!confirm('Are you sure you want to remove this document from the vector store?'))
      return
    const ok = await deleteKnowledgeContentAPI(
      selectedEndpoint,
      contentId,
      authToken
    )
    if (ok) fetchKnowledge()
  }

  const handleTestSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const results = await searchKnowledgeAPI(
        selectedEndpoint,
        searchQuery.trim(),
        authToken
      )
      setSearchResults(results)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden bg-background text-foreground font-dmmono">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-primary/10 px-6 py-4">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-primary">
            <Brain className="size-5" /> Memory & Knowledge Base
          </h1>
          <p className="text-xs text-muted">
            Manage agent long-term memories, user profiles, and vector-embedded knowledge.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-primary/15 bg-accent/40 p-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('memories')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'memories'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Sparkles className="size-3.5" /> User Memories
          </button>
          <button
            onClick={() => setActiveTab('learnings')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'learnings'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <BookOpen className="size-3.5" /> Learned Profiles
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
              activeTab === 'knowledge'
                ? 'bg-primary text-background font-semibold shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <Database className="size-3.5" /> Vector Knowledge Base
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {/* MEMORIES TAB */}
        {activeTab === 'memories' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Filter memories by topic or text..."
                  value={memorySearch}
                  onChange={(e) => setMemorySearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchMemories()}
                  className="h-9 w-72 rounded-xl border border-primary/15 bg-accent/40 pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchMemories}
                  disabled={isMemoriesLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-primary/15 bg-accent/40 px-3 py-1.5 text-xs text-muted hover:text-foreground"
                >
                  <RefreshCw
                    className={`size-3.5 ${isMemoriesLoading ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </button>

                <button
                  onClick={() => {
                    setEditingMemory(null)
                    setNewMemoryText('')
                    setNewMemoryTopics('')
                    setIsCreateMemoryOpen(true)
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-background hover:bg-primary/90 transition shadow-sm"
                >
                  <Plus className="size-3.5" /> Add Memory
                </button>
              </div>
            </div>

            {/* Memories List */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {memories.length === 0 ? (
                <div className="col-span-2 rounded-xl border border-primary/15 bg-accent/20 p-8 text-center text-xs text-muted">
                  {isMemoriesLoading
                    ? 'Loading memories...'
                    : 'No memories saved yet. Click "Add Memory" to inject facts or preferences for your agents.'}
                </div>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.memory_id}
                    className="flex flex-col justify-between rounded-xl border border-primary/15 bg-accent/30 p-4 space-y-3"
                  >
                    <div>
                      <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">
                        {m.memory}
                      </p>

                      {m.topics && m.topics.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {m.topics.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] text-primary"
                            >
                              <Tag className="size-2.5" /> {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-primary/10 pt-2 text-[10px] text-muted">
                      <span>
                        {m.updated_at
                          ? dayjs(m.updated_at).fromNow()
                          : 'Persistent'}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingMemory(m)
                            setNewMemoryText(m.memory)
                            setNewMemoryTopics((m.topics || []).join(', '))
                            setIsCreateMemoryOpen(true)
                          }}
                          className="text-muted hover:text-primary transition"
                          aria-label="Edit memory"
                        >
                          <Edit2 className="size-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteMemory(m.memory_id)}
                          className="text-muted hover:text-rose-400 transition"
                          aria-label="Delete memory"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* LEARNED PROFILES TAB */}
        {activeTab === 'learnings' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-primary">
                  Learned Profiles & Dynamic Insights
                </h2>
                <p className="text-xs text-muted">
                  Autonomous user attributes and entities captured by your AgentOS team during chats.
                </p>
              </div>

              <button
                onClick={fetchLearnings}
                disabled={isLearningsLoading}
                className="flex items-center gap-1.5 rounded-xl border border-primary/15 bg-accent/40 px-3 py-1.5 text-xs text-muted hover:text-foreground"
              >
                <RefreshCw
                  className={`size-3.5 ${isLearningsLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {learnings.length === 0 ? (
                <div className="col-span-2 rounded-xl border border-primary/15 bg-accent/20 p-8 text-center text-xs text-muted">
                  {isLearningsLoading
                    ? 'Loading learnings...'
                    : 'No autonomous learnings captured yet. As you converse with your agents, structured facts about your business will automatically be recorded here.'}
                </div>
              ) : (
                learnings.map((l) => (
                  <div
                    key={l.learning_id}
                    className="rounded-xl border border-primary/15 bg-accent/30 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary uppercase text-[11px]">
                        {l.learning_type}
                      </span>
                      <button
                        onClick={() => handleDeleteLearning(l.learning_id)}
                        className="text-muted hover:text-rose-400 transition"
                        aria-label="Delete learning"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <pre className="overflow-auto rounded bg-black/40 p-2.5 text-[11px] text-zinc-300 whitespace-pre-wrap">
                      {JSON.stringify(l.content, null, 2)}
                    </pre>

                    <div className="text-[10px] text-muted">
                      {l.created_at
                        ? dayjs(l.created_at * 1000).format('MMM D, YYYY')
                        : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VECTOR KNOWLEDGE TAB */}
        {activeTab === 'knowledge' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-primary">
                  Vector Knowledge Documents (`pgvector`)
                </h2>
                <p className="text-xs text-muted">
                  Content indexed into PostgreSQL embeddings for retrieval-augmented generation (RAG).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchKnowledge}
                  disabled={isKnowledgeLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-primary/15 bg-accent/40 px-3 py-1.5 text-xs text-muted hover:text-foreground"
                >
                  <RefreshCw
                    className={`size-3.5 ${isKnowledgeLoading ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </button>

                <button
                  onClick={() => setIsUploadDocOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-background hover:bg-primary/90 transition shadow-sm"
                >
                  <Upload className="size-3.5" /> Ingest Document / Note
                </button>
              </div>
            </div>

            {/* Document Table */}
            <div
              tabIndex={0}
              role="region"
              aria-label="Vector Knowledge Base Documents"
              className="overflow-x-auto rounded-xl border border-primary/15 bg-accent/20"
            >
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-primary/10 bg-background/90 backdrop-blur text-muted uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Document Name</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Size</th>
                    <th className="px-4 py-3 font-medium">Indexed At</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {knowledgeDocs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted">
                        {isKnowledgeLoading
                          ? 'Loading documents...'
                          : 'No documents in vector database. Ingest notes or business context to ground your agents.'}
                      </td>
                    </tr>
                  ) : (
                    knowledgeDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-accent/30 transition">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            <CheckCircle2 className="size-2.5" />{' '}
                            {doc.status || 'READY'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {doc.name || doc.id}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {doc.type || 'text'}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {doc.size || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted whitespace-nowrap">
                          {doc.created_at
                            ? dayjs(doc.created_at).format('MMM D, YYYY')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-muted hover:text-rose-400 transition"
                            aria-label="Delete document"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Live Vector Search Query Tester */}
            <div className="rounded-xl border border-primary/15 bg-accent/30 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase text-primary">
                  Live Vector Search & Chunk Tester
                </h3>
              </div>
              <p className="text-xs text-muted">
                Test how `pgvector` retrieves and ranks semantic knowledge chunks for a given query.
              </p>

              <form onSubmit={handleTestSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter test query (e.g., 'What are our business pricing tiers?')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 flex-1 rounded-xl border border-primary/20 bg-background/80 px-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-background hover:bg-primary/90 transition shadow-sm"
                >
                  <Search className="size-3.5" />
                  {isSearching ? 'Searching...' : 'Test Search'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] uppercase text-muted">
                    Retrieved Results ({searchResults.length}):
                  </span>
                  {searchResults.map((res, i) => (
                    <div
                      key={res.id || i}
                      className="rounded-lg border border-primary/15 bg-background/90 p-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-primary">
                          {res.name || `Chunk #${i + 1}`}
                        </span>
                        {res.reranking_score !== undefined && (
                          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted">
                            Score: {res.reranking_score.toFixed(4)}
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-300 text-xs leading-relaxed">
                        {res.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Memory Modal */}
      {isCreateMemoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-primary/20 bg-background p-6 shadow-2xl font-dmmono">
            <div className="flex items-center justify-between border-b border-primary/15 pb-3">
              <h3 className="text-sm font-semibold text-primary">
                {editingMemory ? 'Edit Memory' : 'Add Persistent Memory'}
              </h3>
              <button
                onClick={() => setIsCreateMemoryOpen(false)}
                className="text-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMemory} className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-muted uppercase">Memory / Fact</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g., Company brand tone is friendly, technical, and concise..."
                  value={newMemoryText}
                  onChange={(e) => setNewMemoryText(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-primary/20 bg-accent/40 p-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted uppercase">
                  Topics (comma-separated tags)
                </label>
                <input
                  type="text"
                  placeholder="brand, preferences, tech-stack"
                  value={newMemoryTopics}
                  onChange={(e) => setNewMemoryTopics(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateMemoryOpen(false)}
                  className="rounded-xl border border-primary/15 px-4 py-2 text-xs text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-background hover:bg-primary/90"
                >
                  Save Memory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadDocOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-primary/20 bg-background p-6 shadow-2xl font-dmmono">
            <div className="flex items-center justify-between border-b border-primary/15 pb-3">
              <h3 className="text-sm font-semibold text-primary">
                Ingest Note / Document into Knowledge Base
              </h3>
              <button
                onClick={() => setIsUploadDocOpen(false)}
                className="text-muted hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleUploadDocument} className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-muted uppercase">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. solopreneur_business_model.md"
                  value={uploadDocName}
                  onChange={(e) => setUploadDocName(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-primary/20 bg-accent/40 px-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted uppercase">
                  Content (Markdown / Text)
                </label>
                <textarea
                  rows={8}
                  required
                  placeholder="Paste documentation, business facts, product specifications, or strategy notes..."
                  value={uploadDocContent}
                  onChange={(e) => setUploadDocContent(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-primary/20 bg-accent/40 p-3 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadDocOpen(false)}
                  className="rounded-xl border border-primary/15 px-4 py-2 text-xs text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-background hover:bg-primary/90"
                >
                  <Upload className="size-3.5" />
                  {isUploading ? 'Ingesting...' : 'Ingest Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
