
// The Nigeria Bulk SMS API service for sending SMS messages

// API configuration
interface SMSConfig {
  username: string;
  password: string;
  sender: string;
  apiUrl: string;
}

// Configuration with actual credentials
const DEFAULT_CONFIG: SMSConfig = {
  username: "username", // Replace with your actual username from Nigeria Bulk SMS
  password: "password", // Replace with your actual password
  sender: "CollectiPay",
  apiUrl: "https://portal.nigeriabulksms.com/api/"
};

// Response interfaces
interface SMSSuccessResponse {
  status: "OK";
  count: number;
  price: number;
}

interface SMSErrorResponse {
  error: string;
  errno: string;
}

type SMSResponse = SMSSuccessResponse | SMSErrorResponse;

/**
 * Send an SMS message using the Nigeria Bulk SMS API
 * @param phoneNumber The recipient's phone number (e.g., 2348030000000)
 * @param message The message to send
 * @param config Optional configuration to override defaults
 * @returns Promise with the API response
 */
export const sendSMS = async (
  phoneNumber: string,
  message: string,
  config: Partial<SMSConfig> = {}
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    // Merge default config with any overrides
    const smsConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Clean the phone number (remove spaces, dashes, etc.)
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, "");
    
    // Ensure the phone number has the country code
    const formattedPhone = cleanPhoneNumber.startsWith("234") 
      ? cleanPhoneNumber 
      : `234${cleanPhoneNumber.startsWith("0") ? cleanPhoneNumber.substring(1) : cleanPhoneNumber}`;
    
    console.log("Sending SMS to:", formattedPhone, "with message:", message);
    
    // Build the query parameters
    const params = new URLSearchParams({
      username: smsConfig.username,
      password: smsConfig.password,
      sender: smsConfig.sender,
      message: message,
      mobiles: formattedPhone
    });
    
    // Make the actual API call
    const response = await fetch(`${smsConfig.apiUrl}?${params.toString()}`);
    const data = await response.json();
    
    if (data.status === "OK") {
      return { success: true, data };
    } else {
      return { success: false, error: data.error || "Failed to send SMS" };
    }
    
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

/**
 * Send an OTP code via SMS
 * @param phoneNumber The recipient's phone number
 * @param otp The OTP code to send
 * @returns Promise with the result of the SMS sending operation
 */
export const sendOTPSMS = async (phoneNumber: string, otp: string): Promise<boolean> => {
  // Create an OTP message
  const otpMessage = `Your CollectiPay verification code is: ${otp}. This code will expire in 10 minutes.`;
  
  // Send the SMS
  const result = await sendSMS(phoneNumber, otpMessage);
  
  return result.success;
};

/**
 * Check account balance
 * @param config Optional configuration to override defaults
 * @returns Promise with the account balance
 */
export const checkBalance = async (config: Partial<SMSConfig> = {}): Promise<{ success: boolean; balance?: number; error?: string }> => {
  try {
    // Merge default config with any overrides
    const smsConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Build the query parameters
    const params = new URLSearchParams({
      username: smsConfig.username,
      password: smsConfig.password,
      action: "balance"
    });
    
    // Make the actual API call
    const response = await fetch(`${smsConfig.apiUrl}?${params.toString()}`);
    const data = await response.json();
    
    if (data.status === "OK") {
      return { success: true, balance: data.balance };
    } else {
      return { success: false, error: data.error || "Failed to check balance" };
    }
    
  } catch (error) {
    console.error("Failed to check balance:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

/**
 * Generate a random OTP code
 * @returns A 6-digit OTP code
 */
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Store OTP code for a user
 * @param userId User ID
 * @param otp OTP code
 */
export const storeOTP = (userId: string, otp: string): void => {
  const otpData = JSON.parse(localStorage.getItem('otpCodes') || '{}');
  otpData[userId] = {
    code: otp,
    expiresAt: new Date().getTime() + 10 * 60 * 1000 // 10 minutes from now
  };
  localStorage.setItem('otpCodes', JSON.stringify(otpData));
};

/**
 * Verify OTP code for a user
 * @param userId User ID
 * @param otp OTP code
 * @returns Whether the OTP is valid
 */
export const verifyOTP = (userId: string, otp: string): boolean => {
  const otpData = JSON.parse(localStorage.getItem('otpCodes') || '{}');
  const userData = otpData[userId];
  
  if (!userData) return false;
  
  const now = new Date().getTime();
  if (now > userData.expiresAt) return false;
  
  return userData.code === otp;
};
