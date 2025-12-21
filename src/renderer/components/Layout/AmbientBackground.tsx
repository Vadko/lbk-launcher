import React from 'react';

export const AmbientBackground: React.FC = () => (
    <div className="fixed inset-0 z-[-1] overflow-hidden">
      {/* Gradient blobs */}
      <div
        className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full opacity-50 blur-[80px] animate-float"
        style={{
          background: 'radial-gradient(circle, #bd00ff, transparent)',
        }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[70vw] h-[70vw] rounded-full opacity-50 blur-[80px] animate-float"
        style={{
          background: 'radial-gradient(circle, #00f2ff, transparent)',
          animationDelay: '-5s',
        }}
      />
      <div
        className="absolute top-[40%] left-[20%] w-[40vw] h-[40vw] rounded-full opacity-30 blur-[80px] animate-float"
        style={{
          background: 'radial-gradient(circle, #ff0055, transparent)',
          animationDelay: '-10s',
        }}
      />

      {/* Noise overlay */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
