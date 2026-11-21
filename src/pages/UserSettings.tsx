
import Header from "@/components/layout/Header";
import UserSettingsForm from "@/components/settings/UserSettingsForm";

const UserSettings = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 app-page max-w-4xl">
        <div className="space-y-6">
          <div>
            <h1 className="app-page-title">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account preferences and personal information
            </p>
          </div>
          
          <UserSettingsForm />
        </div>
      </div>
    </div>
  );
};

export default UserSettings;
