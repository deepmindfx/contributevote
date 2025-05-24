
import React from "react";

interface StepIndicatorProps {
  currentStep: number;
}

const StepIndicator = ({ currentStep }: StepIndicatorProps) => {
  return (
    <div className="relative mb-8">
      <div className="flex justify-between items-center relative z-10">
        <div className={`flex flex-col items-center ${currentStep >= 1 ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
            currentStep >= 1 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
          }`}>
            1
          </div>
          <span className="text-xs font-medium">Details</span>
        </div>
        
        <div className={`flex flex-col items-center ${currentStep >= 2 ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
            currentStep >= 2 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
          }`}>
            2
          </div>
          <span className="text-xs font-medium">Schedule</span>
        </div>
        
        <div className={`flex flex-col items-center ${currentStep >= 3 ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
            currentStep >= 3 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
          }`}>
            3
          </div>
          <span className="text-xs font-medium">Settings</span>
        </div>
      </div>
      <div className="absolute top-5 left-0 right-0 h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-300" 
          style={{ width: `${(currentStep - 1) * 50}%` }} 
        />
      </div>
    </div>
  );
};

export default StepIndicator;
