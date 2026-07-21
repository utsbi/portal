export interface NotificationPrefs {
  messages: boolean;
  calendar: boolean;
  requests: boolean;
  reports: boolean;
  weeklyDigest: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  messages: true,
  calendar: true,
  requests: true,
  reports: true,
  weeklyDigest: false,
};

export const DEPARTMENTS = [
  "Engineering",
  "Architecture",
  "Tech",
  "Business",
  "PR",
  "Legal",
  "Research",
] as const;

export type Department = (typeof DEPARTMENTS)[number];
