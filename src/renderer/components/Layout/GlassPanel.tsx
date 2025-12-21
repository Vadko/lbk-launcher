import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', style }) => <div className={`glass-panel ${className}`} style={style}>{children}</div>;
