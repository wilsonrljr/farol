import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiCallContext, useApi } from './useApi';

interface PendingExecution {
  signal: AbortSignal;
  resolve: (value: string) => void;
}

describe('useApi', () => {
  it('aborta a chamada anterior e impede resposta antiga de sobrescrever a nova', async () => {
    const executions: PendingExecution[] = [];
    const executor = (_value: string, { signal }: ApiCallContext) =>
      new Promise<string>((resolve) => executions.push({ signal, resolve }));
    const { result } = renderHook(() => useApi<[string], string>(executor));

    let firstCall!: ReturnType<typeof result.current.call>;
    let secondCall!: ReturnType<typeof result.current.call>;
    act(() => {
      firstCall = result.current.call('first');
    });
    act(() => {
      secondCall = result.current.call('second');
    });

    expect(executions[0].signal.aborted).toBe(true);
    expect(executions[1].signal.aborted).toBe(false);

    await act(async () => {
      executions[0].resolve('stale');
      expect(await firstCall).toMatchObject({ committed: false });
      executions[1].resolve('fresh');
      expect(await secondCall).toEqual({
        committed: true,
        cancelled: false,
        data: 'fresh',
      });
    });

    expect(result.current.data).toBe('fresh');
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
