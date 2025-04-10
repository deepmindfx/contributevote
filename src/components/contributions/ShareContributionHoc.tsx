
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
    // Intercept and redirect toast warnings to our patched toast
    // This is needed because ShareContribution uses toast.warn which isn't in sonner directly
    const originalToast = window.toast;
    
    // Return the wrapped component with all props passed through
    return <WrappedComponent {...props} toast={originalToast} />;
  };
};

export default ShareContributionHoc;
