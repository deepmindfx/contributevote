import { supabase } from '@/integrations/supabase/client';

export function notificationCategory(type: string) {
  if (["wallet_deposit", "transfer_completed", "transfer_failed", "wallet_debit", "wallet_credit", "refund_completed"].includes(type)) return "wallet";
  if (["bank_transfer_received", "group_payment_received", "contribution_verified"].includes(type)) return "group";
  return "activity";
}

export function notificationAllowed(type: string, preferences: unknown) {
  const category = notificationCategory(type);
  const prefs = (preferences || {}) as Record<string, unknown>;
  const key = category === "wallet" ? "walletNotifications" : category === "group" ? "groupNotifications" : "notificationsEnabled";
  return prefs[key] !== false && prefs[key] !== "false";
}

export function paymentVibrationEnabled(preferences: unknown) {
  const value = (preferences as { paymentVibration?: unknown } | null)?.paymentVibration;
  return value !== false && value !== "false";
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

export const NotificationService = {
  async getUserNotifications(userId: string, limit = 100): Promise<NotificationRecord[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return (data as unknown as NotificationRecord[]) || [];
  },

  async markAsRead(notificationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
    return true;
  },

  async markAllAsRead(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
    return true;
  },
};
