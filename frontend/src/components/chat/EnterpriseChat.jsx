import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { documentApi, ragApi, chatHistoryApi, userApi } from "../../services/api";

export default function EnterpriseChat({ roleName, welcomeTitle, welcomeText }) {
  const { user, logout } = useAuth();
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchDoc, setSearchDoc] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [messages, setMessages] = useState([
    { id: crypto.randomUUID(), type: "assistant", text: welcomeText, timestamp: new Date() },
  ]);

  const filteredDocs = useMemo(() => 
    documents.filter(d => d.filename?.toLowerCase().includes(searchDoc.toLowerCase())), 
    [documents, searchDoc]
  );

  const filteredUsers = useMemo(() => 
    users.filter(u => u.username?.toLowerCase().includes(searchUser.toLowerCase())), 
    [users, searchUser]
  );

  const loadAll = async () => {
    try {
      const [docRes, userRes] = await Promise.all([documentApi.list(), userApi.list()]);
      setDocuments(docRes.data || []);
      setUsers(userRes.data || []);
    } catch (err) {
      toast.error("Failed to load environment data");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const askQuestion = async () => {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion("");
    const userMsg = { id: crypto.randomUUID(), type: "user", text: q, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await ragApi.ask(q, 4, selectedDocId);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        type: "assistant",
        text: res.data.answer || "No response.",
        timestamp: new Date(),
        sources: res.data.sources || []
      }]);
    } catch {
      toast.error("AI failed to respond");
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

  return (
    <div className={`pro-chat-layout ${sidebarOpen ? "" : "chat-sidebar-collapsed"}`}>
      <aside className={`pro-chat-sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="pro-chat-brand">
          <div className="sidebar-top-bar" style={{ padding: "10px 20px" }}>
            <div className="pro-chat-brand-info">
              <div className="brand-logo" style={{ width: 32, height: 32, fontSize: 14 }}>AI</div>
              <h2>Enterprise Chat</h2>
            </div>
            <button className="chatgpt-sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          </div>
        </div>

        {sidebarOpen && (
          <div className="sidebar-content-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 15px" }}>
            <div className="section-title">Knowledge Base</div>
            <input 
              className="search-input" 
              placeholder="Search documents..." 
              value={searchDoc} 
              onChange={e => setSearchDoc(e.target.value)} 
              style={{ marginBottom: "10px" }}
            />
            <div className="doc-list-pro">
              {filteredDocs.map(doc => (
                <div 
                  key={doc.id} 
                  className={`doc-tile ${selectedDocId === doc.id ? "active" : ""}`}
                  onClick={() => setSelectedDocId(doc.id)}
                >
                  <div className="doc-tile-icon">📄</div>
                  <div className="doc-tile-content">
                    <strong>{doc.filename}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="section-title" style={{ marginTop: "20px" }}>Team Directory</div>
            <input 
              className="search-input" 
              placeholder="Search users..." 
              value={searchUser} 
              onChange={e => setSearchUser(e.target.value)} 
              style={{ marginBottom: "10px" }}
            />
            <div className="user-list">
              {filteredUsers.map(u => (
                <div key={u.id} className="user-row-pro" style={{ padding: "8px", border: "none", background: "transparent" }}>
                  <div className="user-badge" style={{ width: 32, height: 32, fontSize: 12 }}>{u.username[0].toUpperCase()}</div>
                  <div className="user-main">
                    <strong>{u.username}</strong>
                    <span>{u.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-actions-pro" style={{ padding: "20px" }}>
          <button className="sidebar-logout-btn" onClick={() => (window.location.href = "/pm")}>
            ← Back to Dashboard
          </button>
        </div>
      </aside>

      <main className="pro-chat-main">
        <header className="pro-chat-header clean-header">
           <div className="clean-header-content" style={{ padding: "0 20px" }}>
              <h1>{welcomeTitle}</h1>
              <p className="chat-subtitle">{roleName} View • Live Intelligence</p>
           </div>
        </header>

        <section className="chat-message-board">
          <div className="chat-message-inner">
            {messages.map(m => (
              <div key={m.id} className={`pro-message ${m.type}`}>
                <div className="pro-message-avatar">{m.type === "user" ? user?.username[0].toUpperCase() : "AI"}</div>
                <div className="pro-message-body">
                  <div className="pro-message-text">{m.text}</div>
                  <div className="message-time" style={{ fontSize: "10px", opacity: 0.5, marginTop: "5px" }}>
                    {m.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {loading && <div className="typing-card"><div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" /></div>}
            <div ref={messagesEndRef} />
          </div>
        </section>

        <section className="chat-composer-pro">
          <div className="composer-pill-wrapper composer-pill-large">
            <textarea 
              ref={textareaRef}
              rows={1}
              placeholder="Ask anything to the AI Knowledge Assistant..."
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              className="chatgpt-input large-input"
            />
            <button className="chatgpt-send" onClick={askQuestion} disabled={!question.trim() || loading}>↑</button>
          </div>
        </section>
      </main>
    </div>
  );
}
