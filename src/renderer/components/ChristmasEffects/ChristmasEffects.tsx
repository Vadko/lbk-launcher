import React from 'react';
import Snowfall from 'react-snowfall';
import { useSettingsStore } from '../../store/useSettingsStore';
import pineBranch from '../../../../resources/pine-branch.svg';

export const ChristmasEffects: React.FC = () => {
  const { christmasEffectsEnabled } = useSettingsStore();

  if (!christmasEffectsEnabled) return null;

  return (
    <>
      {/* Snowfall */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      >
        <Snowfall
          snowflakeCount={35}
          speed={[0.5, 2]}
          wind={[-0.5, 1]}
          radius={[1, 4]}
          color="rgba(255, 255, 255, 0.8)"
        />
      </div>

      {/* Pine branches */}
      <img
        src={pineBranch}
        alt=""
        draggable={false}
        style={{
          position: 'fixed',
          top: -45,
          left: -45,
          width: 140,
          height: 140,
          pointerEvents: 'none',
          zIndex: 9998,
          transform: 'rotate(135deg)',
          objectFit: 'contain',
        }}
      />
      <img
        src={pineBranch}
        alt=""
        draggable={false}
        style={{
          position: 'fixed',
          top: -45,
          right: -45,
          width: 140,
          height: 140,
          pointerEvents: 'none',
          zIndex: 9998,
          transform: 'rotate(225deg)',
          objectFit: 'contain',
        }}
      />
    </>
  );
};
