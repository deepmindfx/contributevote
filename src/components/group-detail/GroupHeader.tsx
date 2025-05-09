
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import ShareContribution from "@/components/contributions/ShareContribution";
import { Contribution } from "@/services/localStorage";

interface GroupHeaderProps {
  contribution: Contribution;
}

const GroupHeader = ({ contribution }: GroupHeaderProps) => {
  const navigate = useNavigate();

  // Add a safeguard against null/undefined contribution
  if (!contribution) {
    return (
      <div className="mb-6 animate-fade-in">
        <Button 
          variant="ghost" 
          size="sm" 
          className="mb-2"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Dashboard
        </Button>
        <div>Loading contribution details...</div>
      </div>
    );
  }

  return (
    <div className="mb-6 animate-fade-in">
      <Button 
        variant="ghost" 
        size="sm" 
        className="mb-2"
        onClick={() => navigate("/dashboard")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Dashboard
      </Button>
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold">{contribution.name}</h1>
          <p className="text-muted-foreground">{contribution.description}</p>
        </div>
        
        {/* Share contribution component with null check */}
        {contribution && contribution.id && (
          <ShareContribution 
            contributionId={contribution.id} 
            contributionName={contribution.name} 
          />
        )}
      </div>
    </div>
  );
};

export default GroupHeader;
