
import { useState } from "react";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { useApp } from "@/contexts/AppContext";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Wallet, 
  User, 
  Mail, 
  Phone, 
  Bell, 
  Calendar, 
  Settings, 
  LogOut,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";

const UserProfile = () => {
  const { user, contributions, transactions, logout } = useApp();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      logout();
      setIsLoggingOut(false);
    }, 500);
  };

  // Calculate statistics - count only user's contributions
  const totalContributions = contributions.filter(c => c.contributors.some(contrib => contrib.userId === user.id)).length;
  
  // Calculate total amount contributed by this user across all groups
  const totalAmountContributed = transactions
    .filter(t => 
      t.userId === user.id && 
      t.type === 'contribution' && 
      t.status === 'completed'
    )
    .reduce((sum, t) => sum + t.amount, 0);
    
  const activeContributions = contributions.filter(c => 
    c.currentAmount < c.targetAmount && 
    c.contributors.some(contrib => contrib.userId === user.id)
  ).length;

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header />
      
      <main className="container max-w-4xl mx-auto px-4 pt-24 pb-12">
        <h1 className="text-2xl font-bold mb-6">My Profile</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="glass-card">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={user.profileImage || ""} alt={user.name} />
                    <AvatarFallback className="text-2xl">
                      {user.firstName?.charAt(0)}{user.lastName?.charAt(0) || ""}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <CardTitle>{user.name}</CardTitle>
                <CardDescription>{user.email}</CardDescription>
                
                <div className="mt-2 bg-primary/10 rounded-md p-3 flex items-center justify-between">
                  <span className="font-medium text-sm">Wallet Balance</span>
                  <span className="font-bold">₦{user.walletBalance?.toLocaleString() || 0}</span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center p-3 bg-muted/50 rounded-md">
                    <span className="text-lg font-bold">{totalContributions}</span>
                    <span className="text-xs text-muted-foreground">Groups</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-muted/50 rounded-md">
                    <span className="text-lg font-bold">₦{totalAmountContributed.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">Contributed</span>
                  </div>
                </div>
                
                <div className="space-y-3 pt-3">
                  <div className="flex items-center space-x-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Name</p>
                      <p className="text-sm text-muted-foreground">
                        {user.firstName} {user.lastName}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-sm text-muted-foreground">
                        {user.phoneNumber || "Not set"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Joined</p>
                      <p className="text-sm text-muted-foreground">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="flex flex-col space-y-2">
                <Button asChild variant="outline" className="w-full">
                  <Link to="/settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    Account Settings
                  </Link>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full text-destructive hover:text-destructive"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-t-2 border-b-2 border-current rounded-full"></div>
                      Logging out...
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="lg:col-span-2">
            <Card className="glass-card mb-6">
              <CardHeader>
                <CardTitle>My Contribution Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Active Groups</h3>
                      <div className="rounded-full bg-primary/10 p-1">
                        <Wallet className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{activeContributions}</p>
                  </div>
                  
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Completed</h3>
                      <div className="rounded-full bg-primary/10 p-1">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{totalContributions - activeContributions}</p>
                  </div>
                  
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Notifications</h3>
                      <div className="rounded-full bg-primary/10 p-1">
                        <Bell className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{user.notifications?.filter(n => !n.read).length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>My Recent Groups</CardTitle>
              </CardHeader>
              <CardContent>
                {contributions.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">You haven't joined any contribution groups yet.</p>
                    <Button asChild className="mt-4">
                      <Link to="/create-group">Create Your First Group</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contributions.slice(0, 3).map((group) => (
                      <Link key={group.id} to={`/groups/${group.id}`}>
                        <div className="flex justify-between items-center p-3 border rounded-lg hover:border-primary transition-colors">
                          <div>
                            <h3 className="font-medium">{group.name}</h3>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <span className="mr-2">{group.members.length} members</span>
                              <span>•</span>
                              <span className="ml-2 capitalize">{group.frequency}</span>
                            </div>
                            <div className="w-full bg-secondary h-1.5 rounded-full mt-2">
                              <div 
                                className="bg-primary h-full rounded-full"
                                style={{ width: `${Math.min(100, Math.round((group.currentAmount / group.targetAmount) * 100))}%` }}
                              ></div>
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                    
                    {contributions.length > 3 && (
                      <Button asChild variant="outline" className="w-full mt-2">
                        <Link to="/dashboard">View All Groups</Link>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <MobileNav />
    </div>
  );
};

export default UserProfile;
