import { useState, useCallback } from 'react';

export function useApi<TArgs extends any[], TData>(fn: (...args: TArgs) => Promise<TData>) {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async (...args: TArgs) => {
    setLoading(true); setError(null);
    try {
      const result = await fn(...args);
      setData(result);
      return result;
    } catch (e: any) {
      setError(e?.toString() || 'Erro');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [fn]);

  return { data, loading, error, call };
}
