const BASE_TITLE = "SBI Portal";

let _current: string | null = null;

export function setTabUnreadCount(unread: number): void {
  const next = unread > 0 ? `(${unread}) ${BASE_TITLE}` : BASE_TITLE;
  if (_current === next) return;
  _current = next;
  document.title = next;
}
