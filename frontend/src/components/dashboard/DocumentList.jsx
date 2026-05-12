import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { documentApi } from "../../services/api";

const ROLES = [
  "admin",
  "Project Manager",
  "Team Leader",
  "Senior Developer",
  "Junior Developer",
];

export default function DocumentList({ documents, onRefresh, docsRef }) {
  const [searchDoc, setSearchDoc] = useState("");
  const [docToDelete, setDocToDelete] = useState(null);
  const [docToEdit, setDocToEdit] = useState(null);
  const [editDocRoles, setEditDocRoles] = useState([]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) =>
      doc.filename?.toLowerCase().includes(searchDoc.toLowerCase())
    );
  }, [documents, searchDoc]);

  const confirmDeleteDocument = async () => {
    if (!docToDelete) return;
    try {
      await documentApi.delete(docToDelete.id);
      toast.success("Document deleted");
      setDocToDelete(null);
      onRefresh();
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
      onRefresh();
    } catch {
      toast.error("Failed to update document roles");
    }
  };

  return (
    <>
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
    </>
  );
}
