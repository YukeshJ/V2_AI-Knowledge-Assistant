import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { analyticsApi, auditApi, documentApi, userApi, chatHistoryApi, authApi } from "../services/api";

export function useDashboardData(analyticsDaysInitial = 7) {
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState({
    total_queries: 0,
    active_users: 0,
    top_queries: [],
    trend: [],
    window_days: analyticsDaysInitial,
  });
  const [analyticsDays, setAnalyticsDays] = useState(analyticsDaysInitial);
  const [auditLogs, setAuditLogs] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [activeUsersLastRefreshed, setActiveUsersLastRefreshed] = useState(new Date());
  const [analyticsLastRefreshed, setAnalyticsLastRefreshed] = useState(new Date());
  const [now, setNow] = useState(new Date());


  const loadAll = async () => {
    try {
      const [docRes, userRes] = await Promise.all([
        documentApi.list(),
        userApi.list(),
      ]);
      setDocuments(docRes.data || []);
      setUsers(userRes.data || []);
    } catch (err) {
      console.error("Failed to load users/docs", err);
    }
  };

  const loadAnalytics = async () => {
    try {
      const analyticsRes = await analyticsApi.get(analyticsDays);
      setAnalytics(prev => ({ ...prev, ...analyticsRes.data }));
      setAnalyticsLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to load analytics", err);
    }
  };


  const loadActiveUsers = async () => {
    try {
      const res = await analyticsApi.getActiveUsers();
      setAnalytics(prev => ({ ...prev, active_users: res.data.active_users }));
      setActiveUsersLastRefreshed(new Date());
    } catch (err) {}
  };

  const loadAuditLogs = async () => {
    try {
      const res = await auditApi.list(80);
      setAuditLogs(res.data || []);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await chatHistoryApi.list(50);
      setChatHistory(res.data || []);
    } catch (err) {
      console.error("Failed to load history", err);
    }
  };

  const refreshAll = async (silent = false) => {
    let toastId;
    if (!silent) toastId = toast.loading("Refreshing dashboard data...");
    try {
      await Promise.all([
        loadAll(),
        loadAnalytics(),
        loadAuditLogs(),
        loadHistory(),
        loadActiveUsers(),
      ]);
      if (!silent) toast.success("Data refreshed", { id: toastId });
    } catch {
      if (!silent) toast.error("Failed to refresh some data", { id: toastId });
    }
  };

  useEffect(() => {
    refreshAll(true);
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [analyticsDays]);

  useEffect(() => {
    const heartbeat = setInterval(() => {
      authApi.updateActiveStatus().catch(() => {});
    }, 30000);
    return () => clearInterval(heartbeat);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadAnalytics();
      loadHistory();
    }, 30000); // 30 seconds for analytics/total queries
    return () => clearInterval(interval);
  }, [analyticsDays]);


  useEffect(() => {
    const activeUsersInterval = setInterval(loadActiveUsers, 15000);
    return () => clearInterval(activeUsersInterval);
  }, []);

  return {
    documents, setDocuments,
    users, setUsers,
    analytics, setAnalytics,
    analyticsDays, setAnalyticsDays,
    auditLogs, setAuditLogs,
    chatHistory, setChatHistory,
    activeUsersLastRefreshed,
    analyticsLastRefreshed,
    now,
    refreshAll,
    loadAll,
    loadAnalytics,
    loadActiveUsers,
    loadAuditLogs,
    loadHistory
  };
}

