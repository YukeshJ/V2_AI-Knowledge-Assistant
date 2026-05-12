import React, { useState } from "react";
import toast from "react-hot-toast";
import { chatHistoryApi } from "../../services/api";

export default function RecentQueries({ chatHistory, loadHistory, loadAnalytics, loadAuditLogs, queriesRef }) {
  const [showDeleteHistoryModal, setShowDeleteHistoryModal] = useState(false);

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

  return (
    <>
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
    </>
  );
}
