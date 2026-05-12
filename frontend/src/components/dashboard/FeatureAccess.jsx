import React from "react";

export default function FeatureAccess({ scrollTo, refs }) {
  const features = [
    { id: "upload", title: "Upload Documents", icon: "⬆", desc: "Add new PDF knowledge", ref: refs.uploadRef },
    { id: "documents", title: "Document List", icon: "📄", desc: "Manage current database", ref: refs.docsRef },
    { id: "analytics", title: "Analytics", icon: "📊", desc: "Usage & query trends", ref: refs.analyticsRef },
    { id: "users", title: "User Monitoring", icon: "👥", desc: "Oversee platform users", ref: refs.usersRef },
    { id: "queries", title: "Recent Queries", icon: "❓", desc: "History of interactions", ref: refs.queriesRef },
    { id: "audit", title: "Audit Logs", icon: "📋", desc: "System activity logs", ref: refs.auditRef },
  ];


  return (
    <div className="pro-card" style={{ padding: "30px" }}>
      <div className="card-head">
        <div>
          <h3>Feature Access Panel</h3>
          <p>Quick navigation to all operational modules</p>
        </div>
      </div>

      <div className="stats-grid-pro" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px", marginTop: "20px" }}>
        {features.map((f) => (
          <div 
            key={f.id} 
            className="hero-stat-card glow-blue" 
            style={{ cursor: "pointer", transition: "0.3s" }}
            onClick={() => f.ref ? scrollTo(f.ref) : (f.path && (window.location.href = f.path))}
          >
            <div className="hero-stat-icon" style={{ fontSize: "28px" }}>{f.icon}</div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: "0 0 4px", fontSize: "18px" }}>{f.title}</h4>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>{f.desc}</p>
            </div>
            <div style={{ fontSize: "20px", opacity: 0.5 }}>→</div>
          </div>
        ))}
      </div>
    </div>
  );
}
