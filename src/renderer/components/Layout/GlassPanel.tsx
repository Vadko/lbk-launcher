interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function GlassPanel({ children, className = '', style }: GlassPanelProps) {
  return (
    <div className={`glass-panel ${className}`} style={style}>
      {children}
    </div>
  );
}
