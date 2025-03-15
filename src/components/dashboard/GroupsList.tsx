
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface GroupItemProps {
  name: string;
  members: number;
  amountRaised: number;
  targetAmount: number;
  type: string;
  to: string;
}

const GroupItem = ({ name, members, amountRaised, targetAmount, type, to }: GroupItemProps) => {
  const progressPercentage = Math.min(100, Math.round((amountRaised / targetAmount) * 100));

  return (
    <Link to={to}>
      <div className="p-4 rounded-lg border hover:border-primary/50 transition-all duration-300 cursor-pointer group">
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
  const groups = [
    {
      name: "Wedding Fund",
      members: 24,
      amountRaised: 750000,
      targetAmount: 1500000,
      type: "Monthly",
      to: "/groups/1"
    },
    {
      name: "Business Launch",
      members: 12,
      amountRaised: 345000,
      targetAmount: 500000,
      type: "Weekly",
      to: "/groups/2"
    },
    {
      name: "Family Vacation",
      members: 5,
      amountRaised: 120000,
      targetAmount: 350000,
      type: "Monthly",
      to: "/groups/3"
    }
  ];

  return (
    <Card className="glass-card animate-slide-up animation-delay-200">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">My Groups</CardTitle>
          <Link to="/groups" className="text-sm text-primary hover:underline">View all</Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.map((group, index) => (
          <GroupItem key={index} {...group} />
        ))}
      </CardContent>
    </Card>
  );
};

export default GroupsList;
