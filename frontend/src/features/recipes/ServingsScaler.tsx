import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '../../components/ui/Button';

const MAX_SERVINGS = 10_000;

interface ServingsScalerProps {
  baseServings: number;
  value: number;
  onChange: (servings: number) => void;
}

/** Lets the user view a recipe for a different number of servings. */
export function ServingsScaler({ baseServings, value, onChange }: ServingsScalerProps) {
  const id = useId();
  // The text field keeps its own draft so it can be cleared while typing a new number.
  const [text, setText] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    // Value changed from outside (+/-, reset): adopt it (React's "adjust state on prop change").
    setSyncedValue(value);
    setText(String(value));
  }
  const set = (next: number) => onChange(Math.min(MAX_SERVINGS, Math.max(1, Math.round(next))));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium text-stone-700">
        Scale to
      </label>
      <div className="flex items-center rounded-lg border border-stone-300 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => set(value - 1)}
          disabled={value <= 1}
          aria-label="Decrease servings"
          className="flex size-9 items-center justify-center text-stone-600 hover:bg-stone-50 disabled:opacity-40"
        >
          <Minus aria-hidden="true" className="size-4" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_SERVINGS}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value.trim() && Number.isFinite(n) && n >= 1) set(n);
          }}
          onBlur={() => setText(String(value))}
          className="h-9 w-16 border-x border-stone-200 text-center text-sm tabular-nums focus:outline-none"
        />
        <button
          type="button"
          onClick={() => set(value + 1)}
          aria-label="Increase servings"
          className="flex size-9 items-center justify-center text-stone-600 hover:bg-stone-50"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>
      <span className="text-sm text-stone-600">servings</span>
      {value !== baseServings && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(baseServings)}
          icon={<RotateCcw aria-hidden="true" className="size-3.5" />}
        >
          Reset to {baseServings}
        </Button>
      )}
    </div>
  );
}
