import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Users, Calendar, Target, CheckCircle } from 'lucide-react';
import { getCategoryIcon, getCategoryLabel } from '@/services/supabase/groupEnhancementService';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface GroupCardProps {
  group: any;
}

export default function GroupCard({ group }: GroupCardProps) {
  const navigate = useNavigate();
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const progress = group.target_amount > 0 
    ? Math.min(100, (group.current_amount / group.target_amount) * 100)
    : 0;

  const contributorCount = Array.isArray(group.contributors)
    ? (group.contributors[0]?.count ?? group.contributors.length)
    : 0;
  const remaining = Math.max(0, group.target_amount - (group.current_amount || 0));

  useEffect(() => {
    checkMembership();
  }, [group.id]);

  const checkMembership = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsMember(false);
        setLoading(false);
        return;
      }

      // Check if user is a contributor or creator
      const isCreator = group.creator_id === user.id;
      
      if (isCreator) {
        setIsMember(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
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
    if (isMember) {
      navigate(`/groups/${group.id}`);
    } else {
      navigate(`/join/${group.id}`);
    }
  };

  const handleViewClick = () => {
    navigate(`/groups/${group.id}`);
  };

  return (
    <Card className="group flex h-full min-w-0 flex-col rounded-2xl shadow-sm transition-colors hover:border-primary/40">
      <CardHeader className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-xl" aria-hidden="true">{getCategoryIcon(group.category)}</span>
            <Badge variant="secondary" className="text-xs">
              {getCategoryLabel(group.category)}
            </Badge>
          </div>
          {progress >= 100 && (
            <Badge variant="secondary">Completed</Badge>
          )}
        </div>
        
        <div>
          <h3 className="font-bold text-lg line-clamp-1 group-hover:text-primary transition-colors">
            {group.name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {group.description}
          </p>
          {group.creator && (
            <p className="text-xs text-muted-foreground mt-1">
              By {group.creator.name || group.creator.email}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4 px-4 sm:px-5">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold">{progress.toFixed(1)}%</span>
          </div>
          <Progress aria-label="Funding progress" value={progress} className="h-2" />
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">
              ₦{(group.current_amount || 0).toLocaleString()}
            </span>
            <span className="text-muted-foreground">
              of ₦{group.target_amount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {contributorCount} {contributorCount === 1 ? 'member' : 'members'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground capitalize">
              {group.frequency}
            </span>
          </div>
        </div>

        {/* Remaining */}
        {progress < 100 && (
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm">
              <span className="font-semibold">₦{remaining.toLocaleString()}</span>
              <span className="text-muted-foreground"> remaining</span>
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5 sm:pb-5">
        {isMember ? (
          <Button className="h-11 flex-1 gap-2 rounded-xl" onClick={handleViewClick}>
            <CheckCircle size={16} aria-hidden="true" /> View my group
          </Button>
        ) : (
          <>
            <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={handleViewClick}>View details</Button>
            <Button disabled={loading} className="h-11 flex-1 rounded-xl" onClick={handleJoinClick}>Join group</Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
