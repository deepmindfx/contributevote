
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EyeOff } from "lucide-react";
import { format, isValid } from "date-fns";

interface ContributorsListProps {
  contributors: Array<{
    userId?: string;
    name?: string;
    amount: number;
    date?: string;
    anonymous?: boolean;
  }>;
}

const ContributorsList = ({ contributors }: ContributorsListProps) => {
  // Function to get contributor name
  const getContributorName = (contributor: any) => {
    return contributor.name || "Unknown User";
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown date";
    
    try {
      const date = new Date(dateString);
      if (!isValid(date)) {
        return "Invalid date";
      }
      return format(date, 'MMMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return "Invalid date";
    }
  };

  return (
    <Card className="glass-card animate-slide-up">
      <CardHeader>
        <CardTitle>Contributors</CardTitle>
        <CardDescription>People who have contributed to this group</CardDescription>
      </CardHeader>
      <CardContent>
        {contributors && contributors.length > 0 ? (
          <div className="space-y-4">
            {contributors.map((contributor, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center">
                  {contributor.anonymous ? (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <EyeOff size={16} />
                    </div>
                  ) : (
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>
                        {getContributorName(contributor).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="ml-3">
                    <p className="font-medium text-sm">
                      {contributor.anonymous ? 'Anonymous Contributor' : getContributorName(contributor)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(contributor.date)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">
                    ₦{contributor.amount.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No contributors yet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContributorsList;
