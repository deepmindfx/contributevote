import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowUpDown, Check, CreditCard, DollarSign, Search, Users, X, RefreshCw } from "lucide-react";
import { useSupabaseUser } from "@/contexts/SupabaseUserContext";
import { ContributionService } from "@/services/supabase/contributionService";
import { TransactionService } from "@/services/supabase/transactionService";
import Header from "@/components/layout/Header";
import { format, isValid } from "date-fns";
import { toast } from "sonner";

const AdminDashboard = () => {
  const { users, refreshUserData, depositToUserAsAdmin, pauseUserAsAdmin, activateUserAsAdmin } = useSupabaseUser();
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loadingPlatformData, setLoadingPlatformData] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const navigate = useNavigate();

  const loadPlatformData = async () => {
    setLoadingPlatformData(true);
    try {
      const [groupsData, txData] = await Promise.all([
        ContributionService.getContributionGroups(),
        TransactionService.getTransactions(),
        refreshUserData(),
      ]);
      setAllGroups(groupsData || []);
      setAllTransactions(txData || []);
    } catch (error) {
      console.error("Error loading admin platform data:", error);
      toast.error("Failed to load platform data");
    } finally {
      setLoadingPlatformData(false);
    }
  };

  useEffect(() => {
    loadPlatformData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const displayedUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.phone?.toLowerCase().includes(query)
    );
  }, [users, searchTerm]);

  const totalContributed = useMemo(
    () => allGroups.reduce((sum, g) => sum + Number(g.current_amount || 0), 0),
    [allGroups]
  );

  const safeFormatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return isValid(d) ? format(d, "MMM d, yyyy") : "N/A";
  };

  const handleDeposit = async () => {
    if (!selectedUser) return;

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    setIsDepositing(true);
    try {
      await depositToUserAsAdmin(selectedUser.id, amount);
      toast.success(`Credited ₦${amount.toLocaleString()} to ${selectedUser.name || selectedUser.email}`);
      setDepositAmount("");
      setSelectedUser(null);
      setDepositDialogOpen(false);
      await loadPlatformData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to credit user wallet");
    } finally {
      setIsDepositing(false);
    }
  };

  const handleToggleUserStatus = async (targetUser: any) => {
    try {
      if (targetUser.status === "paused") {
        await activateUserAsAdmin(targetUser.id);
        toast.success(`${targetUser.name || targetUser.email} activated`);
      } else {
        await pauseUserAsAdmin(targetUser.id);
        toast.success(`${targetUser.name || targetUser.email} paused`);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update user status");
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container max-w-7xl mx-auto px-4 pt-24 pb-12">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <Button variant="outline" size="sm" onClick={loadPlatformData} disabled={loadingPlatformData}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingPlatformData ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Users className="h-8 w-8 text-primary mr-3" />
                <span className="text-3xl font-bold">{users.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Groups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-primary mr-3" />
                <span className="text-3xl font-bold">{allGroups.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Group Funds</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-primary mr-3" />
                <span className="text-3xl font-bold">₦{totalContributed.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="contributions">Groups</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage user accounts, credit wallets, and control account status.
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
                        {displayedUsers.map((u) => (
                          <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/20">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>{u.name?.charAt(0) || u.email?.charAt(0) || "U"}</AvatarFallback>
                                </Avatar>
                                <span>{u.name || "Unnamed"}</span>
                              </div>
                            </td>
                            <td className="p-3">{u.email}</td>
                            <td className="p-3">{u.phone || "Not Set"}</td>
                            <td className="p-3">₦{Number(u.wallet_balance || 0).toLocaleString()}</td>
                            <td className="p-3">
                              <Badge variant={u.status === "paused" ? "destructive" : "outline"}>
                                {u.status || "active"}
                              </Badge>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setDepositAmount("");
                                    setDepositDialogOpen(true);
                                  }}
                                >
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  Deposit
                                </Button>

                                <Button
                                  variant={u.status === "paused" ? "default" : "destructive"}
                                  size="sm"
                                  onClick={() => handleToggleUserStatus(u)}
                                >
                                  {u.status === "paused" ? (
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
                <CardDescription>Overview of all contribution groups on the platform.</CardDescription>
              </CardHeader>
              <CardContent>
                {allGroups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allGroups.map((group) => {
                      const current = Number(group.current_amount || 0);
                      const target = Number(group.target_amount || 1);
                      const pct = Math.min(100, Math.round((current / target) * 100));
                      const desc = group.description || "No description";
                      const memberCount = Array.isArray(group.contributors) ? group.contributors.length : 0;

                      return (
                        <Card key={group.id} className="overflow-hidden">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">{group.name}</CardTitle>
                            <CardDescription>
                              {desc.substring(0, 100)}
                              {desc.length > 100 ? "..." : ""}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Progress</span>
                                <span className="text-sm font-medium">{pct}%</span>
                              </div>
                              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${pct}%` }}></div>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>₦{current.toLocaleString()}</span>
                                <span>₦{target.toLocaleString()}</span>
                              </div>
                              <div className="pt-2 flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">
                                  {memberCount} {memberCount === 1 ? "member" : "members"}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/groups/${group.id}`)}
                                >
                                  View Details
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
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
                <CardDescription>View recent financial activities on the platform.</CardDescription>
              </CardHeader>
              <CardContent>
                {allTransactions.length > 0 ? (
                  <div className="space-y-4">
                    {allTransactions.slice(0, 25).map((tx) => {
                      const isCredit = tx.type === "deposit" || tx.type === "refund";
                      const desc = tx.description || tx.type;
                      return (
                        <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                isCredit
                                  ? "bg-green-100 text-green-600"
                                  : tx.type === "withdrawal" || tx.type === "transfer"
                                  ? "bg-amber-100 text-amber-600"
                                  : "bg-blue-100 text-blue-600"
                              }`}
                            >
                              {isCredit ? (
                                <ArrowUpDown className="h-5 w-5" />
                              ) : tx.type === "withdrawal" || tx.type === "transfer" ? (
                                <CreditCard className="h-5 w-5" />
                              ) : (
                                <DollarSign className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium capitalize">{tx.type}</p>
                              <p className="text-sm text-muted-foreground">
                                {desc.substring(0, 50)}
                                {desc.length > 50 ? "..." : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${isCredit ? "text-green-600" : ""}`}>
                              {tx.type === "vote" ? "" : isCredit ? "+" : "-"}₦
                              {Number(tx.amount || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {safeFormatDate(tx.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
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

      <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deposit to User Account</DialogTitle>
            <DialogDescription>
              Add funds to {selectedUser?.name || selectedUser?.email}'s wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-deposit-amount">Amount (₦)</Label>
              <Input
                id="admin-deposit-amount"
                type="number"
                placeholder="Enter amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDepositDialogOpen(false);
                setSelectedUser(null);
                setDepositAmount("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleDeposit} disabled={isDepositing}>
              {isDepositing ? "Crediting..." : "Deposit Funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
