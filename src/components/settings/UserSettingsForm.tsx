import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, User, Moon, Bell, Key, EyeOff, Eye } from "lucide-react";

const splitName = (fullName?: string | null) => {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
};

const UserSettingsForm = () => {
  const { user, updateProfile } = useSupabaseUser();

  const existingPrefs = ((user?.preferences || {}) as Record<string, any>);
  const initialSplit = splitName(user?.name);

  const [userData, setUserData] = useState({
    firstName: initialSplit.firstName,
    lastName: initialSplit.lastName,
    email: user?.email || "",
    phone: user?.phone || "",
    username: existingPrefs.username || "",
    profileImage: existingPrefs.profileImage || "",
    pin: existingPrefs.transactionPin || "",
    preferences: {
      darkMode: Boolean(existingPrefs.darkMode),
      anonymousContributions: Boolean(existingPrefs.anonymousContributions),
      notificationsEnabled: existingPrefs.notificationsEnabled !== false,
    },
  });

  const [confirmPin, setConfirmPin] = useState(existingPrefs.transactionPin || "");
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Change password dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    const prefs = (user.preferences || {}) as Record<string, any>;
    const { firstName, lastName } = splitName(user.name);
    setUserData({
      firstName,
      lastName,
      email: user.email || "",
      phone: user.phone || "",
      username: prefs.username || "",
      profileImage: prefs.profileImage || "",
      pin: prefs.transactionPin || "",
      preferences: {
        darkMode: Boolean(prefs.darkMode),
        anonymousContributions: Boolean(prefs.anonymousContributions),
        notificationsEnabled: prefs.notificationsEnabled !== false,
      },
    });
    setConfirmPin(prefs.transactionPin || "");
  }, [user]);

  if (!user) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "pin") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 4);
      setUserData((prev) => ({ ...prev, pin: digitsOnly }));
      return;
    }
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePreferenceChange = (preference: string, value: boolean) => {
    setUserData((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [preference]: value,
      },
    }));
  };

  const handleProfileImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast.error("Image must be smaller than 500KB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPreviewImage(result);
      setUserData((prev) => ({ ...prev, profileImage: result }));
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to update password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const currentPrefs = (user.preferences || {}) as Record<string, any>;
      const existingPin = currentPrefs.transactionPin || "";

      if (userData.pin && userData.pin !== existingPin) {
        if (!/^\d{4}$/.test(userData.pin)) {
          toast.error("Transaction PIN must be exactly 4 digits");
          return;
        }
        if (userData.pin !== confirmPin) {
          toast.error("PINs don't match");
          return;
        }
      }

      const fullName = `${userData.firstName} ${userData.lastName}`.trim();

      // IMPORTANT: Spread existingPrefs to preserve virtualAccount and other stored fields!
      const mergedPreferences = {
        ...currentPrefs,
        darkMode: userData.preferences.darkMode,
        anonymousContributions: userData.preferences.anonymousContributions,
        notificationsEnabled: userData.preferences.notificationsEnabled,
        username: userData.username.trim(),
        profileImage: userData.profileImage,
        ...(userData.pin ? { transactionPin: userData.pin } : {}),
      };

      await updateProfile({
        name: fullName || user.name,
        phone: userData.phone.trim() || null,
        preferences: mergedPreferences,
      });

      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error?.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center md:flex-row md:space-x-4 space-y-4 md:space-y-0">
                  <div className="relative">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={previewImage || userData.profileImage} />
                      <AvatarFallback className="text-lg">
                        {userData.firstName?.charAt(0)}
                        {userData.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="profile-image"
                      className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground cursor-pointer"
                    >
                      <Pencil className="h-4 w-4" />
                      <input
                        type="file"
                        id="profile-image"
                        className="hidden"
                        accept="image/*"
                        onChange={handleProfileImage}
                      />
                    </label>
                  </div>
                  <div className="flex-1 space-y-3 w-full">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="username"
                          name="username"
                          placeholder="Choose a username"
                          value={userData.username}
                          onChange={handleInputChange}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      placeholder="First Name"
                      value={userData.firstName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="Last Name"
                      value={userData.lastName}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={userData.email}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      placeholder="Phone Number"
                      value={userData.phone}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>
                  Manage your account security and 4-digit transaction PIN
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="pin">Transaction PIN</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="pin"
                      name="pin"
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      placeholder="Create a 4-digit PIN"
                      maxLength={4}
                      value={userData.pin}
                      onChange={handleInputChange}
                      className="pl-10 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-8 w-8"
                      onClick={() => setShowPin(!showPin)}
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Required to authorize bank transfers from your wallet
                  </p>
                </div>

                <div>
                  <Label htmlFor="confirm-pin">Confirm PIN</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-pin"
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      placeholder="Confirm 4-digit PIN"
                      maxLength={4}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-sm font-medium">Password</p>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-sm text-muted-foreground">Change your account password</p>
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setPasswordDialogOpen(true)}
                    >
                      Change Password
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>Customize your app experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Switch between light and dark themes
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Moon className="h-4 w-4 text-muted-foreground" />
                    <Switch
                      checked={userData.preferences.darkMode}
                      onCheckedChange={(checked) => handlePreferenceChange("darkMode", checked)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Anonymous Contributions</Label>
                    <p className="text-sm text-muted-foreground">
                      Hide your identity when making contributions
                    </p>
                  </div>
                  <Switch
                    checked={userData.preferences.anonymousContributions}
                    onCheckedChange={(checked) =>
                      handlePreferenceChange("anonymousContributions", checked)
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications about activities
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <Switch
                      checked={userData.preferences.notificationsEnabled}
                      onCheckedChange={(checked) =>
                        handlePreferenceChange("notificationsEnabled", checked)
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></span>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your new password below (minimum 8 characters).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordChange} disabled={isChangingPassword}>
              {isChangingPassword ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserSettingsForm;
