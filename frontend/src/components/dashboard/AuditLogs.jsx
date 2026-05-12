import React from "react";

export default function AuditLogs({ auditLogs, loadAuditLogs, auditRef }) {
  return (
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
  );
}
