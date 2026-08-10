import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { theme } from '../../theme';
import ComparisonJourney from './ComparisonJourney';

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}));

vi.mock('../PresetManager', () => ({
  PresetManager: () => null,
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
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });
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
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
  });
});

beforeEach(() => {
  vi.mocked(notifications.show).mockClear();
  window.localStorage.clear();
});

afterEach(cleanup);

function renderJourney() {
  return render(
    <MantineProvider theme={theme} forceColorScheme="light">
      <ComparisonJourney />
    </MantineProvider>
  );
}

describe('ComparisonJourney', () => {
  it('does not mark valid future defaults as completed before they are reached', () => {
    renderJourney();
    expect(screen.getAllByLabelText('0% dos dados validados')).toHaveLength(2);
  });

  it('keeps the user on the current step when required data is invalid', async () => {
    renderJourney();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));

    expect(
      screen.getByRole('heading', { name: 'Imóvel e alternativa de aluguel' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Revise esta etapa', color: 'red' })
      )
    );
  });

  it('advances a complete draft and preserves furthest progress after going back', async () => {
    renderJourney();

    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));

    await screen.findByRole('heading', { name: 'Entrada e forma de pagamento' });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));

    await screen.findByRole('heading', { name: 'Seu orçamento mensal' });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));

    await screen.findByRole('heading', { name: 'Premissas e detalhes do plano' });
    expect(screen.getAllByLabelText('80% dos dados validados')).toHaveLength(2);

    fireEvent.click(
      screen.getByRole('button', { name: 'Ir para a etapa 1: Moradia' })
    );

    await screen.findByRole('heading', { name: 'Imóvel e alternativa de aluguel' });
    expect(screen.getAllByLabelText('80% dos dados validados')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Ir para a etapa 5: Revisão' })
    ).toBeEnabled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Preço do imóvel' }), {
      target: { value: '' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Ir para a etapa 2: Compra' })
    );

    expect(
      screen.getByRole('heading', { name: 'Imóvel e alternativa de aluguel' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(notifications.show).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: 'Revise esta etapa', color: 'red' })
      )
    );
  });

  it('asks before replacing a draft with the example', async () => {
    renderJourney();

    fireEvent.change(screen.getByRole('textbox', { name: 'Preço do imóvel' }), {
      target: { value: '450000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));

    expect(
      await screen.findByRole('heading', { name: 'Substituir os dados atuais?' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manter meus dados' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Substituir os dados atuais?' })
      ).not.toBeInTheDocument()
    );
  });

  it('uses Enter to advance the journey instead of skipping review and submitting', async () => {
    const { container } = renderJourney();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(
      await screen.findByRole('heading', { name: 'Entrada e forma de pagamento' })
    ).toBeInTheDocument();
    expect(
      notifications.show
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Comparação concluída' })
    );
  });

  it('focuses the first concrete monthly field when the plan is incomplete', async () => {
    renderJourney();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Entrada e forma de pagamento' });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Seu orçamento mensal' });

    const income = screen.getByRole('textbox', { name: /Renda líquida mensal/ });
    fireEvent.change(income, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));

    await waitFor(() => expect(document.activeElement).toBe(income));
    expect(
      screen.getByRole('heading', { name: 'Seu orçamento mensal' })
    ).toBeInTheDocument();
  });

  it('reopens a collapsed section when it contains the blocking error', async () => {
    renderJourney();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Editar custos para comprar' })
    );

    const itbi = screen.getByLabelText('ITBI');
    fireEvent.change(itbi, { target: { value: '' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Ocultar custos para comprar' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));

    expect(
      screen.getByRole('heading', { name: 'Imóvel e alternativa de aluguel' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Ocultar custos para comprar' })
      ).toHaveAttribute(
        'aria-expanded',
        'true'
      )
    );
    expect(screen.getByText(/Informe o ITBI/)).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(itbi));
  });

  it('gives every optional-module action a contextual accessible name', async () => {
    renderJourney();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Entrada e forma de pagamento' });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Seu orçamento mensal' });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Premissas e detalhes do plano' });

    expect(screen.getByRole('button', { name: 'Adicionar retornos por período' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Adicionar imposto sobre investimentos' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Adicionar 13º, bônus ou renda extra' })).toBeEnabled();
  });

  it('keeps the edited first-period return when period mode is disabled', async () => {
    renderJourney();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Entrada e forma de pagamento' });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Seu orçamento mensal' });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Premissas e detalhes do plano' });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar retornos por período' }));
    const periodRate = screen.getByRole('textbox', { name: /Taxa anual/ });
    fireEvent.change(periodRate, { target: { value: '9.5' } });
    fireEvent.click(
      screen.getByRole('button', { name: 'Desativar retornos por período' })
    );

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /Retorno nominal anual esperado/ })).toHaveValue('9.5% a.a.')
    );
  });

  it('opens nested return editors and focuses the invalid rate', async () => {
    renderJourney();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Entrada e forma de pagamento' });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Seu orçamento mensal' });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Premissas e detalhes do plano' });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar retornos por período' }));
    const periodRate = screen.getByRole('textbox', { name: /Taxa anual/ });
    fireEvent.change(periodRate, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Retorno 1/ }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Recolher retornos por período' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));

    expect(
      screen.getByRole('heading', { name: 'Premissas e detalhes do plano' })
    ).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(periodRate));
  });

  it('keeps a cleared return-period end visible and blocks the next step', async () => {
    renderJourney();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Entrada e forma de pagamento' });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Seu orçamento mensal' });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Premissas e detalhes do plano' });

    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar retornos por período' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    const firstPeriodEnd = screen.getAllByRole('textbox', {
      name: 'Mês final',
    })[0];
    fireEvent.change(firstPeriodEnd, { target: { value: '' } });
    expect(firstPeriodEnd).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    expect(
      screen.getByRole('heading', { name: 'Premissas e detalhes do plano' })
    ).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(firstPeriodEnd));
  });

  it('removes financing-only controls when cash and FGTS cover the property', async () => {
    renderJourney();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Entrada e forma de pagamento' });

    fireEvent.change(screen.getByRole('textbox', { name: 'Entrada em dinheiro' }), {
      target: { value: '500000' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /Dinheiro disponível hoje/ }), {
      target: { value: '515000' },
    });

    await waitFor(() =>
      expect(screen.getByText('Compra à vista')).toBeInTheDocument()
    );
    expect(screen.queryByRole('textbox', { name: 'Prazo do financiamento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Taxa efetiva de juros' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Seu orçamento mensal' });
    expect(screen.getByText('Quanto da sobra constrói patrimônio?')).toBeInTheDocument();
    expect(screen.queryByText('Na compra financiada')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Premissas e detalhes do plano' });
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Revisão da comparação' });
    expect(screen.getByText(/À vista · entrada em dinheiro/)).toBeInTheDocument();
    expect(screen.getByText(/100% do valor destinado a patrimônio vai para investimentos/)).toBeInTheDocument();
    expect(screen.queryByText(/Na compra: .*amortizar/)).not.toBeInTheDocument();
  });

  it('keeps the visible FGTS eligibility month synchronized when purchase use changes', async () => {
    renderJourney();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Entrada e forma de pagamento' });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar fgts' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Saldo atual' }), {
      target: { value: '50000' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Usar FGTS na compra' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Usar FGTS em amortizações futuras' })
    );

    const firstMonth = screen.getByRole('textbox', {
      name: 'Primeira amortização',
    });
    expect(firstMonth).toHaveValue('24º mês');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Usar FGTS na compra' }));
    await waitFor(() => expect(firstMonth).toHaveValue('25º mês'));

    fireEvent.change(firstMonth, { target: { value: '36' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Usar FGTS na compra' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Usar FGTS na compra' }));
    expect(firstMonth).toHaveValue('36º mês');
  });

  it('reacts when a later balance change creates an FGTS withdrawal at purchase', async () => {
    renderJourney();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Entrada e forma de pagamento' });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar fgts' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Usar FGTS em amortizações futuras' })
    );
    const firstMonth = screen.getByRole('textbox', {
      name: 'Primeira amortização',
    });
    expect(firstMonth).toHaveValue('24º mês');

    fireEvent.change(screen.getByRole('textbox', { name: 'Saldo atual' }), {
      target: { value: '50000' },
    });
    await waitFor(() => expect(firstMonth).toHaveValue('25º mês'));

    fireEvent.change(firstMonth, { target: { value: '36' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Saldo atual' }), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Saldo atual' }), {
      target: { value: '50000' },
    });
    expect(firstMonth).toHaveValue('36º mês');
  });

  it('does not create an invalid annual rate when changing representation', async () => {
    renderJourney();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher exemplo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próxima etapa' }));
    await screen.findByRole('heading', { name: 'Entrada e forma de pagamento' });

    fireEvent.click(screen.getByText('Taxa mensal'));
    const rate = screen.getByRole('textbox', { name: 'Taxa efetiva de juros' });
    fireEvent.change(rate, { target: { value: '50' } });
    fireEvent.click(screen.getByText('Taxa anual'));

    expect(screen.getByRole('radio', { name: 'Taxa mensal' })).toBeChecked();
    expect(notifications.show).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Taxa fora do limite', color: 'yellow' })
    );
  });
});
