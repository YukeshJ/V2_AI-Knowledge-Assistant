import RoleChatShell from "../components/RoleChatShell";

export default function TLChatPage() {
  return (
    <RoleChatShell
      roleName="Team Leader"
      roleKey="TL"
      welcomeTitle="Team Leader Workspace"
      welcomeText="Hello Team Leader! Use this workspace to review team documents, technical notes, delivery guidance, and project updates from your allowed documents."
    />
  );
}