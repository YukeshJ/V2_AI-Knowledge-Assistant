import React from "react";
import toast from "react-hot-toast";
import { analyticsApi } from "../../services/api";

export default function AnalyticsSection({ analytics, analyticsDays, setAnalyticsDays, loadAnalytics, analyticsRef }) {
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

  const getRoleColor = (role) => {
    const colors = {
      "admin": "hsl(354, 85%, 60%)",
      "Project Manager": "hsl(210, 100%, 55%)",
      "Team Leader": "hsl(260, 75%, 65%)",
      "Senior Developer": "hsl(150, 80%, 45%)",
      "Junior Developer": "hsl(185, 90%, 50%)"
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
        </div>
      )}
    </section>
  );
}
