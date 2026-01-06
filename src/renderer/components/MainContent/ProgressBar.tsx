import React from 'react';

interface ProgressBarProps {
  label: string;
  value: number;
  color: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ label, value, color }) => (
  <div className="mb-4 last:mb-0">
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm font-medium text-text-muted">{label}</span>
      <span className="text-sm font-bold text-text-main">{value}%</span>
    </div>
    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${value}%`,
          background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          boxShadow: `0 0 10px ${color}40`,
        }}
      />
    </div>
  </div>
);
