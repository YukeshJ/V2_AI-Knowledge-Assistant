import React, { useState } from "react";
import toast from "react-hot-toast";
import { documentApi } from "../../services/api";

const ROLES = [
  "admin",
  "Project Manager",
  "Team Leader",
  "Senior Developer",
  "Junior Developer",
];

export default function UploadSection({ onUploadSuccess, uploadRef }) {
  const [file, setFile] = useState(null);
  const [allowedRoles, setAllowedRoles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are allowed");
      return;
    }
    setFile(selectedFile);
    toast.success("PDF selected");
  };

  const toggleRole = (role) => {
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
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
      if (onUploadSuccess) onUploadSuccess();
    } catch {
      toast.error("Upload failed", { id: toastId });
    }
  };

  return (
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
        <button className="role-select-all-btn" onClick={() => setAllowedRoles(ROLES)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Select All
        </button>
        <button className="role-clear-btn" onClick={() => setAllowedRoles([])}>
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
  );
}
