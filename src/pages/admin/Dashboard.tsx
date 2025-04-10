
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Users, 
  CreditCard, 
  BarChart3, 
  Settings, 
  FileText, 
  AlertCircle, 
  Search, 
  Plus, 
  Play,
  Pause,
  ChevronRight,
  Key
} from "lucide-react";
import { User } from "@/services/localStorage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const AdminDashboard = () => {
  const { user, users, stats, isAdmin, depositToUserAsAdmin, pauseUserAsAdmin, activateUserAsAdmin } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null); 
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositOpen, setIsDepositOpen] = useState(false);

  // Redirect if not admin
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredUsers = users.filter(u => 
    u.role !== 'admin' && 
    (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
     (u.phoneNumber && u.phoneNumber.includes(searchQuery)))
  );

  const handleDeposit = () => {
    if (!selectedUserId) return;
    
    if (!depositAmount || isNaN(Number(depositAmount)) || Number(depositAmount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    
    depositToUserAsAdmin(selectedUserId, Number(depositAmount));
    setDepositAmount("");
    setIsDepositOpen(false);
  };

  const toggleUserStatus = (userId: string, status: string) => {
    if (status === 'active') {
      pauseUserAsAdmin(userId);
    } else {
      activateUserAsAdmin(userId);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 border-r bg-card">
          <div className="p-6">
            <h2 className="text-2xl font-bold">CollectiPay</h2>
            <p className="text-sm text-muted-foreground">Admin Dashboard</p>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <Link to="/admin" className="flex items-center p-2 rounded-md bg-primary/10 text-primary hover:bg-primary/15">
              <BarChart3 className="h-5 w-5 mr-3" />
              <span>Dashboard</span>
            </Link>
            <Link to="/admin/users" className="flex items-center p-2 rounded-md hover:bg-muted">
              <Users className="h-5 w-5 mr-3" />
              <span>Users</span>
            </Link>
            <Link to="/admin/contributions" className="flex items-center p-2 rounded-md hover:bg-muted">
              <CreditCard className="h-5 w-5 mr-3" />
              <span>Contributions</span>
            </Link>
            <Link to="/admin/transactions" className="flex items-center p-2 rounded-md hover:bg-muted">
              <FileText className="h-5 w-5 mr-3" />
              <span>Transactions</span>
            </Link>
            <Link to="/admin/disputes" className="flex items-center p-2 rounded-md hover:bg-muted">
              <AlertCircle className="h-5 w-5 mr-3" />
              <span>Disputes</span>
            </Link>
            <Link to="/admin/api-settings" className="flex items-center p-2 rounded-md hover:bg-muted">
              <Key className="h-5 w-5 mr-3" />
              <span>API Settings</span>
            </Link>
            <Link to="/admin/settings" className="flex items-center p-2 rounded-md hover:bg-muted">
              <Settings className="h-5 w-5 mr-3" />
              <span>Settings</span>
            </Link>
          </nav>
          <div className="p-4 border-t">
            <div className="flex items-center">
              <Avatar className="h-8 w-8 mr-2">
                <AvatarFallback>{user?.name?.charAt(0) || "A"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user?.name || "Admin"}</p>
                <p className="text-xs text-muted-foreground">{user?.email || "admin@example.com"}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" size="sm" asChild>
              <Link to="/dashboard">Switch to User View</Link>
            </Button>
          </div>
        </div>

        {/* Main content */}
        <main className="md:pl-64 flex-1">
          <div className="container max-w-6xl p-6">
            <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

            {/* Stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Users</p>
                      <h3 className="text-2xl font-bold">{stats?.totalUsers || 0}</h3>
                    </div>
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Contributions</p>
                      <h3 className="text-2xl font-bold">{stats?.totalContributions || 0}</h3>
                    </div>
                    <div className="bg-primary/10 p-2 rounded-full">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Transactions</p>
                      <h3 className="text-2xl font-bold">{stats?.totalTransactions || 0}</h3>
                    </div>
                    <div className="bg-primary/10 p-2 rounded-full">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <h3 className="text-2xl font-bold">₦{stats?.totalAmount?.toLocaleString() || 0}</h3>
                    </div>
                    <div className="bg-primary/10 p-2 rounded-full">
                      <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main content tabs */}
            <Tabs defaultValue="users">
              <TabsList className="mb-6">
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="contributions">Contributions</TabsTrigger>
                <TabsTrigger value="pending_requests">Pending Requests</TabsTrigger>
              </TabsList>

              <TabsContent value="users">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>User Management</CardTitle>
                    <div className="flex w-full max-w-sm items-center space-x-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name, email or phone..."
                          className="pl-8"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {filteredUsers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No users found.</p>
                        </div>
                      ) : (
                        filteredUsers.map((user) => (
                          <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center">
                              <Avatar className="h-10 w-10 mr-4">
                                {user.profileImage ? (
                                  <AvatarImage src={user.profileImage} alt={user.name} />
                                ) : (
                                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                )}
                              </Avatar>
                              <div>
                                <h4 className="font-medium">{user.name}</h4>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                                {user.phoneNumber && (
                                  <p className="text-xs text-muted-foreground">{user.phoneNumber}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center">
                              <Badge variant={user.status === 'active' ? 'default' : 'destructive'} className="mr-4">
                                {user.status === 'active' ? 'Active' : 'Paused'}
                              </Badge>
                              <div className="flex space-x-2">
                                <Dialog open={isDepositOpen && selectedUserId === user.id} onOpenChange={(open) => {
                                  setIsDepositOpen(open);
                                  if (open) setSelectedUserId(user.id);
                                }}>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Plus className="h-4 w-4 mr-1" />
                                      Deposit
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Deposit to {user.name}</DialogTitle>
                                      <DialogDescription>
                                        Enter the amount you want to deposit to this user's wallet.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="deposit-amount">Amount</Label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-2.5 text-muted-foreground">₦</span>
                                          <Input
                                            id="deposit-amount"
                                            type="number"
                                            className="pl-8"
                                            placeholder="0.00"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => setIsDepositOpen(false)}>Cancel</Button>
                                      <Button onClick={handleDeposit}>Deposit</Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                
                                <Button
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => toggleUserStatus(user.id, user.status)}
                                >
                                  {user.status === 'active' ? (
                                    <Pause className="h-4 w-4 mr-1" />
                                  ) : (
                                    <Play className="h-4 w-4 mr-1" />
                                  )}
                                  {user.status === 'active' ? 'Pause' : 'Activate'}
                                </Button>
                                
                                <Button variant="ghost" size="sm" asChild>
                                  <Link to={`/admin/users/${user.id}`}>
                                    <ChevronRight className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contributions">
                <Card>
                  <CardHeader>
                    <CardTitle>Contributions Management</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Contribution management features coming soon.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pending_requests">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Withdrawal Requests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <p>There are currently {stats?.activeRequests || 0} pending withdrawal requests.</p>
                      <p className="mt-2">Detailed view coming soon.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
