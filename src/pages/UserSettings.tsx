
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, User, Bell, Moon, Eye, Shield } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { updateUser } from "@/services/localStorage";

const profileFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  phoneNumber: z.string().optional(),
  profileImage: z.string().optional(),
});

const notificationsFormSchema = z.object({
  notificationsEnabled: z.boolean().default(true),
});

const appearanceFormSchema = z.object({
  darkMode: z.boolean().default(false),
});

const privacyFormSchema = z.object({
  anonymousContributions: z.boolean().default(false),
});

const UserSettings = () => {
  const { user, refreshData } = useApp();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  
  // Profile form
  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user.name || "",
      email: user.email || "",
      phoneNumber: user.phoneNumber || "",
      profileImage: user.profileImage || "",
    },
  });
  
  // Notifications form
  const notificationsForm = useForm<z.infer<typeof notificationsFormSchema>>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
      notificationsEnabled: user.preferences?.notificationsEnabled ?? true,
    },
  });
  
  // Appearance form
  const appearanceForm = useForm<z.infer<typeof appearanceFormSchema>>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues: {
      darkMode: user.preferences?.darkMode ?? false,
    },
  });
  
  // Privacy form
  const privacyForm = useForm<z.infer<typeof privacyFormSchema>>({
    resolver: zodResolver(privacyFormSchema),
    defaultValues: {
      anonymousContributions: user.preferences?.anonymousContributions ?? false,
    },
  });
  
  // Profile submission
  const onSubmitProfile = (data: z.infer<typeof profileFormSchema>) => {
    try {
      updateUser({
        name: data.name,
        email: data.email,
        phoneNumber: data.phoneNumber,
        profileImage: data.profileImage,
      });
      refreshData();
      toast({
        title: "Profile updated",
        description: "Your profile information has been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    }
  };
  
  // Notifications submission
  const onSubmitNotifications = (data: z.infer<typeof notificationsFormSchema>) => {
    try {
      updateUser({
        preferences: {
          ...user.preferences,
          notificationsEnabled: data.notificationsEnabled,
        },
      });
      refreshData();
      toast({
        title: "Notification settings updated",
        description: "Your notification preferences have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update notification settings.",
        variant: "destructive",
      });
    }
  };
  
  // Appearance submission
  const onSubmitAppearance = (data: z.infer<typeof appearanceFormSchema>) => {
    try {
      updateUser({
        preferences: {
          ...user.preferences,
          darkMode: data.darkMode,
        },
      });
      refreshData();
      toast({
        title: "Appearance settings updated",
        description: "Your appearance preferences have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update appearance settings.",
        variant: "destructive",
      });
    }
  };
  
  // Privacy submission
  const onSubmitPrivacy = (data: z.infer<typeof privacyFormSchema>) => {
    try {
      updateUser({
        preferences: {
          ...user.preferences,
          anonymousContributions: data.anonymousContributions,
        },
      });
      refreshData();
      toast({
        title: "Privacy settings updated",
        description: "Your privacy preferences have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update privacy settings.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-3xl mx-auto px-4 pt-24 pb-12">
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
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground">Manage your profile and account preferences</p>
        </div>
        
        <Card className="glass-card">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 mb-6">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  Manage your personal information and account details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onSubmitProfile)} className="space-y-6">
                    <div className="flex flex-col items-center space-y-4 mb-6">
                      <Avatar className="w-20 h-20">
                        <AvatarImage src={profileForm.watch("profileImage")} alt={user.name} />
                        <AvatarFallback className="text-lg">
                          {user.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <FormField
                        control={profileForm.control}
                        name="profileImage"
                        render={({ field }) => (
                          <FormItem className="w-full">
                            <FormLabel>Profile Image URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://example.com/image.jpg" {...field} />
                            </FormControl>
                            <FormDescription>
                              Enter a URL for your profile image.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Separator />
                    
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Your email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={profileForm.control}
                      name="phoneNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Your phone number" {...field} />
                          </FormControl>
                          <FormDescription>
                            This will be used for verification and recovery.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" className="w-full">
                      Save Profile
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </TabsContent>
            
            <TabsContent value="notifications">
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  Configure how and when you receive notifications.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...notificationsForm}>
                  <form onSubmit={notificationsForm.handleSubmit(onSubmitNotifications)} className="space-y-6">
                    <FormField
                      control={notificationsForm.control}
                      name="notificationsEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Notifications</FormLabel>
                            <FormDescription>
                              Receive alerts about contribution updates and activities.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" className="w-full">
                      Save Notification Settings
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </TabsContent>
            
            <TabsContent value="appearance">
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize how the app looks for you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...appearanceForm}>
                  <form onSubmit={appearanceForm.handleSubmit(onSubmitAppearance)} className="space-y-6">
                    <FormField
                      control={appearanceForm.control}
                      name="darkMode"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Dark Mode</FormLabel>
                            <FormDescription>
                              Use dark theme for the application.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" className="w-full">
                      Save Appearance Settings
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </TabsContent>
            
            <TabsContent value="privacy">
              <CardHeader>
                <CardTitle>Privacy</CardTitle>
                <CardDescription>
                  Control your privacy settings and contribution visibility.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...privacyForm}>
                  <form onSubmit={privacyForm.handleSubmit(onSubmitPrivacy)} className="space-y-6">
                    <FormField
                      control={privacyForm.control}
                      name="anonymousContributions"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Anonymous Contributions</FormLabel>
                            <FormDescription>
                              Hide your identity when contributing to groups.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <Button type="submit" className="w-full">
                      Save Privacy Settings
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </main>
      
      <MobileNav />
    </div>
  );
};

export default UserSettings;
