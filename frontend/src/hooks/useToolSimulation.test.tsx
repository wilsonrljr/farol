import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useToolSimulation } from './useToolSimulation';

interface PendingRun {
  signal: AbortSignal;
  resolve: (value: string) => void;
}

describe('useToolSimulation', () => {
  it('aborta e descarta o resultado quando o usuário altera a entrada submetida', async () => {
    const pending: PendingRun[] = [];
    const runner = (_input: { value: number }, signal: AbortSignal) =>
      new Promise<string>((resolve) => pending.push({ signal, resolve }));
    const { result, rerender } = renderHook(
      ({ value }) => useToolSimulation({ value }, runner),
      { initialProps: { value: 1 } }
    );

    let firstRun!: ReturnType<typeof result.current.simulate>;
    act(() => {
      firstRun = result.current.simulate();
    });
    rerender({ value: 2 });

    expect(pending[0].signal.aborted).toBe(true);
    await act(async () => {
      pending[0].resolve('antigo');
      expect(await firstRun).toBeNull();
    });
    expect(result.current.result).toBeNull();
    expect(result.current.lastInput).toBeNull();

    let secondRun!: ReturnType<typeof result.current.simulate>;
    act(() => {
      secondRun = result.current.simulate();
    });
    await act(async () => {
      pending[1].resolve('novo');
      expect(await secondRun).toBe('novo');
    });

    expect(result.current.result).toBe('novo');
    expect(result.current.lastInput).toEqual({ value: 2 });
  });
});
