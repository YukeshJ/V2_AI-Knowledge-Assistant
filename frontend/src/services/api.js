import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

API.interceptors.request.use((config) => {
  const token =
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    "";
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: (username, password) =>
    API.post("/login", {
      username,
      password,
    }),
};

export const documentApi = {
  list: () => API.get("/documents"),
  getContent: (id) => API.get(`/documents/${id}/content`, { responseType: "blob" }),
  delete: (id) => API.delete(`/documents/${id}`),
  updateRoles: (id, allowed_roles) => API.put(`/documents/${id}`, { allowed_roles }),
  rebuild: () => API.post("/rebuild-index"),
  upload: (file, allowed_roles) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("allowed_roles", allowed_roles.join(","));
    return API.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export const userApi = {
  list: () => API.get("/users"),
  create: (payload) => API.post("/users", payload),
  update: (id, payload) => API.put(`/users/${id}`, payload),
  delete: (id) => API.delete(`/users/${id}`),
  pingActive: () => API.post("/users/active"),
};

export const analyticsApi = {
  get: (days = 7) => API.get(`/analytics?days=${days}`),
  getActiveUsers: () => API.get('/analytics/active-users'),
  exportCsv: (days = 7) =>
    API.get(`/analytics/export?days=${days}`, { responseType: "blob" }),
};

export const auditApi = {
  list: (limit = 80) => API.get(`/audit-logs?limit=${limit}`),
};

export const chatHistoryApi = {
  list: (limit = 50, username = "") => API.get(`/chat-history?limit=${limit}&username=${username}`),
  deleteItem: (id) => API.delete(`/chat-history/${id}`),
  deleteAll: () => API.delete(`/chat-history`),
};

export const ragApi = {
  ask: (question, top_k = 4, document_id = null, mode = "local", signal) =>
    API.post("/ask", {
      question,
      top_k,
      document_id,
      mode,
    }, { signal }),
};

export default API;