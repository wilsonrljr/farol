import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { FormWizard } from './FormWizard';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const steps = [
  { label: 'Imóvel' },
  { label: 'Recursos' },
  { label: 'Premissas' },
  { label: 'Revisão' },
];

describe('FormWizard', () => {
  it('allows only the next unvisited step and keeps progress after navigating back', () => {
    const onStepClick = vi.fn();
    const { rerender } = render(
      <MantineProvider>
        <FormWizard
          steps={steps}
          active={0}
          furthest={0}
          completed={[false, false, false, false]}
          onStepClick={onStepClick}
        >
          <div>Conteúdo</div>
        </FormWizard>
      </MantineProvider>
    );

    expect(
      screen.getByRole('button', { name: 'Ir para a etapa 2: Recursos' })
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'Ir para a etapa 3: Premissas' })
    ).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('0% dos dados validados')).toHaveLength(2);

    fireEvent.click(
      screen.getByRole('button', { name: 'Ir para a etapa 2: Recursos' })
    );
    expect(onStepClick).toHaveBeenCalledWith(1);

    rerender(
      <MantineProvider>
        <FormWizard
          steps={steps}
          active={0}
          furthest={2}
          completed={[true, true, true, false]}
          onStepClick={onStepClick}
        >
          <div>Conteúdo</div>
        </FormWizard>
      </MantineProvider>
    );

    expect(screen.getAllByLabelText('75% dos dados validados')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Ir para a etapa 4: Revisão' })
    ).toBeEnabled();
  });
});
