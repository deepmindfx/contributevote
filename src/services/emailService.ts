
import { Resend } from 'resend';

// Initialize Resend with API key
const resend = new Resend('re_fV2j2bhg_5gSr7uTEavKJByZg26Y1nGq4');

// Email templates
const getOTPEmailTemplate = (otp: string) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #2DAE75; text-align: center;">CollectiPay Verification</h2>
      <p>Thank you for registering with CollectiPay. Please use the following OTP code to verify your account:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; padding: 10px 30px; background-color: #f5f5f5; border-radius: 5px;">${otp}</span>
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this verification, please ignore this email.</p>
      <div style="text-align: center; margin-top: 30px; color: #666;">
        <p>© ${new Date().getFullYear()} CollectiPay. All rights reserved.</p>
      </div>
    </div>
  `;
};

const getWithdrawalReminderTemplate = (
  withdrawalRequest: { amount: number; purpose: string },
  contributionName: string,
  requesterName: string,
  voteUrl: string
) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #2DAE75; text-align: center;">CollectiPay Withdrawal Request</h2>
      <p>Hello,</p>
      <p>${requesterName} has requested a withdrawal from the "${contributionName}" group:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Amount:</strong> ₦${withdrawalRequest.amount.toLocaleString()}</p>
        <p><strong>Purpose:</strong> ${withdrawalRequest.purpose}</p>
      </div>
      <p>Your vote is required to approve or reject this request. Please cast your vote as soon as possible.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${voteUrl}" style="background-color: #2DAE75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Vote Now</a>
      </div>
      <p>If you have any questions, please contact the group administrator.</p>
      <div style="text-align: center; margin-top: 30px; color: #666;">
        <p>© ${new Date().getFullYear()} CollectiPay. All rights reserved.</p>
      </div>
    </div>
  `;
};

// Email sending functions
export const sendOTPEmail = async (email: string, otp: string) => {
  try {
    const response = await resend.emails.send({
      from: 'CollectiPay <verification@collectipay.app>',
      to: [email],
      subject: 'Verify Your CollectiPay Account',
      html: getOTPEmailTemplate(otp),
    });
    
    console.log('OTP Email sent:', response);
    return { success: true, data: response };
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    return { success: false, error };
  }
};

export const sendWithdrawalReminderEmail = async (
  email: string,
  withdrawalRequest: { amount: number; purpose: string },
  contributionName: string,
  requesterName: string,
  requestId: string
) => {
  try {
    // Generate the vote URL (in a real app, this would be a proper URL)
    const voteUrl = `${window.location.origin}/votes?requestId=${requestId}`;
    
    const response = await resend.emails.send({
      from: 'CollectiPay <notifications@collectipay.app>',
      to: [email],
      subject: `Vote Required: Withdrawal Request for ${contributionName}`,
      html: getWithdrawalReminderTemplate(withdrawalRequest, contributionName, requesterName, voteUrl),
    });
    
    console.log('Withdrawal reminder email sent:', response);
    return { success: true, data: response };
  } catch (error) {
    console.error('Failed to send withdrawal reminder email:', error);
    return { success: false, error };
  }
};
