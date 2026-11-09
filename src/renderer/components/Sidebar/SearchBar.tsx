import { SearchIcon } from 'lucide-react';
import { t } from '@/shared/i18n/i18n';
import { Input } from '../ui/Input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <Input
      value={value}
      onChange={onChange}
      placeholder={t('gameSearch.placeholder')}
      type="search"
      icon={<SearchIcon size={18} className="text-text-muted" />}
    />
  );
}
