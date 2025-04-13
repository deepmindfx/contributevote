import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { User } from "@/types";
import { getAllUsers } from "@/services/localStorage";

const AdminDashboard = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Fetch all users from local storage
    const allUsers = getAllUsers();
    setUsers(allUsers);
  }, []);

  // Filter users based on search query
  const filteredUsers = users.filter((user) => {
    const searchStr = searchQuery.toLowerCase();
    return (
      user.name?.toLowerCase().includes(searchStr) ||
      user.email.toLowerCase().includes(searchStr)
    );
  });

  // Fix for missing createUser function
  const handleCreateUser = () => {
    // Implement user creation logic here
    toast.info("User creation currently not implemented in admin dashboard");
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Admin Dashboard</CardTitle>
          <CardDescription>Manage users and contributions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="search">Search Users</Label>
            <Input
              type="text"
              id="search"
              placeholder="Search by name or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{user.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4">
            <Button onClick={handleCreateUser}>Create User</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
