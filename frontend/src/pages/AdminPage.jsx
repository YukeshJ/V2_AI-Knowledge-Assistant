import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { analyticsApi, auditApi, documentApi, userApi, chatHistoryApi } from "../services/api";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  "admin",
  "Project Manager",
  "Team Leader",
  "Senior Developer",
  "Junior Developer",
];

export default function AdminPage() {
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [file, setFile] = useState(null);
  const [allowedRoles, setAllowedRoles] = useState([]);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "Junior Developer",
  });
  const [newUserShowPass, setNewUserShowPass] = useState(false);
  const [editState, setEditState] = useState({});
  const [analytics, setAnalytics] = useState({
    total_queries: 0,
    active_users: 0,
    top_queries: [],
    trend: [],
    window_days: 7,
  });
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [auditLogs, setAuditLogs] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  
  const [dragActive, setDragActive] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [searchDoc, setSearchDoc] = useState("");

  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);

  const dashboardRef = useRef(null);
  const uploadRef = useRef(null);
  const docsRef = useRef(null);
  const usersRef = useRef(null);
  const analyticsRef = useRef(null);
  const queriesRef = useRef(null);
  const auditRef = useRef(null);

  // Modals state
  const [docToDelete, setDocToDelete] = useState(null);
  const [docToEdit, setDocToEdit] = useState(null);
  const [editDocRoles, setEditDocRoles] = useState([]);
  const [userToEdit, setUserToEdit] = useState(null);
  const [showDeleteHistoryModal, setShowDeleteHistoryModal] = useState(false);

  const { user, logout } = useAuth();

  const getGreetingData = (name) => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: `Good morning, ${name}`, icon: "🌅" };
    if (hour < 17) return { text: `Good afternoon, ${name}`, icon: "☀️" };
    if (hour < 21) return { text: `Good evening, ${name}`, icon: "🌇" };
    return { text: `Good night, ${name}`, icon: "🌙" };
  };

  const loadAll = async () => {
    const [docRes, userRes] = await Promise.all([
      documentApi.list(),
      userApi.list(),
    ]);
    setDocuments(docRes.data || []);
    setUsers(userRes.data || []);
  };

  const loadAnalytics = async () => {
    const analyticsRes = await analyticsApi.get(analyticsDays);
    setAnalytics(prev => ({ ...prev, ...analyticsRes.data }));
  };

  const loadActiveUsers = async () => {
    try {
      const res = await analyticsApi.getActiveUsers();
      setAnalytics(prev => ({ ...prev, active_users: res.data.active_users }));
    } catch (err) {}
  };

  const loadAuditLogs = async () => {
    const res = await auditApi.list(80);
    setAuditLogs(res.data || []);
  };

  const loadHistory = async () => {
    const res = await chatHistoryApi.list(50);
    setChatHistory(res.data || []);
  };

  const refreshAll = async () => {
    const toastId = toast.loading("Refreshing admin data...");
    try {
      await Promise.all([
        loadAll(),
        loadAnalytics(),
        loadAuditLogs(),
        loadHistory(),
      ]);
      toast.success("Data refreshed", { id: toastId });
    } catch {
      toast.error("Failed to refresh some data", { id: toastId });
    }
  };

  useEffect(() => {
    loadAll().catch(() => {});
    loadAuditLogs().catch(() => {});
    loadHistory().catch(() => {});
  }, []);

  useEffect(() => {
    loadAnalytics().catch(() => {});
  }, [analyticsDays]);

  useEffect(() => {
    // Heartbeat for active users status
    const heartbeat = setInterval(() => {
      authApi.updateActiveStatus().catch(() => {});
    }, 30000); // 30 seconds
    return () => clearInterval(heartbeat);
  }, []);

  useEffect(() => {
    const fetchAutoRefreshData = async () => {
      try {
        await Promise.all([
          loadAnalytics(),
          loadHistory()
        ]);
      } catch (e) {
        // Silent fail for background refresh
      }
    };

    const interval = setInterval(fetchAutoRefreshData, 5000); // 5 seconds
    return () => clearInterval(interval);
  }, [analyticsDays]); // Re-run interval setup if analyticsDays changes so it fetches correct data

  useEffect(() => {
    // Initial fetch
    loadActiveUsers();
    // 1 minute refresh for active users specifically
    const activeUsersInterval = setInterval(loadActiveUsers, 60000);
    return () => clearInterval(activeUsersInterval);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );

    [
      dashboardRef.current,
      uploadRef.current,
      docsRef.current,
      usersRef.current,
      analyticsRef.current,
      queriesRef.current,
      auditRef.current,
    ].forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleRole = (role) => {
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const selectAllRoles = () => setAllowedRoles(ROLES);
  const clearAllRoles = () => setAllowedRoles([]);

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are allowed");
      return;
    }
    setFile(selectedFile);
    toast.success("PDF selected");
  };

  const upload = async () => {
    if (!file) {
      toast.error("Please choose a PDF file");
      return;
    }
    if (allowedRoles.length === 0) {
      toast.error("Select at least one allowed role");
      return;
    }

    const toastId = toast.loading("Uploading...");
    try {
      await documentApi.upload(file, allowedRoles);
      toast.success("Document uploaded and indexed", { id: toastId });
      setFile(null);
      setAllowedRoles([]);
      refreshAll();
    } catch {
      toast.error("Upload failed", { id: toastId });
    }
  };

  const confirmDeleteDocument = async () => {
    if (!docToDelete) return;
    try {
      await documentApi.delete(docToDelete.id);
      toast.success("Document deleted");
      setDocToDelete(null);
      refreshAll();
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const saveEditedDocRoles = async () => {
    if (!docToEdit) return;
    try {
      await documentApi.updateRoles(docToEdit.id, editDocRoles);
      toast.success("Updated document access");
      setDocToEdit(null);
      loadAll();
      loadAuditLogs();
    } catch {
      toast.error("Failed to update document roles");
    }
  };

  const createUser = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) {
      toast.error("Username and password are required");
      return;
    }

    try {
      await userApi.create(newUser);
      toast.success("User created");
      setNewUser({
        username: "",
        password: "",
        role: "Junior Developer",
      });
      refreshAll();
    } catch {
      toast.error("Failed to create user");
    }
  };

  const deleteUser = async (id) => {
    try {
      await userApi.delete(id);
      toast.success("User removed");
      refreshAll();
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const updateUser = async (id) => {
    if (!editState) return;

    try {
      await userApi.update(id, {
        role: editState.role,
        password: editState.password || undefined,
      });
      toast.success("User updated");
      setUserToEdit(null);
      setEditState({});
      refreshAll();
    } catch {
      toast.error("Failed to update user");
    }
  };

  const exportAnalyticsCsv = async () => {
    try {
      const res = await analyticsApi.exportCsv(analyticsDays);
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `analytics_${analyticsDays}d.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Analytics CSV downloaded");
    } catch {
      toast.error("Failed to export analytics");
    }
  };

  const deleteChatHistoryItem = async (id) => {
    try {
      await chatHistoryApi.deleteItem(id);
      toast.success("Query deleted");
      loadHistory();
      loadAnalytics(); 
      loadAuditLogs();
    } catch {
      toast.error("Failed to delete query");
    }
  };

  const deleteAllChatHistory = async () => {
    try {
      await chatHistoryApi.deleteAll();
      toast.success("All chat history deleted");
      setShowDeleteHistoryModal(false);
      loadHistory();
      loadAnalytics();
      loadAuditLogs();
    } catch {
      toast.error("Failed to delete all history");
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) =>
      doc.filename?.toLowerCase().includes(searchDoc.toLowerCase())
    );
  }, [documents, searchDoc]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) =>
      u.username?.toLowerCase().includes(searchUser.toLowerCase())
    );
  }, [users, searchUser]);

  const trendMax = Math.max(...analytics.trend.map((v) => v.count || 0), 1);

  return (
    <div className={`admin-shell ${sidebarOpen ? "" : "sidebar-closed"}`}>
      <aside className={`pro-sidebar ${sidebarOpen ? "open" : "closed"}`} style={{ overflow: "hidden", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
        <div className="brand-block" style={{ padding: sidebarOpen ? "24px" : "24px 0", display: "flex", justifyContent: "center" }}>
          <div className="sidebar-top-bar" style={{justifyContent: sidebarOpen ? "space-between" : "center", width: "100%", padding: sidebarOpen ? "0" : "0 20px"}}>
            {sidebarOpen && (
              <div className="pro-chat-brand-info">
                 <div className="brand-logo" style={{width: 32, height: 32, fontSize: 14}}>AI</div>
                 <div>
                   <h2 style={{fontSize: "16px", margin: 0}}>Enterprise AI</h2>
                   <p style={{fontSize: "12px", margin: 0, color: "var(--muted)"}}>Admin Center</p>
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
            <button 
               className={`side-link ${activeSection === "upload" ? "active" : ""}`}
               onClick={() => scrollTo(uploadRef)}
               style={{ padding: "10px 16px", fontSize: "14px", minHeight: "36px", marginBottom: "4px" }}>
               Upload Document
            </button>
            <button 
               className={`side-link ${activeSection === "documents" ? "active" : ""}`}
               onClick={() => scrollTo(docsRef)}
               style={{ padding: "10px 16px", fontSize: "14px", minHeight: "36px", marginBottom: "4px" }}>
               Documents list
            </button>
            <button 
               className={`side-link ${activeSection === "users" ? "active" : ""}`}
               onClick={() => scrollTo(usersRef)}
               style={{ padding: "10px 16px", fontSize: "14px", minHeight: "36px", marginBottom: "4px" }}>
               User Management
            </button>
            <button 
               className={`side-link ${activeSection === "analytics" ? "active" : ""}`}
               onClick={() => scrollTo(analyticsRef)}
               style={{ padding: "10px 16px", fontSize: "14px", minHeight: "36px", marginBottom: "4px" }}>
               Analytics
            </button>
            <button 
               className={`side-link ${activeSection === "queries" ? "active" : ""}`}
               onClick={() => scrollTo(queriesRef)}
               style={{ padding: "10px 16px", fontSize: "14px", minHeight: "36px", marginBottom: "4px" }}>
               Recent Queries
            </button>
            <button 
               className={`side-link ${activeSection === "audit" ? "active" : ""}`}
               onClick={() => scrollTo(auditRef)}
               style={{ padding: "10px 16px", fontSize: "14px", minHeight: "36px" }}>
               Audit Logs
            </button>
          </nav>
        )}

        {sidebarOpen && (
          <div className="sidebar-footer">
            <div className="mini-stat">
              <span>Docs</span>
              <strong>{documents.length}</strong>
            </div>
            <div className="mini-stat">
              <span>Users</span>
              <strong>{users.length}</strong>
            </div>
            <button className="sidebar-logout-btn" onClick={() => { toast.success("Logged out"); logout(); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Logout
            </button>
          </div>
        )}
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
             <button 
               className="mobile-menu-btn" 
               onClick={() => setSidebarOpen(true)}
               title="Open Menu"
             >
               ☰
             </button>
             <div>
               <p className="eyebrow">Secure On-Premise AI Platform</p>
               <h1>Admin Dashboard</h1>
             </div>
          </div>
          {(() => {
             const greeting = getGreetingData(user?.username || "Admin");
             return (
               <div className="greeting-badge">
                 <span className="greeting-icon">{greeting.icon}</span>
                 <span className="greeting-text">{greeting.text}</span>
               </div>
             );
          })()}
        </header>

        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        <section id="dashboard" className="hero-stats" ref={dashboardRef}>
          <div className="hero-stat-card glow-blue">
            <div className="hero-stat-icon">📄</div>
            <div>
              <p>Total Documents</p>
              <h3>{documents.length}</h3>
            </div>
          </div>

          <div className="hero-stat-card glow-cyan">
            <div className="hero-stat-icon">👥</div>
            <div>
              <p>Total Users</p>
              <h3>{users.length}</h3>
            </div>
          </div>

          <div className="hero-stat-card glow-violet">
            <div className="hero-stat-icon">💬</div>
            <div>
              <p>Total Queries</p>
              <h3>{analytics.total_queries}</h3>
            </div>
          </div>

          <div className="hero-stat-card glow-emerald">
            <div className="hero-stat-icon">⚡</div>
            <div>
              <p>Active Users</p>
              <h3>{analytics.active_users}</h3>
            </div>
          </div>
        </section>

        <section id="upload" className="pro-card upload-card section-bottom-margin" ref={uploadRef}>
          <div className="card-head">
            <div>
              <h3>Upload PDF Document</h3>
              <p>Upload, assign role access, and index instantly</p>
            </div>
          </div>

          <div
            className={`upload-dropzone ${dragActive ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const droppedFile = e.dataTransfer.files?.[0];
              handleFileChange(droppedFile);
            }}
          >
            <input
              id="pdfUpload"
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              hidden
            />
            <label htmlFor="pdfUpload" className="upload-dropzone-inner">
              <div className="upload-icon">⬆</div>
              <h4>{file ? file.name : "Drop PDF here or click to browse"}</h4>
              <p>Supports PDF files only</p>
            </label>
          </div>

          <div className="role-selection-area">
            <div className="role-actions-head" style={{display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px', justifyContent: 'flex-start'}}>
              <span>Select Allowed Roles</span>
            </div>
            <div className="role-pill-grid">
              {ROLES.map((role) => {
                const active = allowedRoles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    className={`role-pill ${active ? "active" : ""}`}
                    onClick={() => toggleRole(role)}
                  >
                    <span className="role-check">{active ? "✓" : "+"}</span>
                    {role}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="action-row">
            <button className="role-select-all-btn" onClick={selectAllRoles}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Select All
            </button>
            <button className="role-clear-btn" onClick={clearAllRoles}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Clear
            </button>
            <div style={{flex: 1}} />
            <button className="primary-btn" onClick={upload}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px'}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload &amp; Index
            </button>
          </div>
        </section>

        <section id="documents" className="pro-card section-bottom-margin" ref={docsRef}>
          <div className="card-head">
            <div>
              <h3>Documents</h3>
              <p>Manage uploaded knowledge base files</p>
            </div>
            <input
              className="search-input"
              placeholder="Search documents..."
              value={searchDoc}
              onChange={(e) => setSearchDoc(e.target.value)}
            />
          </div>

          <div className="stack-list" style={{overflow: "visible"}}>
            {filteredDocuments.length === 0 && (
              <div className="empty-state">No documents found.</div>
            )}

            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="fancy-row">
                <div className="row-left">
                  <div className="row-icon">📘</div>
                  <div>
                    <strong className="row-title">{doc.filename}</strong>
                    <p className="row-subtitle">Roles: {doc.allowed_roles.join(", ")}</p>
                  </div>
                </div>
                <div className="row-actions-group">
                  <button className="secondary-btn" onClick={() => {
                     setDocToEdit(doc);
                     setEditDocRoles([...doc.allowed_roles]);
                  }}>
                    Edit RBAC
                  </button>
                  <button
                    className="danger-btn"
                    onClick={() => setDocToDelete(doc)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="users" className="pro-card section-bottom-margin" ref={usersRef}>
          <div className="card-head">
            <div>
              <h3>User Management</h3>
              <p>Create, update roles, and manage passwords</p>
            </div>
          </div>

          <div className="create-user-box">
            <input
              placeholder="Username"
              value={newUser.username}
              onChange={(e) =>
                setNewUser((v) => ({ ...v, username: e.target.value }))
              }
            />
            <div className="password-wrap-pro">
               <input
                 placeholder="Password"
                 type={newUserShowPass ? "text" : "password"}
                 value={newUser.password}
                 onChange={(e) =>
                   setNewUser((v) => ({ ...v, password: e.target.value }))
                 }
               />
               <button type="button" className="password-toggle-btn" onClick={() => setNewUserShowPass(!newUserShowPass)}>
                 {newUserShowPass ? "Hide" : "Show"}
               </button>
            </div>
            
            <select
              value={newUser.role}
              onChange={(e) =>
                setNewUser((v) => ({ ...v, role: e.target.value }))
              }
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button className="primary-btn" onClick={createUser}>
              Create User
            </button>
          </div>

          <div className="card-head inline-head">
            <h4>All Users</h4>
            <input
              className="search-input"
              placeholder="Search users..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
            />
          </div>

          <div className="user-list" style={{overflow: "visible"}}>
            {filteredUsers.length === 0 && (
              <div className="empty-state">No users found.</div>
            )}

            {filteredUsers.map((u) => (
              <div key={u.id} className="user-row-pro">
                <div className="user-badge">
                  {u.username?.slice(0, 1)?.toUpperCase() || "U"}
                </div>

                <div className="user-main">
                  <strong>{u.username}</strong>
                  <span>{u.role}</span>
                </div>

                <div className="row-actions-group" style={{marginLeft: "auto"}}>
                  <button
                    className="secondary-btn"
                    onClick={() => {
                        setEditState({ role: u.role, password: "", showPass: false });
                        setUserToEdit(u);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="danger-btn"
                    onClick={() => deleteUser(u.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="analytics" className="pro-card analytics-card section-bottom-margin" ref={analyticsRef}>
          <div className="card-head">
            <div>
              <h3>Analytics</h3>
              <p>Usage overview and question activity</p>
            </div>

            <div className="analytics-toolbar">
              <select
                value={analyticsDays}
                onChange={(e) => setAnalyticsDays(Number(e.target.value))}
              >
                <option value={1}>Last 24h</option>
                <option value={7}>Last 7d</option>
                <option value={30}>Last 30d</option>
              </select>
              <button className="ghost-btn" onClick={loadAnalytics}>
                Refresh
              </button>
              <button className="primary-btn" onClick={exportAnalyticsCsv}>
                Export CSV
              </button>
            </div>
          </div>

          <div className="stats-grid-pro">
            <div className="stat-tile">
              <span>Total Queries</span>
              <strong>{analytics.total_queries}</strong>
            </div>
            <div className="stat-tile">
              <span>Active Users</span>
              <strong>{analytics.active_users}</strong>
            </div>
          </div>

          <div className="section-title">Query Distribution (By Role)</div>
          {(!analytics.top_queries || analytics.top_queries.length === 0) ? (
            <div className="empty-state">No query data in selected window.</div>
          ) : (
            <div style={{ display: "flex", gap: "40px", alignItems: "center", flexWrap: "wrap", padding: "20px" }}>
               {(() => {
                 const getRoleColor = (role) => {
                   const colors = {
                     "admin": "hsl(354, 85%, 60%)",           // Vibrant Rose
                     "Project Manager": "hsl(210, 100%, 55%)", // Bright Azure
                     "Team Leader": "hsl(260, 75%, 65%)",    // Soft Purple
                     "Senior Developer": "hsl(150, 80%, 45%)", // Rich Emerald
                     "Junior Developer": "hsl(185, 90%, 50%)"  // Electric Cyan
                   };
                   return colors[role] || "hsl(215, 15%, 60%)";
                 };
                 
                 const roleOrder = ["admin", "Project Manager", "Team Leader", "Senior Developer", "Junior Developer"];
                 const sortedQueries = [...(analytics.top_queries || [])].sort((a, b) => {
                    const idxA = roleOrder.indexOf(a.role);
                    const idxB = roleOrder.indexOf(b.role);
                    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
                 });
                 
                 const total = sortedQueries.reduce((a, b) => a + (b.count || 0), 0);
                 let acc = 0;

                 return (
                   <>
                     <div
                       style={{
                         width: "250px", height: "250px", borderRadius: "50%", flexShrink: 0,
                         background: `conic-gradient(${sortedQueries.map((q) => {
                            const pct = total === 0 ? 0 : ((q.count || 0) / total) * 100;
                            const start = acc;
                            acc += pct;
                            const color = getRoleColor(q.role || 'Unknown');
                            return `${color} ${start}% ${acc}%`;
                         }).join(", ")})`,
                         boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
                       }}
                     />
                     <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, maxHeight: "250px", overflowY: "auto", paddingRight: "10px" }}>
                        {sortedQueries.map((q, i) => {
                           const color = getRoleColor(q.role || 'Unknown');
                           return (
                             <div key={(q.role || 'Unknown') + i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "4px 0" }}>
                                <div style={{ 
                                  width: "14px", 
                                  height: "14px", 
                                  borderRadius: "4px", 
                                  backgroundColor: color, 
                                  flexShrink: 0,
                                  boxShadow: `0 0 10px ${color}44`,
                                  border: "1px solid rgba(255,255,255,0.1)"
                                }} />
                                <span style={{flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "14px", color: "var(--text-secondary)"}} title={q.role}>
                                  {q.role || 'Unknown Role'}
                                </span>
                                <strong style={{marginLeft: "auto", color: "var(--text)"}}>{q.count}</strong>
                             </div>
                           );
                        })}
                     </div>
                   </>
                 );
               })()}
            </div>
          )}
        </section>

        <section id="queries" className="pro-card section-bottom-margin" ref={queriesRef}>
          <div className="card-head inline-head">
             <div>
               <h3>Recent Queries</h3>
               <p>Chat History log</p>
             </div>
             <button className="danger-btn" onClick={() => setShowDeleteHistoryModal(true)}>Delete All History</button>
          </div>
          
          <div className="stack-list compact" style={{overflowX: "hidden", overflowY:"auto"}}>
             {chatHistory.length === 0 && (
                <div className="empty-state">No chat history.</div>
             )}
             {chatHistory.map(q => (
                <div key={q.id} className="fancy-row">
                   <div className="row-left" style={{flex: 1}}>
                      <div className="row-icon">❓</div>
                      <div>
                         <strong className="row-title">{q.question}</strong>
                         <p className="row-subtitle">
                            Asked by <strong>{q.username}</strong> ({q.role}) on {new Date(q.created_at + (q.created_at?.includes('Z') || q.created_at?.includes('+') ? '' : 'Z')).toLocaleString()}
                         </p>
                      </div>
                   </div>
                   <button className="danger-btn" onClick={() => deleteChatHistoryItem(q.id)}>
                      Delete
                   </button>
                </div>
             ))}
          </div>
        </section>

        <section id="audit" className="pro-card audit-card section-bottom-margin" ref={auditRef}>
          <div className="card-head">
            <div>
              <h3>Audit Logs</h3>
              <p>Latest system and user actions</p>
            </div>
            <button className="ghost-btn" onClick={loadAuditLogs}>
              Refresh Logs
            </button>
          </div>

          <div className="stack-list compact">
            {auditLogs.length === 0 && (
              <div className="empty-state">No audit events yet.</div>
            )}

            {auditLogs.map((entry) => (
              <div key={entry.id} className="audit-item">
                <div className="audit-dot" />
                <div className="audit-content">
                  <strong>
                    {entry.actor_username || "system"} • {entry.action}
                  </strong>
                  <p>
                    {entry.target_type || "system"} •{" "}
                    {new Date(entry.created_at + (entry.created_at?.includes('Z') || entry.created_at?.includes('+') ? '' : 'Z')).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="modal-overlay">
           <div className="modal-content pro-card">
              <h3>Confirm Deletion</h3>
              <p>Are you sure you want to delete the document <strong>{docToDelete.filename}</strong>?</p>
              <div className="modal-actions">
                 <button className="ghost-btn" onClick={() => setDocToDelete(null)}>Cancel</button>
                 <button className="danger-btn" onClick={confirmDeleteDocument}>Delete</button>
              </div>
           </div>
        </div>
      )}

      {/* Edit Role Context Modal */}
      {docToEdit && (
        <div className="modal-overlay">
           <div className="modal-content pro-card" style={{minWidth: '400px'}}>
              <h3>Edit Document Access</h3>
              <p>Filename: {docToEdit.filename}</p>
              <div className="role-pill-grid">
                {ROLES.map((role) => {
                  const active = editDocRoles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      className={`role-pill ${active ? "active" : ""}`}
                      onClick={() => {
                        setEditDocRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
                      }}
                    >
                      <span className="role-check">{active ? "✓" : "+"}</span>
                      {role}
                    </button>
                  );
                })}
              </div>
              <div className="modal-actions" style={{marginTop: '20px'}}>
                 <button className="ghost-btn" onClick={() => setDocToEdit(null)}>Cancel</button>
                 <button className="primary-btn" onClick={saveEditedDocRoles}>Save Changes</button>
              </div>
           </div>
        </div>
      )}

      {/* Edit User Modal */}
      {userToEdit && (
        <div className="modal-overlay">
           <div className="modal-content pro-card" style={{minWidth: '400px'}}>
              <h3>Edit User: {userToEdit.username}</h3>
              <div className="create-user-box" style={{marginTop: "20px", display: "flex", flexDirection: "column", gap: "15px"}}>
                 <select
                    value={editState.role || userToEdit.role}
                    onChange={(e) => setEditState(prev => ({ ...prev, role: e.target.value }))}
                 >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                 </select>
                 
                 <div className="password-wrap-pro">
                    <input
                      type={editState.showPass ? "text" : "password"}
                      placeholder="New password (leave blank to keep current)"
                      value={editState.password || ""}
                      onChange={(e) => setEditState(prev => ({ ...prev, password: e.target.value }))}
                    />
                    <button type="button" className="password-toggle-btn"
                       onClick={() => setEditState(prev => ({ ...prev, showPass: !prev.showPass }))}
                    >
                      {editState.showPass ? "Hide" : "Show"}
                    </button>
                 </div>
              </div>
              
              <div className="modal-actions" style={{marginTop: '25px'}}>
                 <button className="ghost-btn" onClick={() => { setUserToEdit(null); setEditState({}); }}>Cancel</button>
                 <button className="primary-btn" onClick={() => updateUser(userToEdit.id)}>Save Changes</button>
              </div>
           </div>
        </div>
      )}

      {/* Delete All History Modal */}
      {showDeleteHistoryModal && (
        <div className="modal-overlay">
           <div className="modal-content pro-card">
              <h3>Confirm Deletion</h3>
              <p>Are you sure you want to delete <strong>ALL</strong> chat history?</p>
              <div className="modal-actions">
                 <button className="ghost-btn" onClick={() => setShowDeleteHistoryModal(false)}>Cancel</button>
                 <button className="danger-btn" onClick={deleteAllChatHistory}>Delete All</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}