'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { ComponentProps, useEffect, useId, useMemo, useRef, useState } from 'react';

import { Input } from '@/shared/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';

export type ComboboxOption = {
  value: string;
  /** What the option reads as, in the language the page is being shown in. */
  label: string;
  /**
   * Extra text a query may match on that is not displayed — the other language's name, most of
   * all. A clinic typing `rhino` has to find რინოპლასტიკა while the page is in Georgian.
   */
  keywords?: string[];
};

/*
  Casefold and trim, nothing more. Georgian has no case, so `toLowerCase` is inert on Mkhedruli and
  does the work on the Latin half of the catalogue — which is the half that has case to get wrong.
*/
const normalise = (text: string) => text.trim().toLowerCase();

const matches = (option: ComboboxOption, query: string) =>
  [option.label, ...(option.keywords ?? [])].some(text => normalise(text).includes(query));

type ComboboxProps = Omit<ComponentProps<'button'>, 'value' | 'onChange'> & {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  /** Shown on the trigger when the value matches no option — an empty or retired key. */
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
};

/**
 * A select you can type into, for lists too long to scan.
 *
 * The procedure catalogue is ninety-two entries. A plain `Select` made that a scroll through an
 * alphabet nobody ordered it by, and the cost of the wrong pick is not cosmetic: `manipulationType`
 * decides which recovery guide the patient reads.
 *
 * Filtering runs over `keywords` as well as the visible label, so both names of a procedure find
 * it whichever language the clinic is working in. Nothing here is fuzzy — a substring match is
 * predictable, and a clinician who types four letters and sees the wrong thing ranked first
 * trusts the field less, not more.
 *
 * Built on Popover rather than a second component library: everything in this folder is Radix, and
 * `@base-ui/react` shipping its own combobox is not a reason to run two primitive libraries.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  className,
  disabled,
  ...triggerProps
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find(option => option.value === value);

  const filtered = useMemo(() => {
    const trimmed = normalise(query);
    if (!trimmed) return options;
    return options.filter(option => matches(option, trimmed));
  }, [options, query]);

  /*
    Keyboard highlighting has to move the viewport with it, or arrowing past the eighth of ninety-two
    options walks the selection somewhere the clinician cannot see. `scrollIntoView` is guarded
    because jsdom does not implement it and the tests would otherwise fail on the scroll, not the
    behaviour they are checking.
  */
  useEffect(() => {
    if (!open) return;
    const element = listRef.current?.querySelector(`#${CSS.escape(optionId(highlighted))}`);
    element?.scrollIntoView?.({ block: 'nearest' });
  });

  function choose(option: ComboboxOption) {
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (filtered.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlighted(current => (current + step + filtered.length) % filtered.length);
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setHighlighted(event.key === 'Home' ? 0 : filtered.length - 1);
      return;
    }

    if (event.key === 'Enter') {
      // Without this the Enter that picks a procedure also submits the form around it.
      event.preventDefault();
      const option = filtered[highlighted];
      if (option) choose(option);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next);
        // Every opening starts from the whole list; a stale query would hide the rest of it.
        if (next) setQuery('');
      }}
    >
      <PopoverTrigger
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          `flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input
          bg-transparent px-3 py-2 text-sm shadow-xs transition-colors outline-none
          disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30`,
          'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          className
        )}
        {...triggerProps}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
      </PopoverTrigger>

      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <div className="p-1">
          <Input
            autoFocus
            value={query}
            /* A query that narrows the list invalidates whatever the old one had highlighted. */
            onChange={event => {
              setQuery(event.target.value);
              setHighlighted(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={searchPlaceholder}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={filtered.length ? optionId(highlighted) : undefined}
            className="h-8 border-0 shadow-none focus-visible:ring-0"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul ref={listRef} id={listId} role="listbox" className="max-h-72 overflow-y-auto p-1">
            {filtered.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={option.value === value}
                /*
                  `onMouseDown` rather than `onClick`: the click would land after the popover had
                  already begun closing on the blur, and the pick was lost about one time in five.
                */
                onMouseDown={event => {
                  event.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setHighlighted(index)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                  index === highlighted && 'bg-accent text-accent-foreground'
                )}
              >
                <Check
                  className={cn('size-4 shrink-0', option.value !== value && 'opacity-0')}
                  aria-hidden
                />
                <span className="truncate">{option.label}</span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
