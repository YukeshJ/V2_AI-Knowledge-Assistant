import RoleChatShell from "../components/RoleChatShell";

export default function SDChatPage() {
  return (
    <RoleChatShell
      roleName="Senior Developer"
      roleKey="SD"
      welcomeTitle="Senior Developer Workspace"
      welcomeText="Hello Senior Developer! Ask technical questions, implementation details, architecture topics, and document-specific explanations here."
    />
  );
}