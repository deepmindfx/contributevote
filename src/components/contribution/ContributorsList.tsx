import { useEffect, useState } from 'react';
import { ContributorService } from '@/services/supabase/contributorService';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Users, TrendingUp, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ContributionHistoryDialog } from './ContributionHistoryDialog';
import { Button } from '@/components/ui/button';

interface ContributorsListProps {
  groupId: string;
}

export function ContributorsList({ groupId }: ContributorsListProps) {
  const [contributors, setContributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);
  const [selectedContributor, setSelectedContributor] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadContributors();
  }, [groupId]);

  const loadContributors = async () => {
    try {
      setLoading(true);
      const data = await ContributorService.getGroupContributors(groupId);
      setContributors(data);
      
      // Calculate total
      const total = data.reduce((sum: number, c: any) => 
        sum + (c.total_contributed || 0), 0
      );
      setTotalAmount(total);
    } catch (error) {
      console.error('Error loading contributors:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Card>
    );
  }

  if (contributors.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No contributors yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Be the first to contribute to this group!
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contributors ({contributors.length})
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Total contributed: ₦{totalAmount.toLocaleString()}
            </p>
          </div>
          <TrendingUp className="h-5 w-5 text-green-600" />
        </div>

        {/* Contributors List */}
        <div className="space-y-3">
          {contributors.map((contributor) => {
            const name = contributor.anonymous 
              ? 'Anonymous' 
              : contributor.profiles?.name || 'Unknown';
            const initials = name.substring(0, 2).toUpperCase();
            
            return (
              <div
                key={contributor.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                onClick={() => {
                  setSelectedContributor(contributor);
                  setDialogOpen(true);
                }}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <p className="font-medium">{name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground">
                        {contributor.contribution_count} contribution{contributor.contribution_count !== 1 ? 's' : ''}
                      </p>
                      {(contributor as any).has_voting_rights && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Can Vote
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      ₦{(contributor.total_contributed || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date((contributor as any).joined_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedContributor(contributor);
                      setDialogOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Contribution History Dialog */}
      {selectedContributor && (
        <ContributionHistoryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          contributorId={selectedContributor.id}
          contributorName={
            selectedContributor.anonymous
              ? 'Anonymous'
              : selectedContributor.profiles?.name || 'Unknown'
          }
          groupId={groupId}
        />
      )}
    </Card>
  );
}
