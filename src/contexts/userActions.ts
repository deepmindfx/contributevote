
import { toast } from 'sonner';
import { 
  updateUser, 
  updateUserById, 
  depositToUser, 
  pauseUser, 
  activateUser,
  logoutUser as logout,
  verifyUserWithOTP,
  User
} from '@/services/localStorage';

export const updateProfile = (userData: Partial<User>, refreshData: () => void) => {
  try {
    updateUser(userData);
    refreshData();
    toast.success('Profile updated successfully');
  } catch (error) {
    toast.error('Failed to update profile');
    console.error(error);
  }
};

export const updateUserAsAdmin = (
  userId: string, 
  userData: Partial<User>, 
  isAdmin: boolean,
  refreshData: () => void
) => {
  try {
    if (!isAdmin) {
      toast.error('Unauthorized access');
      return;
    }

    updateUserById(userId, userData);
    refreshData();
    toast.success('User updated successfully');
  } catch (error) {
    toast.error('Failed to update user');
    console.error(error);
  }
};

export const depositToUserAsAdmin = (
  userId: string, 
  amount: number, 
  isAdmin: boolean,
  refreshData: () => void
) => {
  try {
    if (!isAdmin) {
      toast.error('Unauthorized access');
      return;
    }

    depositToUser(userId, amount);
    refreshData();
    toast.success(`Successfully deposited ₦${amount.toLocaleString()} to user`);
  } catch (error) {
    toast.error('Failed to deposit funds');
    console.error(error);
  }
};

export const pauseUserAsAdmin = (
  userId: string, 
  isAdmin: boolean,
  refreshData: () => void
) => {
  try {
    if (!isAdmin) {
      toast.error('Unauthorized access');
      return;
    }

    pauseUser(userId);
    refreshData();
    toast.success('User paused successfully');
  } catch (error) {
    toast.error('Failed to pause user');
    console.error(error);
  }
};

export const activateUserAsAdmin = (
  userId: string, 
  isAdmin: boolean,
  refreshData: () => void
) => {
  try {
    if (!isAdmin) {
      toast.error('Unauthorized access');
      return;
    }

    activateUser(userId);
    refreshData();
    toast.success('User activated successfully');
  } catch (error) {
    toast.error('Failed to activate user');
    console.error(error);
  }
};

export const logoutUser = (refreshData: () => void) => {
  logout();
  refreshData();
  toast.success("You have been logged out successfully");
};

export const verifyUser = (userId: string, refreshData: () => void) => {
  try {
    verifyUserWithOTP(userId);
    refreshData();
    toast.success('User verified successfully');
  } catch (error) {
    toast.error('Failed to verify user');
    console.error(error);
  }
};
