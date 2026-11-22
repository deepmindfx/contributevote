export const SIGNUP_PHONE_ERROR = "Enter a valid phone number, including the country code for numbers outside Nigeria.";

export function normalizeSignupPhone(input?: string) {
  const phone = input?.trim().replace(/[\s().-]/g, "") ?? "";
  if (/^0[7-9]\d{9}$/.test(phone)) return "+234" + phone.slice(1);
  if (/^234[7-9]\d{9}$/.test(phone)) return "+" + phone;
  if (/^\+[1-9]\d{7,14}$/.test(phone)) return phone;
  return null;
}
