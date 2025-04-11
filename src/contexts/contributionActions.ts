
import { toast } from 'sonner';
import { 
  createContribution, 
  contributeToGroup, 
  contributeByAccountNumber,
  generateShareLink,
  Contribution,
  addNotification,
  getCurrentUser,
  getContributions
} from '@/services/localStorage';

export const createNewContribution = (
  contribution: Omit<Contribution, 'id' | 'createdAt' | 'currentAmount' | 'members' | 'contributors' | 'accountNumber'>,
  refreshData: () => void
) => {
  try {
    createContribution(contribution);
    refreshData();
    toast.success('Contribution group created successfully!');
  } catch (error) {
    toast.error('Failed to create contribution group');
    console.error(error);
  }
};

export const contribute = (
  contributionId: string, 
  amount: number, 
  anonymous: boolean = false,
  walletBalance: number,
  refreshData: () => void
) => {
  try {
    if (walletBalance < amount) {
      toast.error('Insufficient funds in your wallet');
      return;
    }
    
    contributeToGroup(contributionId, amount, anonymous);
    refreshData();
    toast.success('Contribution successful!');
  } catch (error) {
    toast.error('Failed to make contribution');
    console.error(error);
  }
};

export const contributeViaAccountNumber = (
  accountNumber: string, 
  amount: number, 
  contributorInfo: { name: string, email?: string, phone?: string }, 
  anonymous: boolean = false,
  refreshData: () => void
) => {
  try {
    contributeByAccountNumber(accountNumber, amount, contributorInfo, anonymous);
    refreshData();
    toast.success('Contribution successful!');
  } catch (error) {
    if (error instanceof Error) {
      toast.error(error.message);
    } else {
      toast.error('Failed to make contribution');
    }
    console.error(error);
  }
};

export const getShareLink = (contributionId: string) => {
  return generateShareLink(contributionId);
};

export const shareToContacts = (
  contributionId: string, 
  recipients: string[],
  contributions: Contribution[],
  getUserByEmail: (email: string) => any,
  getUserByPhone: (phone: string) => any,
  refreshData: () => void
) => {
  try {
    const currentUser = getCurrentUser();
    const contribution = contributions.find(c => c.id === contributionId);
    
    if (!contribution) {
      toast.error('Contribution not found');
      return;
    }
    
    const shareUrl = `${window.location.origin}/contribute/share/${contributionId}`;
    
    // Log share event to console - in a real app we'd send actual notifications
    console.log(`Sharing contribution "${contribution.name}" to ${recipients.length} recipients`);
    console.log(`Share URL: ${shareUrl}`);
    console.log(`Recipients: ${recipients.join(', ')}`);
    
    // Process each recipient
    recipients.forEach(recipient => {
      // Check if recipient is an email or phone number
      let recipientUser = getUserByEmail(recipient);
      if (!recipientUser) {
        recipientUser = getUserByPhone(recipient);
      }
      
      if (recipientUser) {
        // Recipient is a registered user
        
        // Add notification to the recipient
        addNotification({
          userId: recipientUser.id,
          message: `${currentUser?.name} shared "${contribution.name}" contribution with you`,
          type: 'info',
          read: false,
          relatedId: contributionId,
        });
        
        // Add recipient to contribution members if not already there
        if (contribution.members && !contribution.members.includes(recipientUser.id)) {
          const allContributions = getContributions();
          const contribIndex = allContributions.findIndex(c => c.id === contributionId);
          
          if (contribIndex >= 0 && allContributions[contribIndex].members) {
            allContributions[contribIndex].members.push(recipientUser.id);
            localStorage.setItem("collectipay_contributions", JSON.stringify(allContributions));
          }
        }
      } else {
        // Recipient is not a registered user
        // In a real app, we would send an invitation email/SMS
        console.log(`Recipient ${recipient} is not registered. Invitation would be sent.`);
      }
    });
    
    toast.success(`Contribution link shared with ${recipients.length} recipient(s)`);
    refreshData();
  } catch (error) {
    toast.error('Failed to share contribution');
    console.error(error);
  }
};

export const isGroupCreator = (contributionId: string, userId: string, contributions: Contribution[]): boolean => {
  const contribution = contributions.find(c => c.id === contributionId);
  return !!(contribution && contribution.creatorId === userId);
};
