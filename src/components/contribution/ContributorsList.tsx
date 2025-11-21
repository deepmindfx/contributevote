
import { useEffect, useState, useMemo } from 'react';
import { ContributorService } from '@/services/supabase/contributorService';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Search, 
  TrendingUp, 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  Wallet, 
  Landmark 
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ContributionHistoryDialog } from './ContributionHistoryDialog';
import { cn } from '@/lib/utils';

interface ContributorsListProps {
  groupId: string;
}

export function ContributorsList({ groupId }: ContributorsListProps) {
  const [contributors, setContributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContributor, setSelectedContributor] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('Group');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadContributors(true);
    
    const interval = setInterval(() => {
      loadContributors(false);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [groupId]);

  const loadContributors = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true);
      else setRefreshing(true);

      const data = await ContributorService.getGroupContributors(groupId);
      setContributors(data);
      
      // Fetch group name on initial load only
      if (isInitialLoad) {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: groupData } = await supabase
          .from('contribution_groups')
          .select('name')
          .eq('id', groupId)
          .single();
        
        if (groupData) {
          setGroupName(groupData.name);
        }
      }
    } catch (error) {
      console.error('Error loading contributors:', error);
    } finally {
      if (isInitialLoad) setLoading(false);
      else setRefreshing(false);
    }
  };

  const filteredContributors = useMemo(() => {
    if (!searchQuery) return contributors;
    const lowerQuery = searchQuery.toLowerCase();
    return contributors.filter(c => {
      const name = c.metadata?.senderName || c.profiles?.name || 'Anonymous';
      return name.toLowerCase().includes(lowerQuery);
    });
  }, [contributors, searchQuery]);

  const totalAmount = useMemo(() => {
    return contributors.reduce((sum, c) => sum + (c.total_contributed || 0), 0);
  }, [contributors]);

  if (loading) {
    return (
      <Card className="border-none shadow-sm bg-white/50 dark:bg-black/20 backdrop-blur-sm">
        <CardHeader>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card overflow-hidden border border-border/50 shadow-md transition-all duration-300 hover:shadow-lg">
      <CardHeader className="pb-4 border-b border-border/5 bg-muted/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Users className="h-5 w-5 text-primary" />
              </div>
              Contributors
              <Badge variant="secondary" className="ml-2 font-normal">
                {contributors.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span>Total Raised:</span>
              <span className="font-semibold text-foreground">₦{totalAmount.toLocaleString()}</span>
              {refreshing && <span className="text-xs animate-pulse ml-2 text-primary">Updating...</span>}
            </div>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search contributors..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50 border-border/50 focus:bg-background transition-all"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filteredContributors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">No contributors found</h3>
            <p className="text-muted-foreground text-sm max-w-xs mt-1">
              {searchQuery ? "Try adjusting your search terms." : "Be the first to contribute to this group!"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredContributors.map((contributor) => {
              const isBankTransfer = contributor.join_method === 'bank_transfer';
              const senderName = contributor.metadata?.senderName;
              const name = isBankTransfer && senderName
                ? senderName
                : contributor.anonymous 
                  ? 'Anonymous' 
                  : contributor.profiles?.name || 'Unknown';
              const initials = name.substring(0, 2).toUpperCase();
              const hasVotingRights = (contributor as any).has_voting_rights;

              return (
                <div
                  key={contributor.id}
                  className="group flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer relative overflow-hidden"
                  onClick={() => {
                    setSelectedContributor(contributor);
                    setDialogOpen(true);
                  }}
                >
                  {/* Hover Highlight Line */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar className="h-10 w-10 border border-border/50 shadow-sm">
                      <AvatarImage src={contributor.profiles?.avatar_url} />
                      <AvatarFallback className="bg-primary/5 text-primary font-medium text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate text-foreground">
                          {name}
                        </p>
                        {hasVotingRights && (
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" fill="currentColor" fillOpacity={0.2} />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {isBankTransfer ? <Landmark className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
                          {contributor.contribution_count} contribution{contributor.contribution_count !== 1 ? 's' : ''}
                        </span>
                        {isBankTransfer && !hasVotingRights && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px] border-amber-500/30 text-amber-600 bg-amber-50 dark:bg-amber-900/10">
                            <Clock className="h-2.5 w-2.5 mr-1" /> Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-sm text-foreground">
                        ₦{(contributor.total_contributed || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date((contributor as any).joined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0"
                    >
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {selectedContributor && (
        <ContributionHistoryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          contributorId={selectedContributor.id}
          contributorName={
            selectedContributor.join_method === 'bank_transfer' && selectedContributor.metadata?.senderName
              ? selectedContributor.metadata.senderName
              : selectedContributor.anonymous
                ? 'Anonymous'
                : selectedContributor.profiles?.name || 'Unknown'
          }
          groupId={groupId}
          groupName={groupName}
        />
      )}
    </Card>
  );
}
