
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface LoadingStateProps {
  isLoading: boolean;
  contribution: any | null;
}

const LoadingState = ({ isLoading, contribution }: LoadingStateProps) => {
  const navigate = useNavigate();
  
  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }
  
  if (!contribution) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-xl mb-4">Contribution group not found or still loading</p>
          <Button 
            onClick={() => navigate("/dashboard")} 
            className="px-4 py-2 bg-primary text-white rounded-md"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }
  
  return null;
};

export default LoadingState;
