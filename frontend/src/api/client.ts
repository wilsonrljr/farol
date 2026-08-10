import axios, { AxiosError, AxiosHeaders } from 'axios';

interface ViteEnv {
  VITE_API_BASE?: string;
}

const env = (import.meta as { env?: ViteEnv }).env;

export const API_BASE_URL = env?.VITE_API_BASE?.trim() || '';

export interface ApiValidationIssue {
  path: string;
  message: string;
}

interface ApiErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
  validationIssues?: ApiValidationIssue[];
  requestId?: string;
  retryable?: boolean;
  cancelled?: boolean;
  cause?: unknown;
}

/** Error shape kept intact across regular requests and file downloads. */
export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly validationIssues: ApiValidationIssue[];
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly cancelled: boolean;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    if (options.cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        value: options.cause,
        configurable: true,
      });
    }
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.validationIssues = options.validationIssues ?? [];
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? false;
    this.cancelled = options.cancelled ?? false;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isRequestCancelled(error: unknown): boolean {
  return (
    (error instanceof ApiError && error.cancelled) ||
    axios.isCancel(error) ||
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError')
  );
}

function issueFromDetail(item: unknown): ApiValidationIssue {
  if (typeof item === 'string') return { path: '', message: item };

  if (!item || typeof item !== 'object') {
    return { path: '', message: String(item ?? 'Erro') };
  }

  const record = item as Record<string, unknown>;
  const rawMessage =
    typeof record.msg === 'string'
      ? record.msg
      : typeof record.message === 'string'
        ? record.message
        : JSON.stringify(item);
  const path = Array.isArray(record.loc)
    ? record.loc
        .filter((part) => part !== 'body')
        .map(String)
        .join('.')
    : '';

  return { path, message: rawMessage };
}

function validationIssues(detail: unknown): ApiValidationIssue[] {
  if (Array.isArray(detail)) return detail.map(issueFromDetail);
  if (detail !== undefined && detail !== null) return [issueFromDetail(detail)];
  return [];
}

function messageFromDetail(detail: unknown): string | null {
  const issues = validationIssues(detail);
  if (issues.length === 0) return null;
  return issues
    .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message))
    .join('\n');
}

function friendlyHttpFallback(status: number | undefined): string {
  if (status === 404) {
    return 'O serviço solicitado não foi encontrado. Verifique se a aplicação está atualizada e tente novamente.';
  }
  if (status === 429) {
    return 'Foram feitas muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.';
  }
  if (status !== undefined && status >= 500) {
    return 'O serviço encontrou uma falha temporária. Tente novamente em instantes.';
  }
  if (status === undefined) {
    return 'Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.';
  }
  return 'Não foi possível concluir a solicitação. Revise os dados e tente novamente.';
}

function isGenericTransportMessage(message: string | null): boolean {
  if (!message) return true;
  if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(message)) return true;
  return /^(not found|internal server error|bad gateway|service unavailable|gateway timeout|request failed(?: with status code \d+)?|network error)$/i.test(
    message.trim()
  );
}

async function responsePayload(error: AxiosError): Promise<unknown> {
  const data = error.response?.data;
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const text = await data.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch {
      return null;
    }
  }
  return data;
}

function responseRequestId(headers: unknown): string | undefined {
  if (!headers) return undefined;
  if (headers instanceof AxiosHeaders) {
    const value = headers.get('x-request-id');
    return typeof value === 'string' ? value : undefined;
  }
  const value = (headers as Record<string, unknown>)['x-request-id'];
  return typeof value === 'string' ? value : undefined;
}

export async function toApiError(error: unknown): Promise<ApiError> {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const cancelled = axios.isCancel(error) || error.code === 'ERR_CANCELED';
    if (cancelled) {
      return new ApiError('Requisição cancelada', {
        code: error.code,
        cancelled: true,
        cause: error,
      });
    }

    const payload = await responsePayload(error);
    const detail =
      payload && typeof payload === 'object' && 'detail' in payload
        ? (payload as { detail?: unknown }).detail
        : payload;
    const issues = validationIssues(detail);
    const status = error.response?.status;
    const requestId = responseRequestId(error.response?.headers);
    const detailedMessage = messageFromDetail(detail);
    const baseMessage = isGenericTransportMessage(detailedMessage)
      ? friendlyHttpFallback(status)
      : detailedMessage!;
    const message = requestId
      ? `${baseMessage} Código de suporte: ${requestId}.`
      : baseMessage;

    return new ApiError(message, {
      status,
      code: error.code,
      details: payload,
      validationIssues: issues,
      requestId,
      retryable: status === 429 || status === undefined || status >= 500,
      cause: error,
    });
  }

  if (
    typeof DOMException !== 'undefined' &&
    error instanceof DOMException &&
    error.name === 'AbortError'
  ) {
    return new ApiError('Requisição cancelada', { cancelled: true, cause: error });
  }

  if (error instanceof Error) {
    return new ApiError(error.message, { cause: error });
  }

  return new ApiError(typeof error === 'string' ? error : 'Erro inesperado', {
    details: error,
  });
}

export const api = axios.create({
  baseURL: API_BASE_URL,
});

function safeRequestId(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

api.interceptors.request.use((config) => {
  config.headers = config.headers ?? new AxiosHeaders();
  config.headers.set('Cache-Control', 'no-store');
  config.headers.set('Pragma', 'no-cache');
  config.headers.set('X-Request-ID', safeRequestId());
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => Promise.reject(await toApiError(error))
);
