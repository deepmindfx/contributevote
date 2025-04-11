
import React from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  message: string;
  buttonText?: string;
  onButtonClick?: () => void;
}

const EmptyState = ({ message, buttonText, onButtonClick }: EmptyStateProps) => {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <p>{message}</p>
      {buttonText && onButtonClick && (
        <Button 
          className="mt-4"
          onClick={onButtonClick}
        >
          {buttonText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
