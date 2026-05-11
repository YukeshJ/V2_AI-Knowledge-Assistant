import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({ documents, selectedDocument, setSelectedDocument }) {
  const [open, setOpen] = useState(true);
  const { auth, logout } = useAuth();

  return (
    <aside className={`sidebar ${open ? "open" : "closed"}`}>
      <button className="toggle-btn" onClick={() => setOpen((v) => !v)}>
        {open ? "<<" : ">>"}
      </button>
      {open && (
        <>
          <h3>Knowledge Base</h3>
          <p className="badge">{auth?.role}</p>
          <button
            className={`doc-btn ${selectedDocument === "" ? "active" : ""}`}
            onClick={() => setSelectedDocument("")}
          >
            All Documents
          </button>
          {documents.map((doc) => (
            <button
              key={doc.id}
              className={`doc-btn ${selectedDocument === doc.id ? "active" : ""}`}
              onClick={() => setSelectedDocument(doc.id)}
            >
              {doc.filename}
            </button>
          ))}
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </>
      )}
    </aside>
  );
}
