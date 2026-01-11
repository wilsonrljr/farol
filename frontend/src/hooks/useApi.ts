import { useState, useCallback, useRef } from 'react';

export function useApi<TArgs extends any[], TData>(fn: (...args: TArgs) => Promise<TData>) {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store fn in a ref so we always call the latest version without re-creating `call`
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // Protect against out-of-order responses when users trigger multiple calls quickly
  // (e.g. first request slow/cold-start, second request returns first).
  const latestCallId = useRef(0);

  const call = useCallback(async (...args: TArgs) => {
    const callId = ++latestCallId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      // Only commit the latest call.
      if (callId === latestCallId.current) {
        setData(result);
      }
      return result;
    } catch (e: any) {
      if (callId === latestCallId.current) {
        setError(e?.toString() || 'Erro');
      }
      throw e;
    } finally {
      if (callId === latestCallId.current) {
        setLoading(false);
      }
    }
  }, []); // No dependencies - fnRef.current is always up to date

  const reset = useCallback(() => {
    // Invalidate any in-flight call and clear state.
    latestCallId.current += 1;
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, call, reset };
}
