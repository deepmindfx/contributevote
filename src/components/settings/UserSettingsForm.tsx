
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { toast } from "sonner";
import { Pencil, User, Moon, Bell, Key, EyeOff, Eye } from "lucide-react";

const UserSettingsForm = () => {
  const { user, updateProfile } = useSupabaseUser();
  
  const [userData, setUserData] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || '',
    phoneNumber: user.phoneNumber || '',
    username: user.username || '',
    profileImage: user.profileImage || '',
    pin: user.pin || '',
    preferences: {
      darkMode: user.preferences?.darkMode || false,
      anonymousContributions: user.preferences?.anonymousContributions || false,
      notificationsEnabled: user.preferences?.notificationsEnabled || true,
    },
  });
  
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Update form when user data changes
  useEffect(() => {
    setUserData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      username: user.username || '',
      profileImage: user.profileImage || '',
      pin: user.pin || '',
      preferences: {
        darkMode: user.preferences?.darkMode || false,
        anonymousContributions: user.preferences?.anonymousContributions || false,
        notificationsEnabled: user.preferences?.notificationsEnabled || true,
      },
    });
  }, [user]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData(prev => ({ ...prev, [name]: value }));
  };
  
  const handlePreferenceChange = (preference: string, value: boolean) => {
    setUserData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [preference]: value
      }
    }));
  };
  
  const handleProfileImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In a real app, we would upload this to a server
      // For now, we'll just use a data URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreviewImage(result);
        setUserData(prev => ({ ...prev, profileImage: result }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Validate PIN if it was changed
      if (userData.pin && userData.pin !== user.pin) {
        if (userData.pin.length < 4) {
          toast.error("PIN must be at least 4 digits");
          setIsLoading(false);
          return;
        }
        
        if (userData.pin !== confirmPin) {
          toast.error("PINs don't match");
          setIsLoading(false);
          return;
        }
      }
      
      // Prepare data for update
      const updateData = {
        ...userData,
        name: `${userData.firstName} ${userData.lastName}`,
      };
      
      console.log('Updating profile with data:', updateData);
      
      // Update profile
      await updateProfile(updateData);
      toast.success("Profile updated successfully");
      
      // Show specific messages for preference changes
      if (userData.preferences.darkMode !== user.preferences?.darkMode) {
        toast.info(userData.preferences.darkMode ? "Dark mode enabled" : "Dark mode disabled");
      }
      if (userData.preferences.anonymousContributions !== user.preferences?.anonymousContributions) {
        toast.info(userData.preferences.anonymousContributions ? "Anonymous contributions enabled" : "Anonymous contributions disabled");
      }
      if (userData.preferences.notificationsEnabled !== user.preferences?.notificationsEnabled) {
        toast.info(userData.preferences.notificationsEnabled ? "Notifications enabled" : "Notifications disabled");
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error("Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
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
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center md:flex-row md:space-x-4 space-y-4 md:space-y-0">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={previewImage || userData.profileImage} />
                    <AvatarFallback className="text-lg">
                      {userData.firstName?.charAt(0)}{userData.lastName?.charAt(0)}
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
                <div className="flex-1 space-y-3">
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
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    placeholder="Email" 
                    value={userData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input 
                    id="phoneNumber" 
                    name="phoneNumber" 
                    placeholder="Phone Number" 
                    value={userData.phoneNumber}
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
                Manage your account security and transaction PIN
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
                    placeholder="Create a 4-digit PIN" 
                    maxLength={4}
                    value={userData.pin}
                    onChange={handleInputChange}
                    className="pl-10"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    className="absolute right-2 top-2"
                    onClick={() => setShowPin(!showPin)}
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  You'll need this PIN for withdrawal requests
                </p>
              </div>
              
              <div>
                <Label htmlFor="confirm-pin">Confirm PIN</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="confirm-pin" 
                    type={showPin ? "text" : "password"} 
                    placeholder="Confirm PIN" 
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="pt-2">
                <p className="text-sm font-medium">Password</p>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-muted-foreground">Change your account password</p>
                  <Button variant="outline" type="button">
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
              <CardDescription>
                Customize your app experience
              </CardDescription>
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
                    onCheckedChange={(checked) => handlePreferenceChange('darkMode', checked)}
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
                  onCheckedChange={(checked) => handlePreferenceChange('anonymousContributions', checked)}
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
                    onCheckedChange={(checked) => handlePreferenceChange('notificationsEnabled', checked)}
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
          ) : "Save Changes"}
        </Button>
      </div>
    </form>
  );
};

export default UserSettingsForm;
