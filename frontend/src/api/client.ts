import axios from 'axios';
// Vite exposes env vars via import.meta.env; declare minimal typing fallback
interface ViteEnv { VITE_API_BASE?: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (import.meta as any).env as ViteEnv;

function formatFastApiValidationDetail(detail: unknown): string {
  const formatOne = (item: any): string => {
    const msg =
      typeof item?.msg === 'string'
        ? item.msg
        : typeof item?.message === 'string'
          ? item.message
          : typeof item === 'string'
            ? item
            : JSON.stringify(item);

    const loc = Array.isArray(item?.loc)
      ? item.loc
          .filter((p: unknown) => p !== 'body')
          .map((p: unknown) => String(p))
          .join('.')
      : '';

    return loc ? `${loc}: ${msg}` : msg;
  };

  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(formatOne).join('\n');
  }
  if (detail && typeof detail === 'object') {
    return formatOne(detail);
  }
  return 'Erro';
}

function formatAxiosError(error: unknown): string {
  const err: any = error;
  const detail = err?.response?.data?.detail;
  if (detail !== undefined) {
    return formatFastApiValidationDetail(detail);
  }
  if (typeof err?.message === 'string') return err.message;
  if (typeof err === 'string') return err;
  return 'Erro';
}

export const api = axios.create({
  baseURL: env?.VITE_API_BASE || 'http://localhost:8000'
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    return Promise.reject(formatAxiosError(error));
  }
);
