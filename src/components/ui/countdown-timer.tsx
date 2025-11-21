
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  deadline: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  deadline,
  className,
  size = "md",
  showLabel = true
}) => {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
    progress: number;
  }>({ hours: 0, minutes: 0, seconds: 0, total: 0, progress: 100 });

  useEffect(() => {
    function calculateTimeLeft() {
      try {
        const deadlineDate = new Date(deadline);
        const now = new Date();
        
        // If deadline is invalid or already passed
        if (isNaN(deadlineDate.getTime()) || deadlineDate <= now) {
          return {
            hours: 0,
            minutes: 0,
            seconds: 0,
            total: 0,
            progress: 0
          };
        }

        // Calculate time difference in milliseconds
        const difference = deadlineDate.getTime() - now.getTime();
        
        // Calculate total duration (24 hours in milliseconds)
        const totalDuration = 24 * 60 * 60 * 1000;
        
        // Calculate elapsed time since creation (assuming 24h deadline)
        const elapsed = totalDuration - difference;
        
        // Calculate progress percentage (0-100)
        const progress = Math.max(0, Math.min(100, (difference / totalDuration) * 100));

        // Calculate hours, minutes, seconds
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        return {
          hours,
          minutes,
          seconds,
          total: difference,
          progress
        };
      } catch (error) {
        console.error("Error calculating time left:", error);
        return {
          hours: 0,
          minutes: 0,
          seconds: 0,
          total: 0,
          progress: 0
        };
      }
    }

    // Calculate time left initially
    setTimeLeft(calculateTimeLeft());

    // Update time every second
    const timer = setInterval(() => {
      const timeLeft = calculateTimeLeft();
      setTimeLeft(timeLeft);
      
      // Clear interval if time has run out
      if (timeLeft.total <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    // Cleanup on unmount
    return () => clearInterval(timer);
  }, [deadline]);

  // Circle styles based on size
  const circleSizes = {
    sm: { width: 60, height: 60, strokeWidth: 3, fontSize: "xs" },
    md: { width: 80, height: 80, strokeWidth: 4, fontSize: "sm" },
    lg: { width: 100, height: 100, strokeWidth: 5, fontSize: "base" }
  };
  
  const { width, height, strokeWidth, fontSize } = circleSizes[size];
  
  // Calculate circle properties
  const radius = (width / 2) - (strokeWidth * 2);
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (timeLeft.progress / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative" style={{ width, height }}>
        {/* Background circle */}
        <svg width={width} height={height} className="absolute top-0 left-0">
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="none"
            stroke="#E5DEFF"
            strokeWidth={strokeWidth}
          />
        </svg>
        
        {/* Progress circle */}
        <svg 
          width={width} 
          height={height} 
          className="absolute top-0 left-0 -rotate-90 transform"
        >
          <circle
            cx={width / 2}
            cy={height / 2}
            r={radius}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-in-out"
          />
        </svg>
        
        {/* Text in center */}
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div className={`font-bold text-${fontSize} whitespace-nowrap leading-tight`}>
            {`${timeLeft.hours}h:${String(timeLeft.minutes).padStart(2, '0')}m ${String(timeLeft.seconds).padStart(2, '0')}s`}
          </div>
        </div>
      </div>
      
      {showLabel && (
        <div className="mt-1 text-xs text-amber-500 flex items-center whitespace-nowrap">
          <span className="inline-block w-2 h-2 bg-amber-500 rounded-full mr-1"></span>
          Ends in {timeLeft.hours}h {String(timeLeft.minutes).padStart(2, '0')}m
        </div>
      )}
    </div>
  );
};

export default CountdownTimer;
