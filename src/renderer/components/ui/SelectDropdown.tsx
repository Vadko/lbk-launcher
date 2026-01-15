import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface SelectOption {
  name: string;
  value: string;
}

interface SelectDropdownProps {
  options: SelectOption[];
  selectedValue?: string;
  onSelectionChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SelectDropdown: React.FC<SelectDropdownProps> = React.memo(
  ({
    options,
    selectedValue,
    onSelectionChange,
    placeholder = 'Оберіть варіант',
    className = '',
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [maxHeight, setMaxHeight] = useState(120); // Start with smaller default
    const [isReady, setIsReady] = useState(false); // Track if calculations are done
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Find selected option
    const selectedOption = options.find((option) => option.value === selectedValue);
    const displayText = selectedOption?.name || placeholder;

    // Calculate available space and set max height
    useEffect(() => {
      if (isOpen && buttonRef.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        
        // Find the closest modal container
        const modalContainer = buttonRef.current.closest('[role="dialog"], .modal-content');
        const modalRect = modalContainer?.getBoundingClientRect();
        
        let spaceBelow: number;
        let spaceAbove: number;
        
        if (modalRect) {
          // Calculate space within modal
          spaceBelow = modalRect.bottom - buttonRect.bottom - 40; // 40px margin
          spaceAbove = buttonRect.top - modalRect.top - 40; // 40px margin
        } else {
          // Fallback to viewport calculation
          const viewportHeight = window.innerHeight;
          spaceBelow = viewportHeight - buttonRect.bottom - 20;
          spaceAbove = buttonRect.top - 20;
        }
        
        // Use space below, but if not enough, use the larger of the two spaces
        const availableSpace = spaceBelow > 80 ? spaceBelow : Math.max(spaceBelow, spaceAbove);
        const calculatedMaxHeight = Math.min(120, Math.max(60, availableSpace));
        
        setMaxHeight(calculatedMaxHeight);
        setDropdownPosition(spaceBelow >= 80 ? 'below' : 'above');
        
        // Use requestAnimationFrame to ensure calculations are done before showing
        requestAnimationFrame(() => {
          setIsReady(true);
        });
      } else if (!isOpen) {
        setIsReady(false);
      }
    }, [isOpen]);

    const [dropdownPosition, setDropdownPosition] = useState<'above' | 'below'>('below');

    // Close menu on outside click
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen]);

    // Handle option selection
    const handleOptionSelect = useCallback(
      (value: string) => {
        onSelectionChange(value);
        setIsOpen(false);
      },
      [onSelectionChange]
    );

    const handleToggle = useCallback(() => {
      setIsOpen(!isOpen);
    }, [isOpen]);

    return (
      <div className={`relative ${className}`} ref={menuRef}>
        <button
          ref={buttonRef}
          onClick={handleToggle}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-glass border border-border hover:bg-glass-hover hover:border-border-hover transition-all duration-200"
        >
          <span className="text-text-main truncate">{displayText}</span>
          <ChevronDown
            size={16}
            className={`text-text-muted transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: dropdownPosition === 'below' ? -10 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: dropdownPosition === 'below' ? -10 : 10 }}
              transition={{ duration: 0.15 }}
              className={`absolute left-0 right-0 ${
                dropdownPosition === 'below' ? 'top-full mt-1' : 'bottom-full mb-1'
              } bg-bg-dark border border-border rounded-lg shadow-xl z-[60] overflow-hidden`}
              data-gamepad-dropdown
            >
              <div 
                className={`overflow-y-auto custom-scrollbar py-1 transition-opacity duration-100 ${
                  isReady ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ 
                  maxHeight: `${maxHeight}px`,
                  minHeight: isReady ? 'auto' : '60px' // Prevent layout shift
                }}
              >
                {!isReady ? (
                  <div className="py-4 px-3">
                    <div className="w-full h-4 bg-glass animate-pulse rounded"></div>
                  </div>
                ) : options.length === 0 ? (
                  <div className="text-center text-text-muted py-4 text-sm">
                    Немає варіантів
                  </div>
                ) : (
                  options.map((option) => {
                    const isSelected = option.value === selectedValue;
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleOptionSelect(option.value)}
                        data-gamepad-dropdown-item
                        className={`w-full flex items-center px-3 py-2 text-sm text-left transition-colors ${
                          isSelected
                            ? 'bg-glass-hover text-text-main'
                            : 'text-text-muted hover:bg-glass hover:text-text-main'
                        }`}
                      >
                        <span className="truncate">{option.name}</span>
                        {isSelected && (
                          <span className="ml-auto text-color-accent">✓</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
