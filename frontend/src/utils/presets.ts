export type Preset<T> = {
  id: string;
  name: string;
  createdAt: number;
  input: T;
};

export function newPresetId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function loadPresets<T>(storageKey: string): Preset<T>[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Preset<T>[];
  } catch {
    return [];
  }
}

export function savePresets<T>(storageKey: string, presets: Preset<T>[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(presets));
}
