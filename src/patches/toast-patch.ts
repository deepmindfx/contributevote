
// This file adds the toast warn method for backward compatibility
// with older code that might use it

import { toast } from "sonner";

// Add backward compatibility for toast.warn
const originalToast = toast as any;

// Add the warn method if it doesn't exist
if (!originalToast.warn) {
  originalToast.warn = function(message: any, options?: any) {
    return originalToast.error(message, options);
  };
}

// Create a properly typed window interface for toast
declare global {
  interface Window {
    toast: typeof toast & { warn: (message: string, options?: any) => any };
  }
}

// Expose the patched toast to the window for global access
window.toast = originalToast;

export default originalToast;
