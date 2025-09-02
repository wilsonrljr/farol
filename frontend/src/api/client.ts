import axios from 'axios';
// Vite exposes env vars via import.meta.env; declare minimal typing fallback
interface ViteEnv { VITE_API_BASE?: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (import.meta as any).env as ViteEnv;

export const api = axios.create({
  baseURL: env?.VITE_API_BASE || 'http://localhost:8000'
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    return Promise.reject((error as any).response?.data?.detail || (error as Error).message);
  }
);
