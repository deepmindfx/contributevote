
import { 
  getContributions, 
  addNotification, 
  getUserByEmail, 
  getUserByPhone 
} from '@/services/localStorage';

// Helper function to get contributions for import in the context
export function getContributionsData() {
  try {
    const contributionsString = localStorage.getItem('contributions');
    return contributionsString ? JSON.parse(contributionsString) : [];
  } catch (error) {
    console.error("Error getting contributions:", error);
    return [];
  }
}

export const shareContributionToContacts = (
  contributionId: string, 
  recipients: string[], 
  contribution: any, 
  userId: string, 
  userName: string, 
  getUserByEmailFn: Function, 
  getUserByPhoneFn: Function
) => {
  const shareUrl = `${window.location.origin}/contribute/share/${contributionId}`;
  
  // Log share event to console - in a real app we'd send actual notifications
  console.log(`Sharing contribution "${contribution.name}" to ${recipients.length} recipients`);
  console.log(`Share URL: ${shareUrl}`);
  console.log(`Recipients: ${recipients.join(', ')}`);
  
  // Process each recipient
  recipients.forEach(recipient => {
    // Check if recipient is an email or phone number
    let recipientUser = getUserByEmailFn(recipient);
    if (!recipientUser) {
      recipientUser = getUserByPhoneFn(recipient);
    }
    
    if (recipientUser) {
      // Recipient is a registered user
      
      // Add notification to the recipient
      addNotification({
        userId: recipientUser.id,
        message: `${userName} shared "${contribution.name}" contribution with you`,
        type: 'info',
        read: false,
        relatedId: contributionId,
      });
      
      // Add recipient to contribution members if not already there
      if (!contribution.members.includes(recipientUser.id)) {
        const contributions = getContributions();
        const contribIndex = contributions.findIndex((c: any) => c.id === contributionId);
        
        if (contribIndex >= 0) {
          contributions[contribIndex].members.push(recipientUser.id);
          localStorage.setItem('contributions', JSON.stringify(contributions));
        }
      }
    } else {
      // Recipient is not a registered user
      // In a real app, we would send an invitation email/SMS
      console.log(`Recipient ${recipient} is not registered. Invitation would be sent.`);
    }
  });
};
