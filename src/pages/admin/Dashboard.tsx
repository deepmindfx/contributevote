import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Edit, Copy, UserPlus, User, Pause, Play, DollarSign } from "lucide-react";
import { useApp } from '@/contexts/AppContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  role: z.enum(['user', 'admin']).default('user'),
})

const AdminDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    email: '',
    name: '',
    role: 'user',
  });
  
  const { 
    users, 
    updateUserAsAdmin, 
    depositToUserAsAdmin, 
    pauseUserAsAdmin, 
    activateUserAsAdmin,
    createUser,
    getUserByEmail,
    refreshData
  } = useApp();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      name: "",
      role: "user",
    },
  })
  
  const handleUserClick = (user) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };
  
  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setSelectedUser(null);
  };
  
  const handleInputChange = (e) => {
    setAddUserForm({
      ...addUserForm,
      [e.target.name]: e.target.value,
    });
  };
  
  const resetAddUserForm = () => {
    setAddUserForm({
      email: '',
      name: '',
      role: 'user',
    });
  };
  
  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy');
  };
  
  const handleDeposit = (userId: string, amount: number) => {
    depositToUserAsAdmin(userId, amount);
  };
  
  const handlePause = (userId: string) => {
    pauseUserAsAdmin(userId);
  };
  
  const handleActivate = (userId: string) => {
    activateUserAsAdmin(userId);
  };

  const handleUserRoleChange = (userId: string, newRole: string) => {
    try {
      // Ensure the role is either 'user' or 'admin'
      const validRole = newRole === 'admin' ? 'admin' : 'user';
      updateUserAsAdmin(userId, { role: validRole });
      refreshData();
      toast.success(`User role updated to ${validRole}`);
    } catch (error) {
      toast.error("Failed to update user role");
      console.error(error);
    }
  };

  const handleCreateUser = (userData: any) => {
    try {
      // Validate form data
      if (!userData.email || !userData.name) {
        toast.error("Email and name are required");
        return;
      }
      
      // Check if user with email already exists
      const existingUser = getUserByEmail(userData.email);
      if (existingUser) {
        toast.error("A user with this email already exists");
        return;
      }
      
      // Create new user with proper role type
      const validRole = userData.role === 'admin' ? 'admin' : 'user';
      const newUserData = {
        ...userData,
        role: validRole,
        verified: true,  // Admin-created users are verified by default
        status: 'active',
        walletBalance: 0,
        createdAt: new Date().toISOString()
      };
      
      createUser(newUserData);
      refreshData();
      setIsAddUserDialogOpen(false);
      resetAddUserForm();
      toast.success("User created successfully");
    } catch (error) {
      toast.error("Failed to create user");
      console.error(error);
    }
  };
  
  const onSubmit = (data) => {
    handleCreateUser(data);
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
        <Button onClick={() => setIsAddUserDialogOpen(true)} className="bg-green-500 text-white hover:bg-green-700">
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>
      
      <Input
        type="text"
        placeholder="Search users..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-4"
      />
      
      <Table>
        <TableCaption>A list of all registered users.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Wallet Balance</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.name}</TableCell>
              <TableCell>
                <Select value={user.role} onValueChange={(value) => handleUserRoleChange(user.id, value)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder={user.role} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>₦{user.walletBalance?.toLocaleString()}</TableCell>
              <TableCell className="font-medium">{user.status}</TableCell>
              <TableCell>{formatDate(user.createdAt)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleUserClick(user)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    navigator.clipboard.writeText(user.id);
                    toast.success("User ID copied to clipboard!");
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  {user.status === 'active' ? (
                    <Button variant="ghost" size="icon" onClick={() => handlePause(user.id)}>
                      <Pause className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" onClick={() => handleActivate(user.id)}>
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Make changes to the selected user. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input id="email" value={selectedUser.email} className="col-span-3" disabled />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input id="name" defaultValue={selectedUser.name} className="col-span-3" onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">
                  Role
                </Label>
                <Select value={selectedUser.role} onValueChange={(value) => handleUserRoleChange(selectedUser.id, value)}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={selectedUser.role} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="wallet" className="text-right">
                  Deposit
                </Label>
                <Input id="wallet" placeholder="0.00" className="col-span-3" 
                  onBlur={(e) => {
                    const amount = parseFloat(e.target.value);
                    if (!isNaN(amount)) {
                      handleDeposit(selectedUser.id, amount);
                      e.target.value = ""; // Clear the input after deposit
                    }
                  }}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Switch id="status" checked={selectedUser.status === 'active'} onCheckedChange={(checked) => {
                  if (checked) {
                    handleActivate(selectedUser.id);
                  } else {
                    handlePause(selectedUser.id);
                  }
                }} className="col-span-3" />
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="ghost" onClick={handleCloseEditDialog}>Cancel</Button>
            <Button className="ml-2" onClick={handleCloseEditDialog}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add User Dialog */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Create a new user account.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="email">Email</Label>
                    <FormControl>
                      <Input id="email" placeholder="example@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="name">Name</Label>
                    <FormControl>
                      <Input id="name" placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="role">Role</Label>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit">Create User</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
