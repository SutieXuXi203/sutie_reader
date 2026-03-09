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
          className="rounded-[8px] border-slate-200 dark:border-slate-700"
        />
        {isFocused && (
          <div className="absolute top-full left-0 right-0 z-50 bg-white dark:bg-[#140808] border border-t-0 border-slate-200 dark:border-slate-700 rounded-[8px] p-3 shadow-lg max-h-[200px] overflow-y-auto">
            <p className="text-xs text-red-400/70 dark:text-red-400/60 mb-2">Những tag có sẵn</p>
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
                  className="rounded-[8px] border border-border bg-secondary px-2.5 py-1 text-xs text-foreground hover:border-red-300 dark:hover:border-red-700 hover:bg-red-100/70 dark:hover:bg-red-900/30 transition-colors cursor-pointer disabled:opacity-50"
                >
                  #{tag.toLowerCase()}
                </button>
              )) : (
                <p className="text-xs text-muted-foreground dark:text-slate-500">Không có tag nào</p>
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
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200"
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

