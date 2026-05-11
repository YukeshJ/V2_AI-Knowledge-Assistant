import RoleChatShell from "../components/RoleChatShell";

export default function PMChatPage() {
  return (
    <RoleChatShell
      roleName="Project Manager"
      roleKey="PM"
      welcomeTitle="Project Manager Workspace"
      welcomeText="Hello Project Manager! Ask about project documents, plans, timelines, deliverables, and summaries from your accessible files."
    />
  );
}