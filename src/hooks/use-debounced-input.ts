import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to manage local input state with debounced updates and immediate flush on blur.
 */
export function useDebouncedInput<T = string>(
  value: T,
  onCommit: (val: T) => void,
  delay: number = 600
) {
  const [localVal, setLocalVal] = useState<T>(value);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const isDirtyRef = useRef(false);

  // Sync with incoming external value changes if not actively typing dirty value
  useEffect(() => {
    if (!isDirtyRef.current) {
      setLocalVal(value);
    }
  }, [value]);

  const commit = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isDirtyRef.current) {
      isDirtyRef.current = false;
      onCommitRef.current(localVal);
    }
  }, [localVal]);

  const handleChange = useCallback((newVal: T) => {
    setLocalVal(newVal);
    isDirtyRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      if (isDirtyRef.current) {
        isDirtyRef.current = false;
        onCommitRef.current(newVal);
      }
    }, delay);
  }, [delay]);

  // Clean up timer on unmount and commit any pending change
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    value: localVal,
    onChange: handleChange,
    onBlur: commit,
    commit
  };
}
