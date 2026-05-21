// The messages detail (header + thread, or the empty-state placeholder) is
// rendered by <DetailPane /> mounted in layout.tsx so that conv-to-conv
// navigation never tears down/rebuilds the right-pane tree. This page is
// just the route marker.
export default function MessagesPage() {
  return null;
}
