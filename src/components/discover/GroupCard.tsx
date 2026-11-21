import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Target, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { getCategoryLabel } from '@/services/supabase/groupEnhancementService';
import CategoryIcon from '@/components/ui/CategoryIcon';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface GroupCardProps {
  group: any;
}

export default function GroupCard({ group }: GroupCardProps) {
  const navigate = useNavigate();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentAmount = Number(group.current_amount || 0);
  const targetAmount = Number(group.target_amount || 0);
  const progress =
    targetAmount > 0 ? Math.min(100, Math.max(0, (currentAmount / targetAmount) * 100)) : 0;

  const contributorCount = Array.isArray(group.contributors)
    ? group.contributors[0]?.count ?? group.contributors.length
    : 0;
  const remaining = Math.max(0, targetAmount - currentAmount);

  useEffect(() => {
    checkMembership();
  }, [group.id]);

  const checkMembership = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsMember(false);
        setLoading(false);
        return;
      }

      if (group.creator_id === user.id) {
        setIsMember(true);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('contributors')
        .select('id')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
        .maybeSingle();

      setIsMember(!!data);
    } catch (error) {
      console.error('Error checking membership:', error);
      setIsMember(false);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClick = () => {
    navigate(isMember ? `/groups/${group.id}` : `/join/${group.id}`);
  };

  const handleViewClick = () => {
    navigate(`/groups/${group.id}`);
  };

  return (
    <Card className="group flex h-full min-w-0 flex-col justify-between rounded-[1.35rem] border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-primary"
              aria-hidden="true"
            >
              <CategoryIcon category={group.category} size={20} />
            </span>
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-primary">
                {getCategoryLabel(group.category)}
              </span>
              {group.creator && (
                <p className="truncate text-xs text-muted-foreground">
                  By {group.creator.name || group.creator.email}
                </p>
              )}
            </div>
          </div>
          {progress >= 100 && (
            <Badge className="bg-accent text-accent-foreground hover:bg-accent">
              Funded
            </Badge>
          )}
        </div>

        {/* Title & Summary */}
        <div className="mt-4">
          <h3 className="line-clamp-1 text-base font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
            {group.name}
          </h3>
          {group.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {group.description}
            </p>
          )}
        </div>
      </div>

      {/* Financials & Actions */}
      <div className="mt-5 space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl font-extrabold tracking-[-0.035em] text-foreground tabular-nums">
              ₦{currentAmount.toLocaleString()}
            </span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground tabular-nums">
              {progress.toFixed(0)}%
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            of ₦{targetAmount.toLocaleString()} goal
          </p>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Users className="h-3.5 w-3.5" />
            {contributorCount} {contributorCount === 1 ? 'member' : 'members'}
          </span>
          <span className="inline-flex items-center gap-1.5 capitalize">
            <Calendar className="h-3.5 w-3.5" />
            {group.frequency || 'Flexible'}
          </span>
        </div>

        {progress < 100 && (
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Target className="h-3.5 w-3.5 text-primary" />
              Remaining
            </span>
            <span className="font-semibold text-foreground tabular-nums">
              ₦{remaining.toLocaleString()}
            </span>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {isMember ? (
            <Button className="h-11 w-full rounded-xl font-semibold" onClick={handleViewClick}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Open group
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="h-11 flex-1 rounded-xl font-semibold"
                onClick={handleViewClick}
              >
                Details
              </Button>
              <Button
                disabled={loading}
                className="h-11 flex-1 rounded-xl font-semibold"
                onClick={handleJoinClick}
              >
                Join
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
