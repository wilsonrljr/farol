import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Preset } from '../utils/presets';
import { PresetManager } from './PresetManager';

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(() => vi.mocked(notifications.show).mockClear());
afterEach(cleanup);

function presets(count: number): Preset<{ value: number }>[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `preset-${index + 1}`,
    name: `Cenário ${index + 1}`,
    createdAt: index + 1,
    input: { value: index + 1 },
  }));
}

function renderManager(
  items: Preset<{ value: number }>[],
  options: {
    onCompare?: (selected: Preset<{ value: number }>[]) => void;
    onBeforeSave?: () => boolean;
  } = {}
) {
  return render(
    <MantineProvider>
      <PresetManager
        presets={items}
        onBeforeSave={options.onBeforeSave}
        onSave={() => true}
        onLoad={() => {}}
        onDelete={() => true}
        onDuplicate={() => true}
        onEdit={() => true}
        onExportAll={() => {}}
        onExportSelected={() => {}}
        onImport={async () => ({ success: true, presets: [] })}
        onClearAll={() => true}
        onCompare={options.onCompare}
      />
    </MantineProvider>
  );
}

describe('PresetManager comparison flow', () => {
  it('limits a batch to 10 and closes the modal when comparison starts', async () => {
    const items = presets(11);
    const onCompare = vi.fn();
    renderManager(items, { onCompare });

    fireEvent.click(screen.getByRole('button', { name: /Cenários salvos/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Comparar' }));
    for (const item of items.slice(0, 10)) {
      fireEvent.click(screen.getByText(item.name).closest('[role="button"]')!);
    }
    expect(screen.getByRole('status')).toHaveTextContent('Limite de 10 cenários atingido');

    fireEvent.click(screen.getByText(items[10].name).closest('[role="button"]')!);
    expect(notifications.show).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Limite de cenários atingido' })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Comparar Agora' }));
    expect(onCompare).toHaveBeenCalledWith(items.slice(0, 10));
    expect(notifications.show).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Comparação iniciada' })
    );
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Cenários salvos' })).not.toBeInTheDocument()
    );
  });

  it('validates before opening the save modal', () => {
    const onBeforeSave = vi.fn(() => false);
    renderManager([], { onBeforeSave });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar cenário' }));
    expect(onBeforeSave).toHaveBeenCalledOnce();
    expect(screen.queryByRole('heading', { name: 'Salvar cenário' })).not.toBeInTheDocument();
  });
});
