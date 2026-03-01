'use client';

import { useMemo, useState, type KeyboardEventHandler } from 'react';
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

const normalizeTag = (value: string): string => value.trim().replace(/\s+/g, ' ');

export function TagPicker({
  selectedTags,
  onChange,
  availableTags = [],
  disabled = false,
  placeholder = 'Nhap tag roi nhan Enter',
  maxTags = 20,
}: TagPickerProps) {
  const [draft, setDraft] = useState('');

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
      .filter((tag) => (normalizedDraft ? tag.toLowerCase().includes(normalizedDraft) : true))
      .slice(0, 12);
  }, [availableTags, draft, selectedLookup]);

  const addTag = (rawValue: string) => {
    const tag = normalizeTag(rawValue);
    if (!tag || disabled || selectedTags.length >= maxTags || tag.length > 30) return;

    if (selectedLookup.has(tag.toLowerCase())) {
      setDraft('');
      return;
    }

    onChange([...selectedTags, tag]);
    setDraft('');
  };

  const removeTag = (tagToRemove: string) => {
    if (disabled) return;
    onChange(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  const onKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(draft);
    }
  };

  return (
    <div className="space-y-3">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled || selectedTags.length >= maxTags}
        placeholder={placeholder}
        className="rounded-[8px]"
      />

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-[8px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200"
            >
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={disabled}
                className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40 cursor-pointer"
                aria-label={`Xoa tag ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {normalizeTag(draft) && (
        <button
          type="button"
          onClick={() => addTag(draft)}
          disabled={disabled}
          className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
        >
          Tao tag &quot;{normalizeTag(draft)}&quot;
        </button>
      )}

      {visibleSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">Tag co san</p>
          <div className="flex flex-wrap gap-2">
            {visibleSuggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                disabled={disabled}
                className="rounded-[8px] border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Nhan Enter hoac dau phay de them tag. Toi da {maxTags} tag, moi tag toi da 30 ky tu.
      </p>
    </div>
  );
}
