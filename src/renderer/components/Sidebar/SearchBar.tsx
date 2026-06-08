import { Search } from 'lucide-react';
import React from 'react';
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
    type="search"
    icon={<Search size={18} className="text-text-muted" />}
  />
);
