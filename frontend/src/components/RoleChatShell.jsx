import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { documentApi, ragApi, chatHistoryApi } from "../services/api";

export default function RoleChatShell({
  roleName,
  roleKey,
  welcomeTitle,
  welcomeText,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [selectedDocName, setSelectedDocName] = useState("");
  const [question, setQuestion] = useState("");
  const [readingMessageId, setReadingMessageId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [isListening, setIsListening] = useState(false);
  const [mode, setMode] = useState("local");
  
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

  const [messages, setMessages] = useState([
    {
      id: crypto.randomUUID(),
      type: "assistant",
      text: welcomeText,
      sources: [],
      cached: false,
    },
  ]);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) =>
      (doc.filename || "").toLowerCase().includes(docSearch.toLowerCase())
    );
  }, [documents, docSearch]);

  const getGreetingData = (name) => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: `Good morning, ${name}`, icon: "🌅" };
    if (hour < 17) return { text: `Good afternoon, ${name}`, icon: "☀️" };
    if (hour < 21) return { text: `Good evening, ${name}`, icon: "🌇" };
    return { text: `Good night, ${name}`, icon: "🌙" };
  };

  const autoResizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  };

  const loadDocuments = async () => {
    try {
      const res = await documentApi.list();
      const docs = Array.isArray(res.data) ? res.data : res.data?.documents || [];
      setDocuments(docs);

      if (docs.length > 0 && !selectedDocId) {
        setSelectedDocId(docs[0].id);
        setSelectedDocName(docs[0].filename);
      }
    } catch {
      toast.error("Failed to load documents");
    }
  };

  const loadHistory = async () => {
    try {
      const res = await chatHistoryApi.list(50);
      const historyMessages = [];
      const sortedHistory = [...(res.data || [])].reverse();

      sortedHistory.forEach((item) => {
        historyMessages.push({
          id: `q-${item.id}`,
          type: "user",
          text: item.question,
          sources: [],
        });
        historyMessages.push({
          id: `a-${item.id}`,
          type: "assistant",
          text: item.answer,
          sources: [],
          cached: false,
        });
      });

      if (historyMessages.length > 0) {
        setMessages(historyMessages);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  useEffect(() => {
    loadDocuments();
    loadHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    autoResizeTextarea();
  }, [question]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSelectDocument = (doc) => {
    setSelectedDocId(doc.id);
    setSelectedDocName(doc.filename);
    if (window.innerWidth <= 1024) {
      setSidebarOpen(false);
    }
    toast.success(`Selected: ${doc.filename}`);
  };

  const handlePreviewDocument = async (doc, e) => {
    e.stopPropagation();
    setIsPreviewLoading(true);
    // When opening a new preview, start in split-screen (not expanded)
    setIsPreviewExpanded(false);
    try {
      const response = await documentApi.getContent(doc.id);
      const url = window.URL.createObjectURL(response.data);
      setPreviewUrl(url);
    } catch (err) {
      toast.error("Failed to load document preview");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setIsPreviewExpanded(false);
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out");
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleSpeak = (id, text) => {
    if (!("speechSynthesis" in window)) {
      toast.error("Speech synthesis not supported");
      return;
    }

    if (readingMessageId === id) {
      window.speechSynthesis.cancel();
      setReadingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setReadingMessageId(id);
    utterance.onend = () => setReadingMessageId(null);
    utterance.onerror = () => setReadingMessageId(null);
    window.speechSynthesis.speak(utterance);
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "assistant",
          text: "Generation stopped by user.",
          sources: [],
          cached: false,
        },
      ]);
    }
  };

  const handleVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuestion((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      toast.error(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const askQuestion = async () => {
    if (!question.trim()) {
      toast.error("Enter a question");
      return;
    }

    if (!selectedDocId) {
      toast.error("Please select a document first");
      return;
    }

    const currentQuestion = question.trim();

    const userMessage = {
      id: crypto.randomUUID(),
      type: "user",
      text: currentQuestion,
      sources: [],
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    abortControllerRef.current = new AbortController();

    try {
      const res = await ragApi.ask(
        currentQuestion,
        4,
        selectedDocId,
        mode,
        abortControllerRef.current.signal
      );

      const data = res.data || {};

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "assistant",
          text:
            data.answer ||
            "I couldn't find a clear answer in the selected document.",
          sources: data.sources || [],
          cached: data.cached || false,
        },
      ]);
    } catch (err) {
      if (
        err.name === "CanceledError" ||
        err.message === "canceled" ||
        err.code === "ERR_CANCELED"
      ) {
        return;
      }

      const errorDetail = err.response?.data?.detail || "Failed to fetch answer from backend.";


      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "assistant",
          text: errorDetail,
          sources: [],
          cached: false,
        },

      ]);
      toast.error("Failed to fetch answer");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      askQuestion();
    }
  };

  const userAvatarObj = user?.username?.charAt(0).toUpperCase() || "U";
  const greeting = getGreetingData(user?.username || "User");

  return (
    <div className={`pro-chat-layout${sidebarOpen ? "" : " chat-sidebar-collapsed"}`}>
      <aside className={`pro-chat-sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="pro-chat-brand">
          <div className="sidebar-top-bar">
            {sidebarOpen && (
              <div className="pro-chat-brand-info">
                <div className="pro-chat-brand-icon">AI</div>
                <h2>Enterprise AI</h2>
              </div>
            )}
            <button
              className="chatgpt-sidebar-toggle"
              onClick={() => setSidebarOpen((prev) => !prev)}
              title="Toggle Sidebar"
              type="button"
            >
              ☰
            </button>
          </div>
        </div>

        {sidebarOpen && user?.role === "Project Manager" && (
          <div className="main-nav-pm" style={{ padding: "0 15px 15px", borderBottom: "1px solid var(--border)", marginBottom: "15px" }}>
            <button 
              className={`side-link active`} 
              onClick={() => navigate("/pm/chat")}
              style={{ width: "100%", textAlign: "left", padding: "10px 15px", borderRadius: "8px", background: "rgba(96, 165, 250, 0.1)", color: "var(--cyan)", border: "none", cursor: "pointer", fontWeight: 600, marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}
            >
              💬 AI Chat
            </button>
            <button 
              className={`side-link`} 
              onClick={() => navigate("/pm/manage")}
              style={{ width: "100%", textAlign: "left", padding: "10px 15px", borderRadius: "8px", background: "transparent", color: "var(--text-secondary)", border: "none", cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: "10px" }}
            >
              ⚙️ Manage
            </button>
          </div>
        )}


        {sidebarOpen && (

          <>
            <div className="doc-search-wrap">
              <input
                placeholder="Search documents..."
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
              />
            </div>

            <div className="doc-list-pro">
              {filteredDocs.length === 0 ? (
                <div className="doc-empty">No accessible documents</div>
              ) : (
                filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className={`doc-tile ${
                      String(selectedDocId) === String(doc.id) ? "active" : ""
                    }`}
                    onClick={() => handleSelectDocument(doc)}
                    style={{ position: 'relative', cursor: 'pointer' }}
                  >
                    <div className="doc-tile-icon">📄</div>
                    <div className="doc-tile-content" style={{ paddingRight: '60px' }}>
                      <strong>{doc.filename}</strong>
                      <span>
                        {String(selectedDocId) === String(doc.id)
                          ? "Selected"
                          : "Click to use"}
                      </span>
                    </div>
                    <button
                      className="ghost-btn"
                      onClick={(e) => handlePreviewDocument(doc, e)}
                      title="Preview Securely"
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        padding: '4px 8px',
                        fontSize: '12px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        zIndex: 2
                      }}
                    >
                      ⛶ preview
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="sidebar-actions-pro">
              <div className="workspace-label-clean">{roleName} Workspace</div>
              <button className="sidebar-logout-btn" onClick={handleLogout} type="button">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Logout
              </button>
            </div>
          </>
        )}
      </aside>

      <main className="pro-chat-main">
        <header className="pro-chat-header clean-header">
          <div className="clean-header-content">
            <div className="clean-header-left">
              <button
                className="mobile-menu-btn"
                onClick={() => setSidebarOpen(true)}
                title="Open Menu"
                type="button"
              >
                ☰
              </button>

              <div>
                <h1>{welcomeTitle}</h1>
                <p className="chat-subtitle">
                  {selectedDocName ? `Using: ${selectedDocName}` : "No document selected"}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <div className="mode-toggle-wrap">
                <span className={`mode-label ${mode === "local" ? "active" : ""}`}>Local</span>
                <button 
                  className={`mode-switch ${mode === "online" ? "online" : "offline"}`}
                  onClick={() => setMode(mode === "local" ? "online" : "local")}
                  title={`Switch to ${mode === "local" ? "Online (Gemini API)" : "Offline (Local)"} mode`}
                  type="button"
                >
                  <div className="mode-knob" />
                </button>
                <span className={`mode-label ${mode === "online" ? "active" : ""}`}>Online</span>
              </div>

              <div className="greeting-badge">
                <span className="greeting-icon">{greeting.icon}</span>
                <span className="greeting-text">{greeting.text}</span>
              </div>
            </div>
          </div>
        </header>

        {sidebarOpen && window.innerWidth <= 1024 && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Chat Side */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
            <section className="chat-message-board">
              <div className="chat-message-inner">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`pro-message ${msg.type === "user" ? "user" : "assistant"}`}
                  >
                    <div className="pro-message-avatar">
                      {msg.type === "user" ? userAvatarObj : "AI"}
                    </div>

                    <div className="pro-message-body">
                      <div className="pro-message-text">{msg.text}</div>

                      {msg.type === "assistant" &&
                        msg.text !== "Generation stopped by user." &&
                        msg.text !== "Failed to fetch answer from backend." && (
                          <span
                            className={`message-status-badge ${
                              msg.cached ? "cached" : "generated"
                            }`}
                          >
                            {msg.cached ? "⚡ Cached" : "🧠 AI generated"}
                          </span>
                        )}

                      {msg.type === "assistant" && (
                        <div className="message-actions">
                          <button
                            className="chatgpt-action-btn"
                            onClick={() => handleCopy(msg.text)}
                            title="Copy"
                            type="button"
                          >
                            🗐 Copy
                          </button>

                          <button
                            className="chatgpt-action-btn"
                            onClick={() => handleSpeak(msg.id, msg.text)}
                            title={readingMessageId === msg.id ? "Stop" : "Read"}
                            type="button"
                          >
                            {readingMessageId === msg.id ? "⏹ Stop" : "၊၊||၊ Read"}
                          </button>
                        </div>
                      )}

                      {Array.isArray(msg.sources) && msg.sources.length > 0 && (
                        <div className="sources-box-pro">
                          <div className="sources-title">Sources</div>
                          <div className="sources-chip-wrap">
                            {msg.sources.map((src, idx) => {
                              const label =
                                typeof src === "string"
                                  ? src
                                  : `${src.document_name || src.filename || "Document"}${
                                      src.page_number ? ` · p.${src.page_number}` : ""
                                    }`;

                              return (
                                <span key={idx} className="source-chip">
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="typing-card">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <span>Generating answer...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </section>

            <section className="chat-composer-pro">
              <div className="composer-pill-wrapper composer-pill-large">
                <div className="composer-textarea-wrap">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    placeholder={isListening ? "Listening..." : "Message Enterprise AI..."}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={onKeyDown}
                    className="chatgpt-input large-input"
                  />
                </div>

                <div className="composer-footer">
                  <div className="composer-actions-right">
                    <button
                      className={`chatgpt-mic ${isListening ? "active" : ""}`}
                      onClick={handleVoiceInput}
                      title={isListening ? "Stop listening" : "Voice input"}
                      type="button"
                    >
                      🎤
                    </button>

                    {loading ? (
                      <button
                        onClick={stopGeneration}
                        className="chatgpt-send"
                        title="Stop"
                        type="button"
                      >
                        ■
                      </button>
                    ) : (
                      <button
                        onClick={askQuestion}
                        className="chatgpt-send"
                        title="Send"
                        type="button"
                        disabled={!question.trim()}
                      >
                        ↑
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Preview Side Panel (Split Screen) */}
          {previewUrl && !isPreviewExpanded && (
            <div 
              style={{ 
                flex: "1", 
                borderLeft: "1px solid var(--border)", 
                display: "flex", 
                flexDirection: "column", 
                backgroundColor: "var(--bg-main)",
                minWidth: "300px"
              }}
            >
              <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text)" }}>Document Preview</h3>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    className="secondary-btn" 
                    style={{ padding: "6px 12px", fontSize: "13px" }} 
                    onClick={() => setIsPreviewExpanded(true)}
                  >
                    ⤢ Expand
                  </button>
                  <button 
                    className="danger-btn" 
                    style={{ padding: "6px 12px", fontSize: "13px" }} 
                    onClick={closePreview}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, position: "relative" }}>
                <iframe 
                  src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                  style={{ width: "100%", height: "100%", border: "none" }}
                  title="Secure Document Preview (Split)"
                  onContextMenu={(e) => e.preventDefault()}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Full-screen Document Preview Modal */}
      {previewUrl && isPreviewExpanded && (
        <div 
          className="preview-modal-overlay" 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            padding: '20px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, color: 'white' }}>Document Preview (Secure View)</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setIsPreviewExpanded(false)}
                className="secondary-btn"
                style={{ padding: '8px 16px', borderRadius: '8px' }}
              >
                ⤡ Collapse
              </button>
              <button 
                onClick={closePreview}
                className="danger-btn"
                style={{ padding: '8px 16px', borderRadius: '8px' }}
              >
                ✕ Close
              </button>
            </div>
          </div>
          
          <div style={{ flex: 1, backgroundColor: '#333', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
            {/* Overlay to prevent right-clicks on the iframe body if possible, though PDF viewers might handle this themselves */}
            <iframe 
              src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Secure Document Preview (Full)"
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        </div>
      )}
      
      {/* Loading Overlay for preview */}
      {isPreviewLoading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          color: 'white', fontSize: '1.2rem'
        }}>
          Loading secure preview...
        </div>
      )}
    </div>
  );
}