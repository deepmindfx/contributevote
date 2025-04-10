
import React from 'react';
import { toast } from "sonner";

/**
 * This is a HOC (Higher Order Component) that wraps the ShareContribution component
 * to handle the toast.warn issue. Since ShareContribution is in read-only files,
 * we create this wrapper to intercept the toast calls.
 */
const ShareContributionHoc = (WrappedComponent: React.ComponentType<any>) => {
  return (props: any) => {
    // Create a modified toast object that replaces warn with error
    const customToast = {
      ...toast,
      // Replace warn with error since warn doesn't exist in newer versions
      warn: (message: string, options?: any) => {
        return toast.error(message, options);
      }
    };
    
    // Override the global toast in this context
    const originalToast = window.toast;
    window.toast = customToast as any;
    
    // Render the component with the modified toast
    const result = <WrappedComponent {...props} toast={customToast} />;
    
    // Reset the global toast
    window.toast = originalToast;
    
    return result;
  };
};

export default ShareContributionHoc;
