import { useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from './useApi';
import { clonePresetValue } from '../utils/presets';

/**
 * Simulation state shared by the standalone tools.
 *
 * A result is tied to an immutable input snapshot. Editing any field aborts an
 * in-flight request and removes the now-stale result; a late response can never
 * overwrite a newer interaction.
 */
export function useToolSimulation<TInput, TResult>(
  input: TInput,
  runner: (input: TInput, signal: AbortSignal) => Promise<TResult>
) {
  const inputSignature = useMemo(() => JSON.stringify(input), [input]);
  const submittedSignatureRef = useRef<string | null>(null);
  const [lastInput, setLastInput] = useState<TInput | null>(null);
  const { data, loading, error, call, reset } = useApi<[TInput], TResult>(
    (snapshot, { signal }) => runner(snapshot, signal)
  );

  useEffect(() => {
    const submitted = submittedSignatureRef.current;
    if (submitted == null || submitted === inputSignature) return;
    submittedSignatureRef.current = null;
    setLastInput(null);
    reset();
  }, [inputSignature, reset]);

  const simulate = async (): Promise<TResult | null> => {
    const snapshot = clonePresetValue(input);
    submittedSignatureRef.current = JSON.stringify(snapshot);
    setLastInput(null);
    try {
      const outcome = await call(snapshot);
      if (!outcome.committed) return null;
      setLastInput(snapshot);
      return outcome.data;
    } catch (caught) {
      submittedSignatureRef.current = null;
      throw caught;
    }
  };

  return {
    result: data,
    loading,
    error,
    lastInput,
    simulate,
    reset,
  };
}
