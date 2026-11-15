export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotificationOptions {
  type: NotificationType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export interface ActiveNotification extends NotificationOptions {
  id: string;
  createdAt: number;
}
