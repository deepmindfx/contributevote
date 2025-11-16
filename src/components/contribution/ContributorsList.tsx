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
      <Card className="p-4 md:p-6">
        <div className="space-y-3 md:space-y-4">
          <Skeleton className="h-6 md:h-8 w-32 md:w-48" />
          <Skeleton className="h-16 md:h-20 w-full" />
          <Skeleton className="h-16 md:h-20 w-full" />
          <Skeleton className="h-16 md:h-20 w-full" />
        </div>
      </Card>
    );
  }

  if (contributors.length === 0) {
    return (
      <Card className="p-4 md:p-6">
        <div className="text-center py-6 md:py-8">
          <Users className="h-10 w-10 md:h-12 md:w-12 mx-auto text-muted-foreground mb-3 md:mb-4" />
          <p className="text-sm md:text-base text-muted-foreground">No contributors yet</p>
          <p className="text-xs md:text-sm text-muted-foreground mt-2">
            Be the first to contribute to this group!
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 md:p-6">
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-base md:text-lg font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
              <span className="truncate">Contributors ({contributors.length})</span>
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Total: ₦{totalAmount.toLocaleString()}
            </p>
          </div>
          <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-600 flex-shrink-0" />
        </div>

        {/* Contributors List */}
        <div className="space-y-2 md:space-y-3">
          {contributors.map((contributor) => {
            const name = contributor.anonymous 
              ? 'Anonymous' 
              : contributor.profiles?.name || 'Unknown';
            const initials = name.substring(0, 2).toUpperCase();
            
            return (
              <div
                key={contributor.id}
                className="flex items-start sm:items-center gap-2 sm:gap-3 p-3 md:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                onClick={() => {
                  setSelectedContributor(contributor);
                  setDialogOpen(true);
                }}
              >
                <Avatar className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
                  <AvatarFallback className="text-xs md:text-sm">{initials}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm md:text-base truncate">{name}</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {contributor.contribution_count} contribution{contributor.contribution_count !== 1 ? 's' : ''}
                    </p>
                    {(contributor as any).has_voting_rights && (
                      <Badge variant="secondary" className="text-xs w-fit">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Can Vote
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <p className="font-semibold text-green-600 text-sm md:text-base whitespace-nowrap">
                    ₦{(contributor.total_contributed || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {new Date((contributor as any).joined_at).toLocaleDateString()}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 md:h-8 md:w-8 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedContributor(contributor);
                      setDialogOpen(true);
                    }}
                  >
                    <Eye className="h-3 w-3 md:h-4 md:w-4" />
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
