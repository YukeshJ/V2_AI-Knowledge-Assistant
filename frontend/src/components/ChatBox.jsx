import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { chatApi, documentApi } from "../services/api";
import Sidebar from "./Sidebar";

export default function ChatBox({ title }) {
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState("");
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState("local");
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadDocuments = async () => {
    const res = await documentApi.list();
    setDocuments(res.data);
  };

  useEffect(() => {
    loadDocuments().catch(() => toast.error("Failed to load documents"));
    loadHistory().catch(() => toast.error("Failed to load chat history"));
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    const res = await chatApi.history(40);
    const reconstructed = [];
    // Rebuild conversational pairs from stored history rows.
    for (const item of [...res.data].reverse()) {
      reconstructed.push({ role: "user", text: item.question });
      reconstructed.push({ role: "assistant", text: item.answer });
    }
    setMessages(reconstructed);
    setLoadingHistory(false);
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    setLoading(true);
    const current = question;
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", text: current }]);
    try {
      const res = await chatApi.ask({
        question: current,
        document_id: selectedDocument || null,
        top_k: Number(topK),
        mode
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: res.data.answer, sources: res.data.sources || [] }
      ]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to get answer");
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await chatApi.clearHistory();
      setMessages([]);
      toast.success("Chat history cleared");
    } catch {
      toast.error("Failed to clear chat history");
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setQuestion((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onerror = () => {
      toast.error("Voice capture failed");
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  return (
    <div className="layout">
      <Sidebar
        documents={documents}
        selectedDocument={selectedDocument}
        setSelectedDocument={setSelectedDocument}
      />
      <main className="chat-panel">
        <header className="chat-header">
          <h2>{title}</h2>
          <div className="controls-row">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="local">Offline / Local</option>
              <option value="online">Online / API</option>
            </select>
            <input
              type="number"
              min="1"
              max="20"
              value={topK}
              onChange={(e) => setTopK(e.target.value)}
            />
            <button onClick={clearHistory}>Clear History</button>
          </div>
        </header>

        <section className="messages">
          {loadingHistory && <div className="loading">Loading previous chat...</div>}
          {messages.map((msg, i) => (
            <div key={i} className={`msg ${msg.role}`}>
              <p>{msg.text}</p>
              {msg.sources?.length > 0 && (
                <div className="sources">
                  <strong>Sources:</strong>
                  {msg.sources.map((s, idx) => (
                    <div key={idx}>
                      {s.document_name} - page {s.page_number}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && <div className="loading">Thinking...</div>}
        </section>

        <footer className="chat-input-area">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about your company knowledge..."
            onKeyDown={(e) => e.key === "Enter" && askQuestion()}
          />
          <button className={isListening ? "voice-btn active" : "voice-btn"} onClick={startVoiceInput}>
            {isListening ? "Listening..." : "Voice"}
          </button>
          <button onClick={askQuestion}>Send</button>
        </footer>
      </main>
    </div>
  );
}
