import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useDebouncedInput } from '@/hooks/use-debounced-input';

interface DebouncedInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> {
  value: string | number;
  onCommit: (val: string) => void;
  debounceMs?: number;
}

export function DebouncedInput({
  value,
  onCommit,
  debounceMs = 500,
  ...props
}: DebouncedInputProps) {
  const debounced = useDebouncedInput(
    value !== undefined && value !== null ? String(value) : '',
    onCommit,
    debounceMs
  );

  return (
    <Input
      {...props}
      value={debounced.value}
      onChange={(e) => debounced.onChange(e.target.value)}
      onBlur={debounced.onBlur}
    />
  );
}

interface DebouncedTextareaProps extends Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange'> {
  value: string;
  onCommit: (val: string) => void;
  debounceMs?: number;
}

export function DebouncedTextarea({
  value,
  onCommit,
  debounceMs = 500,
  ...props
}: DebouncedTextareaProps) {
  const debounced = useDebouncedInput(
    value || '',
    onCommit,
    debounceMs
  );

  return (
    <Textarea
      {...props}
      value={debounced.value}
      onChange={(e) => debounced.onChange(e.target.value)}
      onBlur={debounced.onBlur}
    />
  );
}
