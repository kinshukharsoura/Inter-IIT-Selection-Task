import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../api/client';
import type { Ingredient, UnitDefinition } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/FormControls';
import { useCreateIngredient } from './queries';

interface NewIngredientInlineProps {
  units: UnitDefinition[];
  onCreated: (ingredient: Ingredient) => void;
  onCancel: () => void;
}

/** Small inline form to add a missing ingredient without leaving the recipe editor. */
export function NewIngredientInline({ units, onCreated, onCancel }: NewIngredientInlineProps) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('g');
  const [error, setError] = useState<string>();
  const create = useCreateIngredient();

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      const ingredient = await create.mutateAsync({ name: name.trim(), defaultUnit: unit });
      toast.success(`Ingredient "${ingredient.name}" created`);
      onCreated(ingredient);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="New ingredient name" error={error} className="min-w-40 flex-1">
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={name}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
          )}
        </Field>
        <Field label="Default unit" className="w-28">
          {({ id }) => (
            <Select id={id} value={unit} onChange={(e) => setUnit(e.target.value)}>
              {units.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.code}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button size="md" onClick={() => void submit()} loading={create.isPending}>
          Add
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
