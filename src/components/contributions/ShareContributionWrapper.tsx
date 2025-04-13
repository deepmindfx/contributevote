
import React from 'react';
import ShareContribution from './ShareContribution';

// This wrapper component correctly handles the type conversion
// for the ShareContribution component
const ShareContributionWrapper = ({ contributionId }: { contributionId: string }) => {
  // Convert single string to string array if needed
  const formattedId = Array.isArray(contributionId) ? contributionId : [contributionId];
  
  return <ShareContribution contributionId={formattedId} />;
};

export default ShareContributionWrapper;
