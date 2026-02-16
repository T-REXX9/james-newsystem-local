import React from 'react';

interface CustomLoadingSpinnerProps {
  className?: string;
  label?: string;
}

const CustomLoadingSpinner: React.FC<CustomLoadingSpinnerProps> = ({
  className = '',
  label = 'Loading'
}) => {
  return (
    <div
      className={`custom-loading-spinner ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="custom-loading-square" />
      <div className="custom-loading-square" />
      <div className="custom-loading-square" />
      <div className="custom-loading-square" />
      <div className="custom-loading-square" />
    </div>
  );
};

export default CustomLoadingSpinner;
