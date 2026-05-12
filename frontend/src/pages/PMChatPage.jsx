import RoleChatShell from "../components/RoleChatShell";

export default function PMChatPage() {
  return (
    <RoleChatShell
      roleName="Project Manager"
      roleKey="PM"
      welcomeTitle="Project Manager Intelligence Hub"
      welcomeText="Welcome to the Project Manager's Intelligence Hub. Access project data, monitor team documents, and leverage AI insights to drive delivery excellence."
    />
  );
}