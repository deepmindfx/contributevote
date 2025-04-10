
// This file adds the toast warn method for backward compatibility
// with older code that might use it

import { toast } from "sonner";

// Add backward compatibility for toast.warn
const originalToast = toast;

if (!originalToast.warn) {
  (originalToast as any).warn = function(message: any, options?: any) {
    return originalToast.error(message, options);
  };
}

// Add to the window object for global access
(window as any).toast = originalToast;

export default originalToast;
