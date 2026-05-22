// The conv detail UI is rendered by <DetailPane /> mounted in
// app/dashboard/messages/layout.tsx — it reads the active conversationId
// straight from useParams(), so this page never mounts a fresh tree on
// nav. Keeping the file as a no-op so the dynamic route still matches.
export default function ConversationPage() {
  return null;
}
