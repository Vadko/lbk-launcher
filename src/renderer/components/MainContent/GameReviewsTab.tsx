import { MessageSquare } from 'lucide-react';
import React from 'react';

export const GameReviewsTab: React.FC = () => (
  <div className="glass-card-no-motion flex flex-col items-center text-center py-12">
    <div className="w-16 h-16 mb-4 rounded-full bg-color-main/20 flex items-center justify-center">
      <MessageSquare size={32} className="text-color-main" />
    </div>
    <h3 className="text-lg font-head font-semibold text-text-main mb-2">Відгуки</h3>
    <p className="text-text-muted">Тут будуть відгуки гравців. Скоро</p>
  </div>
);
