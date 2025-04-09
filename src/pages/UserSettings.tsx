
import Header from "@/components/layout/Header";
import UserSettingsForm from "@/components/settings/UserSettingsForm";
import MobileNav from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const UserSettings = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex flex-col bg-background pb-20 md:pb-0">
      <Header />
      <div className="flex-1 container max-w-4xl mx-auto px-4 pt-24 pb-12">
        <Button 
          variant="ghost" 
          size="sm" 
          className="mb-4 md:hidden"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Account Settings</h1>
            <p className="text-muted-foreground">
              Manage your account preferences and personal information
            </p>
          </div>
          
          <UserSettingsForm />
        </div>
      </div>
      <MobileNav />
    </div>
  );
};

export default UserSettings;
