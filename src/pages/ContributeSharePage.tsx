
import React from 'react';
import { useParams } from 'react-router-dom';
import ShareContributionWrapper from '@/components/contributions/ShareContributionWrapper';

const ContributeSharePage = () => {
  const { id } = useParams<{ id: string }>();
  
  if (!id) {
    return <div className="container py-8">Contribution ID not found</div>;
  }
  
  return (
    <div className="container py-8">
      <ShareContributionWrapper contributionId={id} />
    </div>
  );
};

export default ContributeSharePage;
