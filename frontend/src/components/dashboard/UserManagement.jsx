import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { userApi } from "../../services/api";

const ROLES = [
  "admin",
  "Project Manager",
  "Team Leader",
  "Senior Developer",
  "Junior Developer",
];

export default function UserManagement({ users, onRefresh, usersRef }) {
  const [searchUser, setSearchUser] = useState("");
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "Junior Developer",
  });
  const [newUserShowPass, setNewUserShowPass] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [editState, setEditState] = useState({});

  const filteredUsers = useMemo(() => {
    return users.filter((u) =>
      u.username?.toLowerCase().includes(searchUser.toLowerCase())
    );
  }, [users, searchUser]);

  const createUser = async () => {
    if (!newUser.username.trim() || !newUser.password.trim()) {
      toast.error("Username and password are required");
      return;
    }
    try {
      await userApi.create(newUser);
      toast.success("User created");
      setNewUser({
        username: "",
        password: "",
        role: "Junior Developer",
      });
      onRefresh();
    } catch {
      toast.error("Failed to create user");
    }
  };

  const deleteUser = async (id) => {
    try {
      await userApi.delete(id);
      toast.success("User removed");
      onRefresh();
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const updateUser = async (id) => {
    if (!editState) return;
    try {
      await userApi.update(id, {
        role: editState.role,
        password: editState.password || undefined,
      });
      toast.success("User updated");
      setUserToEdit(null);
      setEditState({});
      onRefresh();
    } catch {
      toast.error("Failed to update user");
    }
  };

  return (
    <>
      <section id="users" className="pro-card section-bottom-margin" ref={usersRef}>
        <div className="card-head">
          <div>
            <h3>User Management</h3>
            <p>Create, update roles, and manage passwords</p>
          </div>
        </div>

        <div className="create-user-box">
          <input
            placeholder="Username"
            value={newUser.username}
            onChange={(e) =>
              setNewUser((v) => ({ ...v, username: e.target.value }))
            }
          />
          <div className="password-wrap-pro">
             <input
               placeholder="Password"
               type={newUserShowPass ? "text" : "password"}
               value={newUser.password}
               onChange={(e) =>
                 setNewUser((v) => ({ ...v, password: e.target.value }))
               }
             />
             <button type="button" className="password-toggle-btn" onClick={() => setNewUserShowPass(!newUserShowPass)}>
               {newUserShowPass ? "Hide" : "Show"}
             </button>
          </div>
          
          <select
            value={newUser.role}
            onChange={(e) =>
              setNewUser((v) => ({ ...v, role: e.target.value }))
            }
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button className="primary-btn" onClick={createUser}>
            Create User
          </button>
        </div>

        <div className="card-head inline-head">
          <h4>All Users</h4>
          <input
            className="search-input"
            placeholder="Search users..."
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
          />
        </div>

        <div className="user-list" style={{overflow: "visible"}}>
          {filteredUsers.length === 0 && (
            <div className="empty-state">No users found.</div>
          )}

          {filteredUsers.map((u) => (
            <div key={u.id} className="user-row-pro">
              <div className="user-badge">
                {u.username?.slice(0, 1)?.toUpperCase() || "U"}
              </div>

              <div className="user-main">
                <strong>{u.username}</strong>
                <span>{u.role}</span>
              </div>

              <div className="row-actions-group" style={{marginLeft: "auto"}}>
                <button
                  className="secondary-btn"
                  onClick={() => {
                      setEditState({ role: u.role, password: "", showPass: false });
                      setUserToEdit(u);
                  }}
                >
                  Edit
                </button>
                <button
                  className="danger-btn"
                  onClick={() => deleteUser(u.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Edit User Modal */}
      {userToEdit && (
        <div className="modal-overlay">
           <div className="modal-content pro-card" style={{minWidth: '400px'}}>
              <h3>Edit User: {userToEdit.username}</h3>
              <div className="create-user-box" style={{marginTop: "20px", display: "flex", flexDirection: "column", gap: "15px"}}>
                 <select
                    value={editState.role || userToEdit.role}
                    onChange={(e) => setEditState(prev => ({ ...prev, role: e.target.value }))}
                 >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                 </select>
                 
                 <div className="password-wrap-pro">
                    <input
                      type={editState.showPass ? "text" : "password"}
                      placeholder="New password (leave blank to keep current)"
                      value={editState.password || ""}
                      onChange={(e) => setEditState(prev => ({ ...prev, password: e.target.value }))}
                    />
                    <button type="button" className="password-toggle-btn"
                       onClick={() => setEditState(prev => ({ ...prev, showPass: !prev.showPass }))}
                    >
                      {editState.showPass ? "Hide" : "Show"}
                    </button>
                 </div>
              </div>
              
              <div className="modal-actions" style={{marginTop: '25px'}}>
                 <button className="ghost-btn" onClick={() => { setUserToEdit(null); setEditState({}); }}>Cancel</button>
                 <button className="primary-btn" onClick={() => updateUser(userToEdit.id)}>Save Changes</button>
              </div>
           </div>
        </div>
      )}
    </>
  );
}
