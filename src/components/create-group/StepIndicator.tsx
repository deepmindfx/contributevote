
import React from 'react';

interface StepIndicatorProps {
  current: number;
  totalSteps: number;
}

const StepIndicator = ({ current, totalSteps }: StepIndicatorProps) => {
  return (
    <div className="flex justify-center mb-8">
      <div className="flex space-x-2">
        {Array.from({ length: totalSteps }, (_, index) => (
          <div
            key={index}
            className={`w-3 h-3 rounded-full ${
              index < current
                ? 'bg-[#2DAE75]'
                : index === current
                ? 'bg-[#2DAE75] opacity-50'
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default StepIndicator;
