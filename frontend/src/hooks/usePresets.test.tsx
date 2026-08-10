import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESET_EXPORT_VERSION } from '../utils/presets';
import { usePresets } from './usePresets';

const values = new Map<string, string>();
const setItem = vi.fn((key: string, value: string) => values.set(key, String(value)));
const storage: Storage = {
  get length() {
    return values.size;
  },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  key: (index) => [...values.keys()][index] ?? null,
  removeItem: (key) => values.delete(key),
  setItem,
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: storage,
});

const isInput = (value: unknown): value is { amount: number } =>
  value !== null &&
  typeof value === 'object' &&
  typeof (value as { amount?: unknown }).amount === 'number';

function envelope(id: string, amount: number) {
  return JSON.stringify({
    version: PRESET_EXPORT_VERSION,
    exportedAt: 1,
    presets: [{
      id,
      name: id,
      createdAt: 1,
      updatedAt: 1,
      input: { amount },
      tags: [],
    }],
  });
}

beforeEach(() => {
  values.clear();
  setItem.mockClear();
});

describe('usePresets cross-tab persistence', () => {
  it('carrega a migração validada do storage legado sem ecoar outra gravação', async () => {
    values.set('presets-legacy', envelope('legado', 7));
    const { result } = renderHook(() => usePresets({
      storageKey: 'presets-v4',
      legacyStorageKeys: ['presets-legacy'],
      validateInput: isInput,
    }));

    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(result.current.presets[0]?.id).toBe('legado');
    expect(values.has('presets-legacy')).toBe(false);
    expect(values.has('presets-v4')).toBe(true);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('não regrava o carregamento inicial nem ecoa uma alteração recebida de outra aba', async () => {
    values.set('presets', envelope('inicial', 1));
    const { result } = renderHook(() => usePresets({
      storageKey: 'presets',
      validateInput: isInput,
    }));

    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(result.current.presets[0]?.id).toBe('inicial');
    expect(setItem).not.toHaveBeenCalled();

    values.set('presets', envelope('externo', 2));
    const storageEvent = new Event('storage');
    Object.defineProperties(storageEvent, {
      key: { value: 'presets' },
      storageArea: { value: storage },
    });
    act(() => window.dispatchEvent(storageEvent));

    await waitFor(() => expect(result.current.presets[0]?.id).toBe('externo'));
    expect(setItem).not.toHaveBeenCalled();
  });

  it('não anuncia nem mantém um preset quando a gravação falha', async () => {
    const { result } = renderHook(() => usePresets({
      storageKey: 'presets',
      validateInput: isInput,
    }));

    await waitFor(() => expect(result.current.initialized).toBe(true));
    setItem.mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    let saved: ReturnType<typeof result.current.addPreset> = null;
    act(() => {
      saved = result.current.addPreset('Sem espaço', { amount: 10 });
    });

    expect(saved).toBeNull();
    expect(result.current.presets).toHaveLength(0);
    expect(result.current.storageError).toContain('Não foi possível salvar');
  });
});
