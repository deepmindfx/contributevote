import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Wallet, XCircle, CheckCircle2, Clock, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type ActivityType = 'withdrawal' | 'refund';

interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  amount?: number;
  status: string;
  actor?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface GroupActivityTimelineProps {
  groupId: string;
}

export function GroupActivityTimeline({ groupId }: GroupActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [groupId]);

  const loadActivities = async () => {
    try {
      setLoading(true);

      const [{ data: withdrawals }, { data: refunds }] = await Promise.all([
        supabase
          .from('withdrawal_requests')
          .select('id, amount, purpose, status, created_at, updated_at, requester:profiles(name)')
          .eq('contribution_id', groupId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('group_refund_requests')
          .select('id, reason, refund_type, partial_percentage, status, created_at, executed_at, requester:profiles(name)')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
          .limit(30)
      ]);

      const withdrawalEvents: ActivityEvent[] = (withdrawals || []).map(item => ({
        id: `withdrawal-${item.id}`,
        type: 'withdrawal',
        title: `Withdrawal of ₦${Number(item.amount).toLocaleString()}`,
        description: item.purpose || 'No description provided',
        amount: item.amount,
        status: item.status,
        actor: item.requester?.name || 'Group Admin',
        createdAt: item.created_at,
        metadata: {
          updatedAt: item.updated_at
        }
      }));

      const refundEvents: ActivityEvent[] = (refunds || []).map(item => ({
        id: `refund-${item.id}`,
        type: 'refund',
        title: item.refund_type === 'partial'
          ? `Partial Refund (${item.partial_percentage}%)`
          : 'Full Group Refund',
        description: item.reason,
        status: item.status,
        actor: item.requester?.name || 'Group Admin',
        createdAt: item.created_at,
        metadata: {
          partialPercentage: item.partial_percentage,
          executedAt: item.executed_at
        }
      }));

      const combined = [...withdrawalEvents, ...refundEvents].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setActivities(combined);
    } catch (error) {
      console.error('Error loading group activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-amber-50 text-amber-700">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Approved</Badge>;
      case 'executed':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Completed</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
      case 'expired':
        return <Badge variant="outline">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getIcon = (type: ActivityType, status: string) => {
    if (type === 'withdrawal') {
      if (status === 'approved' || status === 'executed') {
        return <Wallet className="h-4 w-4 text-blue-500" />;
      }
      if (status === 'rejected') {
        return <XCircle className="h-4 w-4 text-red-500" />;
      }
      return <Clock className="h-4 w-4 text-amber-500" />;
    }

    if (status === 'executed') {
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }
    if (status === 'rejected') {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return <RefreshCw className="h-4 w-4 text-purple-500" />;
  };

  if (loading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Group Activity</CardTitle>
          <CardDescription>Tracking withdrawals and refunds</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Recent Group Activity
          </CardTitle>
          <CardDescription>Withdrawals and refunds appear here</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-10 text-muted-foreground">
          No group activities yet. Once withdrawals or refunds are processed, you'll see them here.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          Recent Group Activity
        </CardTitle>
        <CardDescription>Withdrawals, refunds, and governance decisions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                {getIcon(activity.type, activity.status)}
              </div>
              <div className="w-px h-full bg-border/70 mt-2 last:hidden" />
            </div>

            <div className="flex-1 space-y-2 pb-4 border-b last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-sm text-foreground">{activity.title}</p>
                {getStatusBadge(activity.status)}
                {activity.type === 'refund' && activity.metadata?.partialPercentage && (
                  <Badge variant="outline" className="text-xs">
                    {activity.metadata.partialPercentage}% of contributions
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{activity.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>
                  By <span className="font-medium text-foreground">{activity.actor || 'System'}</span>
                </span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

