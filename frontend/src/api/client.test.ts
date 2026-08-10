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
});
