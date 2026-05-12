import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import toast from "react-hot-toast";

export default function Sidebar({ 
  sidebarOpen, 
  setSidebarOpen, 
  activeSection, 
  scrollTo, 
  refs,
  documentsCount,
  usersCount
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const isPM = user?.role === "Project Manager";

  return (
    <aside className={`pro-sidebar ${sidebarOpen ? "open" : "closed"}`} style={{ overflow: "hidden", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
      <div className="brand-block" style={{ padding: sidebarOpen ? "24px" : "24px 0", display: "flex", justifyContent: "center" }}>
        <div className="sidebar-top-bar" style={{justifyContent: sidebarOpen ? "space-between" : "center", width: "100%", padding: sidebarOpen ? "0" : "0 20px"}}>
          {sidebarOpen && (
            <div className="pro-chat-brand-info">
               <div className="brand-logo" style={{width: 32, height: 32, fontSize: 14}}>AI</div>
               <div>
                 <h2 style={{fontSize: "16px", margin: 0}}>Enterprise AI</h2>
                 <p style={{fontSize: "12px", margin: 0, color: "var(--muted)"}}>{isAdmin ? "Admin Center" : "PM Workspace"}</p>
               </div>
            </div>
          )}
          <button
            className="chatgpt-sidebar-toggle"
            onClick={() => setSidebarOpen((prev) => !prev)}
            title="Toggle Sidebar"
          >
            ☰
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <nav className="side-nav" style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {isPM ? (
            <>
              <button 
                 className={`side-link ${window.location.pathname === "/pm/chat" ? "active" : ""}`}
                 onClick={() => navigate("/pm/chat")}
                 style={{ padding: "12px 16px", fontSize: "14px", minHeight: "40px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                 💬 AI Chat
              </button>
              <button 
                 className={`side-link ${window.location.pathname === "/pm/manage" ? "active" : ""}`}
                 onClick={() => navigate("/pm/manage")}
                 style={{ padding: "12px 16px", fontSize: "14px", minHeight: "40px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                 ⚙️ Manage
              </button>
            </>

          ) : (
            <>
              <button 
                 className={`side-link ${activeSection === "upload" ? "active" : ""}`}
                 onClick={() => scrollTo(refs.uploadRef)}
                 style={{ padding: "10px 16px", fontSize: "14px", minHeight: "36px", marginBottom: "4px" }}>
                 Upload Document
              </button>
              <button 
                 className={`side-link ${activeSection === "documents" ? "active" : ""}`}
                 onClick={() => scrollTo(refs.docsRef)}
                 style={{ padding: "10px 16px", fontSize: "14px", minHeight: "36px", marginBottom: "4px" }}>
                 Documents list
              </button>
              <button 
                 className={`side-link ${activeSection === "users" ? "active" : ""}`}
                 onClick={() => scrollTo(refs.usersRef)}
                 style={{ padding: "10px 16px", fontSize: "14px", minHeight: "36px", marginBottom: "4px" }}>
                 User Management
              </button>
              <button 
                 className={`side-link ${activeSection === "analytics" ? "active" : ""}`}
                 onClick={() => scrollTo(refs.analyticsRef)}
                 style={{ padding: "10px 16px", fontSize: "14px", minHeight: "36px", marginBottom: "4px" }}>
                 Analytics
              </button>
              <button 
                 className={`side-link ${activeSection === "queries" ? "active" : ""}`}
                 onClick={() => scrollTo(refs.queriesRef)}
                 style={{ padding: "10px 16px", fontSize: "14px", minHeight: "36px", marginBottom: "4px" }}>
                 Recent Queries
              </button>
              <button 
                 className={`side-link ${activeSection === "audit" ? "active" : ""}`}
                 onClick={() => scrollTo(refs.auditRef)}
                 style={{ padding: "10px 16px", fontSize: "14px", minHeight: "36px" }}>
                 Audit Logs
              </button>
            </>
          )}
        </nav>
      )}

      {sidebarOpen && (
        <div className="sidebar-footer">
          <div className="mini-stat">
            <span>Docs</span>
            <strong>{documentsCount}</strong>
          </div>
          <div className="mini-stat">
            <span>Users</span>
            <strong>{usersCount}</strong>
          </div>
          <button className="sidebar-logout-btn" onClick={() => { toast.success("Logged out"); logout(); }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>
        </div>
      )}
    </aside>
  );
}
