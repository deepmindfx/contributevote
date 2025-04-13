
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowUpDown, Check, CreditCard, DollarSign, Search, Users, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import Header from "@/components/layout/Header";
import { format } from "date-fns";

const AdminDashboard = () => {
  const { users, contributions, transactions, stats, updateUserAsAdmin, depositToUserAsAdmin, pauseUserAsAdmin, activateUserAsAdmin } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [displayedUsers, setDisplayedUsers] = useState(users);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Filter users based on search term
    const filtered = users.filter(user => 
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Apply sorting if configured
    let sortedUsers = [...filtered];
    if (sortConfig !== null) {
      sortedUsers.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    
    setDisplayedUsers(sortedUsers);
  }, [users, searchTerm, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleDeposit = () => {
    if (!selectedUser) return;
    
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    
    depositToUserAsAdmin(selectedUser.id, amount);
    setDepositAmount("");
    setSelectedUser(null);
  };

  const handleToggleUserStatus = (user: any) => {
    if (user.status === "paused") {
      activateUserAsAdmin(user.id);
    } else {
      pauseUserAsAdmin(user.id);
    }
  };

  const renderUserTable = () => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-secondary/40">
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Balance</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedUsers.map((user) => (
              <tr key={user.id} className="border-b border-border/50 hover:bg-secondary/20">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {user.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span>{user.name}</span>
                  </div>
                </td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">{user.phoneNumber || "Not Set"}</td>
                <td className="p-3">₦{user.walletBalance?.toLocaleString() || "0"}</td>
                <td className="p-3">
                  <Badge variant={user.status === "active" ? "outline" : "destructive"}>
                    {user.status || "Active"}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedUser(user)}>
                          <DollarSign className="h-4 w-4 mr-1" />
                          Deposit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Deposit to User Account</DialogTitle>
                          <DialogDescription>
                            Add funds to {selectedUser?.name}'s wallet.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="deposit-amount">Amount (₦)</Label>
                            <Input
                              id="deposit-amount"
                              type="number"
                              placeholder="Enter amount"
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => {
                            setSelectedUser(null);
                            setDepositAmount("");
                          }}>
                            Cancel
                          </Button>
                          <Button onClick={handleDeposit}>
                            Deposit Funds
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <Button
                      variant={user.status === "paused" ? "default" : "destructive"}
                      size="sm"
                      onClick={() => handleToggleUserStatus(user)}
                    >
                      {user.status === "paused" ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Activate
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          Pause
                        </>
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderContributionStats = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contributions.map((contribution) => (
          <Card key={contribution.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{contribution.name}</CardTitle>
              <CardDescription>{contribution.description.substring(0, 100)}...</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Progress</span>
                  <span className="text-sm font-medium">
                    {Math.round((contribution.currentAmount / contribution.targetAmount) * 100)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.min(
                        (contribution.currentAmount / contribution.targetAmount) * 100,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm">
                  <span>₦{contribution.currentAmount.toLocaleString()}</span>
                  <span>₦{contribution.targetAmount.toLocaleString()}</span>
                </div>
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {contribution.members.length} members
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/groups/${contribution.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderTransactionHistory = () => {
    return (
      <div className="space-y-4">
        {transactions.slice(0, 10).map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center justify-between p-3 border rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                transaction.type === 'deposit'
                  ? 'bg-green-100 text-green-600'
                  : transaction.type === 'withdrawal'
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-blue-100 text-blue-600'
              }`}>
                {transaction.type === 'deposit' ? (
                  <ArrowUpDown className="h-5 w-5" />
                ) : transaction.type === 'withdrawal' ? (
                  <CreditCard className="h-5 w-5" />
                ) : (
                  <DollarSign className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {transaction.description.substring(0, 30)}
                  {transaction.description.length > 30 ? '...' : ''}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-semibold ${
                transaction.type === 'deposit' ? 'text-green-600' : ''
              }`}>
                {transaction.type === 'deposit' ? '+' : '-'}₦
                {transaction.amount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(transaction.createdAt), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container max-w-7xl mx-auto px-4 pt-24 pb-12">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Users className="h-8 w-8 text-primary mr-3" />
                <span className="text-3xl font-bold">{stats.totalUsers || users.length}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Contributions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-primary mr-3" />
                <span className="text-3xl font-bold">{stats.totalContributions || contributions.length}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-primary mr-3" />
                <span className="text-3xl font-bold">₦{(stats.totalAmountContributed || 0).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="contributions">Contributions</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage user accounts, deposit funds, and control access.
                </CardDescription>
                <div className="mt-4 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name, email or phone..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {displayedUsers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-secondary/40">
                          <th className="text-left p-3">Name</th>
                          <th className="text-left p-3">Email</th>
                          <th className="text-left p-3">Phone</th>
                          <th className="text-left p-3">Balance</th>
                          <th className="text-left p-3">Status</th>
                          <th className="text-right p-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedUsers.map((user) => (
                          <tr key={user.id} className="border-b border-border/50 hover:bg-secondary/20">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {user.name?.charAt(0) || "U"}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{user.name}</span>
                              </div>
                            </td>
                            <td className="p-3">{user.email}</td>
                            <td className="p-3">{user.phoneNumber || "Not Set"}</td>
                            <td className="p-3">₦{user.walletBalance?.toLocaleString() || "0"}</td>
                            <td className="p-3">
                              <Badge variant={user.status === "active" ? "outline" : "destructive"}>
                                {user.status || "Active"}
                              </Badge>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" onClick={() => setSelectedUser(user)}>
                                      <DollarSign className="h-4 w-4 mr-1" />
                                      Deposit
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Deposit to User Account</DialogTitle>
                                      <DialogDescription>
                                        Add funds to {selectedUser?.name}'s wallet.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="deposit-amount">Amount (₦)</Label>
                                        <Input
                                          id="deposit-amount"
                                          type="number"
                                          placeholder="Enter amount"
                                          value={depositAmount}
                                          onChange={(e) => setDepositAmount(e.target.value)}
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => {
                                        setSelectedUser(null);
                                        setDepositAmount("");
                                      }}>
                                        Cancel
                                      </Button>
                                      <Button onClick={handleDeposit}>
                                        Deposit Funds
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                
                                <Button
                                  variant={user.status === "paused" ? "default" : "destructive"}
                                  size="sm"
                                  onClick={() => handleToggleUserStatus(user)}
                                >
                                  {user.status === "paused" ? (
                                    <>
                                      <Check className="h-4 w-4 mr-1" />
                                      Activate
                                    </>
                                  ) : (
                                    <>
                                      <X className="h-4 w-4 mr-1" />
                                      Pause
                                    </>
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No users found matching your search.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="contributions">
            <Card>
              <CardHeader>
                <CardTitle>Contribution Groups</CardTitle>
                <CardDescription>
                  Overview of all contribution groups on the platform.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contributions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contributions.map((contribution) => (
                      <Card key={contribution.id} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{contribution.name}</CardTitle>
                          <CardDescription>{contribution.description.substring(0, 100)}...</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Progress</span>
                              <span className="text-sm font-medium">
                                {Math.round((contribution.currentAmount / contribution.targetAmount) * 100)}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{
                                  width: `${Math.min(
                                    (contribution.currentAmount / contribution.targetAmount) * 100,
                                    100
                                  )}%`,
                                }}
                              ></div>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>₦{contribution.currentAmount.toLocaleString()}</span>
                              <span>₦{contribution.targetAmount.toLocaleString()}</span>
                            </div>
                            <div className="pt-2 flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                {contribution.members.length} members
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/groups/${contribution.id}`)}
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No contribution groups found.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>
                  View recent financial activities on the platform.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length > 0 ? (
                  <div className="space-y-4">
                    {transactions.slice(0, 10).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            transaction.type === 'deposit'
                              ? 'bg-green-100 text-green-600'
                              : transaction.type === 'withdrawal'
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {transaction.type === 'deposit' ? (
                              <ArrowUpDown className="h-5 w-5" />
                            ) : transaction.type === 'withdrawal' ? (
                              <CreditCard className="h-5 w-5" />
                            ) : (
                              <DollarSign className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {transaction.description.substring(0, 30)}
                              {transaction.description.length > 30 ? '...' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            transaction.type === 'deposit' ? 'text-green-600' : ''
                          }`}>
                            {transaction.type === 'deposit' ? '+' : '-'}₦
                            {transaction.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(transaction.createdAt), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No transactions found.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
