
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
    // Create a custom toast object with the warn method
    const customToast = {
      ...toast,
      warn: (message: string, options?: any) => toast.error(message, options)
    };
    
    // Return the wrapped component with all props passed through
    return <WrappedComponent {...props} toast={customToast} />;
  };
};

export default ShareContributionHoc;
