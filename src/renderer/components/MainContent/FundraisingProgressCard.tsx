import React from 'react';
import { DollarSign } from 'lucide-react';

interface FundraisingProgressCardProps {
  current: number;
  goal: number;
}

export const FundraisingProgressCard: React.FC<FundraisingProgressCardProps> = ({
  current,
  goal,
}) => {
  const percentage = goal > 0 ? Math.min(Math.round((current / goal) * 100), 100) : 0;

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="glass-card">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign size={20} className="text-neon-green" />
        <h3 className="text-lg font-head font-semibold text-white">Збір коштів</h3>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-300">Зібрано</span>
          <span className="text-white font-semibold">{formatAmount(current)}</span>
        </div>

        <div className="w-full bg-glass rounded-full h-4 border border-border overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon-green to-neon-blue transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Ціль</span>
          <span className="text-gray-300">{formatAmount(goal)}</span>
        </div>

        <div className="text-center pt-2 border-t border-border">
          <span className="text-2xl font-bold text-neon-green">{percentage}%</span>
        </div>
      </div>
    </div>
  );
};
