import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../ui/Input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => (
    <Input
      value={value}
      onChange={onChange}
      placeholder="Пошук гри..."
      icon={<Search size={18} className="text-text-muted" />}
    />
  );
