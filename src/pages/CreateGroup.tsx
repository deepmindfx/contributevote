
import Header from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import GroupForm from "@/components/create-group/GroupForm";

const CreateGroup = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="app-page max-w-3xl">
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
          <h1 className="app-page-title">Create a group</h1>
          <p className="mt-1 text-muted-foreground">Choose a goal, contribution schedule, and privacy settings.</p>
        </div>
        
        <GroupForm />
      </main>
    </div>
  );
};

export default CreateGroup;
