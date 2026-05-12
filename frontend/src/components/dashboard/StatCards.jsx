import React from "react";

export default function StatCards({ 
  documentsCount, 
  usersCount, 
  totalQueries, 
  activeUsers, 
  activeUsersLastRefreshed, 
  analyticsLastRefreshed,
  now 
}) {
  const activeUsersCountdown = Math.max(0, 15 - Math.floor((now - activeUsersLastRefreshed) / 1000));
  const queriesCountdown = Math.max(0, 30 - Math.floor((now - analyticsLastRefreshed) / 1000));

  return (
    <section className="hero-stats">
      <div className="hero-stat-card glow-blue">
        <div className="hero-stat-icon">📄</div>
        <div>
          <p>Total Documents</p>
          <h3>{documentsCount}</h3>
        </div>
      </div>

      <div className="hero-stat-card glow-cyan">
        <div className="hero-stat-icon">👥</div>
        <div>
          <p>Total Users</p>
          <h3>{usersCount}</h3>
        </div>
      </div>

      <div className="hero-stat-card glow-violet">
        <div className="hero-stat-icon">💬</div>
        <div>
          <p>Total Queries</p>
          <h3>{totalQueries}</h3>
          <p className="refresh-time">
            Refreshing in {queriesCountdown}s
          </p>
        </div>
      </div>

      <div className="hero-stat-card glow-emerald">
        <div className="hero-stat-icon">⚡</div>
        <div>
          <p>Active Users</p>
          <h3>{activeUsers}</h3>
          <p className="refresh-time">
            Refreshing in {activeUsersCountdown}s
          </p>
        </div>
      </div>
    </section>
  );
}
