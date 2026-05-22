type PermissionState = "default" | "granted" | "denied";

export function getNotificationPermission(): PermissionState {
  if (typeof Notification === "undefined") return "denied";
  return Notification.permission as PermissionState;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (typeof Notification === "undefined") return "denied";
  try {
    const result = await Notification.requestPermission();
    return result as PermissionState;
  } catch {
    return "denied";
  }
}

export function notifyNewMessage(opts: {
  title: string;
  body: string;
  convId: string;
  href: string;
}): void {
  if (getNotificationPermission() !== "granted") return;
  try {
    const notification = new Notification(opts.title, {
      body: opts.body,
      icon: "/icon.png",
      tag: `msg:${opts.convId}`,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
      window.location.href = opts.href;
    };
  } catch {
    // Safari and some environments restrict Notification construction.
  }
}
