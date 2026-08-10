import { describe, expect, it } from 'vitest';
import { ApiError, isRequestCancelled, toApiError } from './client';

describe('API errors', () => {
  it('normaliza erros de validação FastAPI com status, campo e request ID', async () => {
    const normalized = await toApiError({
      isAxiosError: true,
      message: 'Request failed',
      code: 'ERR_BAD_REQUEST',
      response: {
        status: 422,
        data: {
          detail: [{ loc: ['body', 'rent_percentage'], msg: 'valor inválido' }],
        },
        headers: { 'x-request-id': 'request-123' },
      },
    });

    expect(normalized).toBeInstanceOf(ApiError);
    expect(normalized.status).toBe(422);
    expect(normalized.requestId).toBe('request-123');
    expect(normalized.validationIssues).toEqual([
      { path: 'rent_percentage', message: 'valor inválido' },
    ]);
    expect(normalized.message).toContain('rent_percentage');
  });

  it('distingue cancelamento de falha visível', async () => {
    const normalized = await toApiError(new DOMException('cancelled', 'AbortError'));

    expect(normalized.cancelled).toBe(true);
    expect(isRequestCancelled(normalized)).toBe(true);
    expect(isRequestCancelled(new Error('network'))).toBe(false);
  });

  it('lê o corpo JSON de erros 422 recebidos como Blob em downloads', async () => {
    const blob = new Blob([], { type: 'application/json' });
    Object.defineProperty(blob, 'text', {
      value: async () => JSON.stringify({
        detail: [{ loc: ['body', 'items', 0], msg: 'preset inválido' }],
      }),
    });

    const normalized = await toApiError({
      isAxiosError: true,
      message: 'Request failed',
      response: {
        status: 422,
        data: blob,
        headers: {},
      },
    });

    expect(normalized.status).toBe(422);
    expect(normalized.validationIssues).toEqual([
      { path: 'items.0', message: 'preset inválido' },
    ]);
    expect(normalized.message).toContain('items.0');
  });

  it.each([
    [404, 'Request failed with status code 404', 'serviço solicitado não foi encontrado'],
    [503, 'Request failed with status code 503', 'falha temporária'],
    [undefined, 'Network Error', 'Não foi possível conectar'],
  ])('localiza falhas de transporte sem expor mensagem técnica (%s)', async (status, raw, expected) => {
    const normalized = await toApiError({
      isAxiosError: true,
      message: raw,
      response: status == null ? undefined : { status, data: null, headers: {} },
    });

    expect(normalized.message).toContain(expected);
    expect(normalized.message).not.toContain(raw);
  });

  it('não exibe HTML de proxy e mantém o código de suporte', async () => {
    const normalized = await toApiError({
      isAxiosError: true,
      message: 'Request failed with status code 404',
      response: {
        status: 404,
        data: '<!doctype html><html><body>Not Found</body></html>',
        headers: { 'x-request-id': 'support-404' },
      },
    });

    expect(normalized.message).toContain('serviço solicitado não foi encontrado');
    expect(normalized.message).toContain('Código de suporte: support-404');
    expect(normalized.message).not.toContain('<html>');
  });
});
