
import React from 'react';

interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  fullPage?: boolean;
}

const Loading = ({ size = 'medium', text = 'Loading...', fullPage = false }: LoadingProps) => {
  const sizeClasses = {
    small: 'h-5 w-5 border-2',
    medium: 'h-10 w-10 border-4',
    large: 'h-16 w-16 border-4'
  };

  const containerClasses = fullPage
    ? 'fixed inset-0 flex items-center justify-center bg-background/80 z-50'
    : 'flex flex-col items-center justify-center py-8';

  return (
    <div className={containerClasses}>
      <div className={`animate-spin ${sizeClasses[size]} rounded-full border-primary border-t-transparent`} />
      {text && <p className="mt-4 text-sm text-muted-foreground">{text}</p>}
    </div>
  );
};

export default Loading;
