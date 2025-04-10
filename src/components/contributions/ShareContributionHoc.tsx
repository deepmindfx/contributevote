
import React from 'react';
import { toast } from "sonner";
import "../../patches/toast-patch";

/**
 * This is a HOC (Higher Order Component) that wraps the ShareContribution component
 * to handle the toast.warn issue. Since ShareContribution is in read-only files,
 * we create this wrapper to intercept the toast calls.
 */
const ShareContributionHoc = (WrappedComponent: React.ComponentType<any>) => {
  return (props: any) => {
    // Create a custom toast object that maps warn to error since warn doesn't exist
    // The issue is that ShareContribution.tsx tries to use toast.warn which doesn't exist
    const customToast = {
      ...toast,
      // Map warn to error as a workaround
      warn: (message: string, options?: any) => toast.error(message, options)
    };
    
    // Return the wrapped component with all props passed through
    return <WrappedComponent {...props} toast={customToast} />;
  };
};

export default ShareContributionHoc;
