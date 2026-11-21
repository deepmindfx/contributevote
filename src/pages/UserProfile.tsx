import { useState } from "react";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { useSupabaseContribution } from "@/contexts/SupabaseContributionContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
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
  ArrowRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const UserProfile = () => {
  const { user, unreadNotificationCount, logout } = useSupabaseUser();
  const { contributions, transactions } = useSupabaseContribution();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();

  if (!user) return null;

  const preferences = (user.preferences || {}) as Record<string, any>;
  const displayName = user.name || user.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Count groups where user is a contributor or creator
  const totalGroups = contributions.length;

  // Total amount contributed by this user across all groups
  const totalAmountContributed = transactions
    .filter(
      (t) =>
        t.user_id === user.id &&
        t.type === "contribution" &&
        t.status === "completed"
    )
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const activeGroups = contributions.filter(
    (c) =>
      !c.archived &&
      Number(c.current_amount || 0) < Number(c.target_amount || 0)
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
                    <AvatarImage src={preferences.profileImage || ""} alt={displayName} />
                    <AvatarFallback className="text-2xl">{initials || "U"}</AvatarFallback>
                  </Avatar>
                </div>
                <CardTitle>{displayName}</CardTitle>
                <CardDescription>{user.email}</CardDescription>

                <div className="mt-2 bg-primary/10 rounded-md p-3 flex items-center justify-between">
                  <span className="font-medium text-sm">Wallet Balance</span>
                  <span className="font-bold">
                    ₦{Number(user.wallet_balance || 0).toLocaleString()}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col items-center p-3 bg-muted/50 rounded-md">
                    <span className="text-lg font-bold">{totalGroups}</span>
                    <span className="text-xs text-muted-foreground">Groups</span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-muted/50 rounded-md">
                    <span className="text-lg font-bold">
                      ₦{totalAmountContributed.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">Contributed</span>
                  </div>
                </div>

                <div className="space-y-3 pt-3">
                  <div className="flex items-center space-x-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Name</p>
                      <p className="text-sm text-muted-foreground">{displayName}</p>
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
                        {user.phone || "Not set"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Joined</p>
                      <p className="text-sm text-muted-foreground">
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "Unknown"}
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
                    <p className="text-2xl font-bold">{activeGroups}</p>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Completed</h3>
                      <div className="rounded-full bg-primary/10 p-1">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{Math.max(0, totalGroups - activeGroups)}</p>
                  </div>

                  <div className="bg-muted/30 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Unread Alerts</h3>
                      <div className="rounded-full bg-primary/10 p-1">
                        <Bell className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold">{unreadNotificationCount}</p>
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
                    <p className="text-muted-foreground">
                      You haven't joined any contribution groups yet.
                    </p>
                    <Button asChild className="mt-4">
                      <Link to="/create-group">Create Your First Group</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contributions.slice(0, 3).map((group: any) => {
                      const current = Number(group.current_amount || 0);
                      const target = Number(group.target_amount || 1);
                      const pct = Math.min(100, Math.round((current / target) * 100));
                      const memberCount = Array.isArray(group.contributors)
                        ? group.contributors[0]?.count ?? group.contributors.length
                        : 0;

                      return (
                        <Link key={group.id} to={`/groups/${group.id}`} className="block">
                          <div className="flex justify-between items-center p-3 border rounded-lg hover:border-primary transition-colors">
                            <div className="flex-1 pr-4">
                              <h3 className="font-medium">{group.name}</h3>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <span className="mr-2">{memberCount} members</span>
                                <span>•</span>
                                <span className="ml-2 capitalize">{group.frequency}</span>
                              </div>
                              <div className="w-full bg-secondary h-1.5 rounded-full mt-2">
                                <div
                                  className="bg-primary h-full rounded-full"
                                  style={{ width: `${pct}%` }}
                                ></div>
                              </div>
                            </div>
                            <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </Link>
                      );
                    })}

                    {contributions.length > 3 && (
                      <Button asChild variant="outline" className="w-full mt-2">
                        <Link to="/all-groups">View All Groups</Link>
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
