import { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);

function getStoredUser() {
  try {
    const raw = sessionStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());

  const login = (data) => {
    const authUser = {
      username: data.username,
      role: data.role,
    };

    if (data.access_token) {
      sessionStorage.setItem("token", data.access_token);
    }

    sessionStorage.setItem("user", JSON.stringify(authUser));
    setUser(authUser);
  };

  const logout = () => {
    sessionStorage.clear();
    setUser(null);
    window.location.href = "/";
  };

  const value = useMemo(() => ({ user, login, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}