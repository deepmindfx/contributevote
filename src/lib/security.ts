// Security utilities and validation functions

export const SECURITY_CONSTANTS = {
  MIN_TRANSACTION_AMOUNT: 100,
  MAX_TRANSACTION_AMOUNT: 10000000,
  MAX_DAILY_TRANSACTIONS: 50,
  MAX_WITHDRAWAL_AMOUNT: 5000000,
  PIN_LENGTH: 4,
  SESSION_TIMEOUT: 4 * 60 * 60 * 1000, // 4 hours
} as const;

// Input sanitization
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
};

// Validate transaction amount
export const validateTransactionAmount = (amount: number): boolean => {
  return (
    amount >= SECURITY_CONSTANTS.MIN_TRANSACTION_AMOUNT &&
    amount <= SECURITY_CONSTANTS.MAX_TRANSACTION_AMOUNT &&
    Number.isFinite(amount) &&
    amount > 0
  );
};

// Validate email format
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Validate phone number (Nigerian format)
export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^(\+234|234|0)?[789][01]\d{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Validate PIN format
export const validatePIN = (pin: string): boolean => {
  return /^\d{4}$/.test(pin);
};

// Rate limiting helper
export const createRateLimiter = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, number[]>();
  
  return (identifier: string): boolean => {
    const now = Date.now();
    const userRequests = requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    validRequests.push(now);
    requests.set(identifier, validRequests);
    return true;
  };
};

// Content Security Policy
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for Vite in development
    'https://api.flutterwave.com',
    'https://*.supabase.co'
  ],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'connect-src': [
    "'self'",
    'https://api.flutterwave.com',
    'https://*.supabase.co',
    'wss://*.supabase.co'
  ],
  'font-src': ["'self'", 'data:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': []
};

// Security headers
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

// Audit logging
export const logSecurityEvent = (event: {
  type: 'auth' | 'transaction' | 'access' | 'error';
  action: string;
  userId?: string;
  details?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}) => {
  // In production, this would send to a logging service
  console.log('[SECURITY]', {
    timestamp: new Date().toISOString(),
    ...event
  });
  
  // Store in localStorage for now (in production, use proper logging service)
  const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
  logs.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event
  });
  
  // Keep only last 1000 logs
  if (logs.length > 1000) {
    logs.splice(0, logs.length - 1000);
  }
  
  localStorage.setItem('security_logs', JSON.stringify(logs));
};