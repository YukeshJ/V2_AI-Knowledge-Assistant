import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import StatCards from "../components/dashboard/StatCards";
import UploadSection from "../components/dashboard/UploadSection";
import DocumentList from "../components/dashboard/DocumentList";
import UserManagement from "../components/dashboard/UserManagement";
import AnalyticsSection from "../components/dashboard/AnalyticsSection";
import RecentQueries from "../components/dashboard/RecentQueries";
import AuditLogs from "../components/dashboard/AuditLogs";
import { useDashboardData } from "../hooks/useDashboardData";
import { useAuth } from "../context/AuthContext";

export default function AdminPage() {
  const {
    documents,
    users,
    analytics,
    analyticsDays,
    setAnalyticsDays,
    auditLogs,
    chatHistory,
    activeUsersLastRefreshed,
    analyticsLastRefreshed,
    now,

    refreshAll,
    loadAnalytics,
    loadAuditLogs,
    loadHistory
  } = useDashboardData();

  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);

  const uploadRef = useRef(null);
  const docsRef = useRef(null);
  const usersRef = useRef(null);
  const analyticsRef = useRef(null);
  const queriesRef = useRef(null);
  const auditRef = useRef(null);
  const dashboardRef = useRef(null);

  const refs = {
    uploadRef,
    docsRef,
    usersRef,
    analyticsRef,
    queriesRef,
    auditRef,
    dashboardRef
  };

  const scrollTo = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

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

    Object.values(refs).forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => observer.disconnect();
  }, []);

  const getGreetingData = (name) => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: `Good morning, ${name}`, icon: "🌅" };
    if (hour < 17) return { text: `Good afternoon, ${name}`, icon: "☀️" };
    if (hour < 21) return { text: `Good evening, ${name}`, icon: "🌇" };
    return { text: `Good night, ${name}`, icon: "🌙" };
  };

  const greeting = getGreetingData(user?.username || "Admin");

  return (
    <div className={`admin-shell ${sidebarOpen ? "" : "sidebar-closed"}`}>
      <Sidebar 
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeSection={activeSection}
        scrollTo={scrollTo}
        refs={refs}
        documentsCount={documents.length}
        usersCount={users.length}
      />

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
          <div className="greeting-badge">
            <span className="greeting-icon">{greeting.icon}</span>
            <span className="greeting-text">{greeting.text}</span>
          </div>
        </header>

        {sidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        <div id="dashboard" ref={dashboardRef}>
          <StatCards 
            documentsCount={documents.length}
            usersCount={users.length}
            totalQueries={analytics.total_queries}
            activeUsers={analytics.active_users}
            activeUsersLastRefreshed={activeUsersLastRefreshed}
            analyticsLastRefreshed={analyticsLastRefreshed}
            now={now}
          />

        </div>

        <UploadSection onUploadSuccess={() => refreshAll(true)} uploadRef={uploadRef} />
        
        <DocumentList documents={documents} onRefresh={() => refreshAll(true)} docsRef={docsRef} />
        
        <UserManagement users={users} onRefresh={() => refreshAll(true)} usersRef={usersRef} />
        
        <AnalyticsSection 
          analytics={analytics} 
          analyticsDays={analyticsDays} 
          setAnalyticsDays={setAnalyticsDays} 
          loadAnalytics={loadAnalytics} 
          analyticsRef={analyticsRef} 
        />
        
        <RecentQueries 
          chatHistory={chatHistory} 
          loadHistory={loadHistory} 
          loadAnalytics={loadAnalytics} 
          loadAuditLogs={loadAuditLogs} 
          queriesRef={queriesRef} 
        />
        
        <AuditLogs auditLogs={auditLogs} loadAuditLogs={loadAuditLogs} auditRef={auditRef} />
      </main>
    </div>
  );
}