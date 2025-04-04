
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, ArrowRight, Check, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";

interface GroupItemProps {
  id: string;
  name: string;
  members: number;
  amountRaised: number;
  targetAmount: number;
  type: string;
  isNew?: boolean;
}

const GroupItem = ({ id, name, members, amountRaised, targetAmount, type, isNew }: GroupItemProps) => {
  const progressPercentage = Math.min(100, Math.round((amountRaised / targetAmount) * 100));

  return (
    <Link to={`/groups/${id}`}>
      <div className="p-4 rounded-lg border hover:border-primary/50 transition-all duration-300 cursor-pointer group relative">
        {isNew && (
          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
            New
          </div>
        )}
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Users size={20} />
            </div>
            <div className="ml-3">
              <h3 className="font-medium text-base group-hover:text-primary transition-colors">{name}</h3>
              <p className="text-xs text-muted-foreground">{members} members • {type}</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-1 duration-300" />
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-medium">₦{amountRaised.toLocaleString()}</span>
            <span className="text-muted-foreground">₦{targetAmount.toLocaleString()}</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <p className="text-xs text-right mt-1 text-muted-foreground">{progressPercentage}% Funded</p>
        </div>
      </div>
    </Link>
  );
};

const GroupsList = () => {
  const { contributions } = useApp();
  
  // Get 24 hours ago timestamp to mark recently added groups
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  return (
    <Card className="glass-card animate-slide-up animation-delay-200">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">My Groups</CardTitle>
          <Link to="/groups" className="text-sm text-primary hover:underline">View all</Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {contributions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>You haven't created or joined any contribution groups yet.</p>
            <Link to="/create-group" className="text-primary hover:underline mt-2 inline-block">
              Create your first group
            </Link>
          </div>
        ) : (
          contributions.map((group) => {
            const isNew = new Date(group.createdAt) > twentyFourHoursAgo;
            return (
              <GroupItem 
                key={group.id}
                id={group.id}
                name={group.name}
                members={group.members.length}
                amountRaised={group.currentAmount}
                targetAmount={group.targetAmount}
                type={group.frequency.charAt(0).toUpperCase() + group.frequency.slice(1)}
                isNew={isNew}
              />
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default GroupsList;
