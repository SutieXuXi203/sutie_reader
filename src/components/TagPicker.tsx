'use client';
import { useMemo, useState, useRef, useEffect, type KeyboardEventHandler } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
interface TagPickerProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  availableTags?: string[];
  disabled?: boolean;
  placeholder?: string;
  maxTags?: number;
}
const normalizeTag = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();
export function TagPicker({
  selectedTags,
  onChange,
  availableTags = [],
  disabled = false,
  placeholder = 'Tìm kiếm tag...',
  maxTags = 20,
}: TagPickerProps) {
  const [draft, setDraft] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  const selectedLookup = useMemo(
    () => new Set(selectedTags.map((tag) => normalizeTag(tag).toLowerCase())),
    [selectedTags]
  );
  const visibleSuggestions = useMemo(() => {
    const normalizedDraft = normalizeTag(draft).toLowerCase();
    return availableTags
      .map((tag) => normalizeTag(tag))
      .filter((tag) => tag.length > 0)
      .filter((tag, index, arr) => arr.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === index)
      .filter((tag) => !selectedLookup.has(tag.toLowerCase()))
      .filter((tag) => (normalizedDraft ? tag.toLowerCase().includes(normalizedDraft) : true));
  }, [availableTags, draft, selectedLookup]);
  const addTag = (rawValue: string) => {
    const tag = normalizeTag(rawValue);
    if (!tag || disabled || selectedTags.length >= maxTags || tag.length > 30) return;
    if (selectedLookup.has(tag.toLowerCase())) {
      setDraft('');
      return;
    }
    const isAvailable = availableTags.some(t => normalizeTag(t).toLowerCase() === tag.toLowerCase());
    if (!isAvailable) return;
    onChange([...selectedTags, tag]);
    setDraft('');
  };
  const removeTag = (tagToRemove: string) => {
    if (disabled) return;
    onChange(selectedTags.filter((tag) => tag !== tagToRemove));
  };
  const onKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const exactMatch = visibleSuggestions.find(t => t.toLowerCase() === draft.toLowerCase());
      if (exactMatch) {
        addTag(exactMatch);
      } else if (visibleSuggestions.length > 0) {
        addTag(visibleSuggestions[0]);
      }
    }
  };
  return (
    <div className="space-y-3" ref={containerRef}>
      <div className="relative">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setIsFocused(true)}
          disabled={disabled || selectedTags.length >= maxTags}
          placeholder={placeholder}
          className={`border-input transition-none ${isFocused ? 'rounded-t-[8px] rounded-b-none focus-visible:ring-0 shadow-none' : 'rounded-[8px]'}`}
        />
        {isFocused && (
          <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-background border border-t-0 border-input rounded-b-[8px] p-3 shadow-lg max-h-[200px] overflow-y-auto">
            <p className="text-xs text-primary/70 dark:text-primary/60 mb-2">Những tag có sẵn</p>
            <div className="flex flex-wrap gap-2">
              {visibleSuggestions.length > 0 ? visibleSuggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    addTag(tag);
                    setIsFocused(true);
                  }}
                  disabled={disabled}
                  className="rounded-[8px] border border-border bg-secondary px-2.5 py-1 text-xs text-foreground hover:border-border dark:hover:border-primary/70 hover:bg-secondary/70 dark:hover:bg-primary/25 transition-colors cursor-pointer disabled:opacity-50"
                >
                  #{tag.toLowerCase()}
                </button>
              )) : (
                <p className="text-xs text-muted-foreground">Không có tag nào</p>
              )}
            </div>
          </div>
        )}
      </div>
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-input bg-secondary/50 dark:bg-secondary/60 px-2.5 py-1 text-xs text-foreground"
            >
              <span>#{tag.toLowerCase()}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 cursor-pointer"
                aria-label={`Xoa tag ${tag.toLowerCase()}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Bạn có thể chọn tối đa {maxTags} tag có sẵn từ danh sách.
      </p>
    </div>
  );
}

