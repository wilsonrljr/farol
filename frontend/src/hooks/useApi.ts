import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, isRequestCancelled, toApiError } from '../api/client';

export interface ApiCallContext {
  signal: AbortSignal;
  callId: number;
}

export type ApiCallOutcome<TData> =
  | { committed: true; cancelled: false; data: TData }
  | { committed: false; cancelled: boolean; data: null };

/**
 * Runs one request at a time. Starting a new call aborts the previous one and
 * stale executors are never allowed to commit data or surface errors.
 */
export function useApi<TArgs extends unknown[], TData>(
  fn: (...args: [...TArgs, ApiCallContext]) => Promise<TData>
) {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const latestCallId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const call = useCallback(async (...args: TArgs): Promise<ApiCallOutcome<TData>> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const callId = ++latestCallId.current;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await fnRef.current(...args, { signal: controller.signal, callId });
      if (callId !== latestCallId.current || controller.signal.aborted) {
        return { committed: false, cancelled: controller.signal.aborted, data: null };
      }

      setData(result);
      return { committed: true, cancelled: false, data: result };
    } catch (caught) {
      const normalized = await toApiError(caught);
      const stale = callId !== latestCallId.current;
      const cancelled = controller.signal.aborted || isRequestCancelled(normalized);

      if (stale || cancelled) {
        return { committed: false, cancelled, data: null };
      }

      setError(normalized);
      throw normalized;
    } finally {
      if (callId === latestCallId.current) {
        setLoading(false);
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    }
  }, []);

  const reset = useCallback(() => {
    latestCallId.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(
    () => () => {
      latestCallId.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
    },
    []
  );

  return { data, loading, error, call, reset, cancel: reset };
}
