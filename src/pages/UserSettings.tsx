
import Header from "@/components/layout/Header";
import UserSettingsForm from "@/components/settings/UserSettingsForm";
import MobileNav from "@/components/layout/MobileNav";

const UserSettings = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background pb-20 md:pb-0">
      <Header />
      <div className="flex-1 container max-w-4xl mx-auto px-4 pt-24 pb-12">
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
