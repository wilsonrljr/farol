// Predefined tag types with semantic meaning
export type PresetTagType =
  | 'conservative'
  | 'moderate'
  | 'aggressive'
  | 'optimistic'
  | 'pessimistic'
  | 'high-rate'
  | 'low-rate'
  | 'with-fgts'
  | 'sac'
  | 'price'
  | 'custom';

export interface PresetTag {
  id: string;
  label: string;
  type: PresetTagType;
  color: string;
}

// Default tag definitions
export const DEFAULT_TAGS: Record<PresetTagType, Omit<PresetTag, 'id'>> = {
  conservative: { label: 'Conservador', type: 'conservative', color: 'blue' },
  moderate: { label: 'Moderado', type: 'moderate', color: 'ocean' },
  aggressive: { label: 'Agressivo', type: 'aggressive', color: 'orange' },
  optimistic: { label: 'Otimista', type: 'optimistic', color: 'green' },
  pessimistic: { label: 'Pessimista', type: 'pessimistic', color: 'red' },
  'high-rate': { label: 'Taxa Alta', type: 'high-rate', color: 'pink' },
  'low-rate': { label: 'Taxa Baixa', type: 'low-rate', color: 'cyan' },
  'with-fgts': { label: 'Com FGTS', type: 'with-fgts', color: 'grape' },
  sac: { label: 'SAC', type: 'sac', color: 'indigo' },
  price: { label: 'PRICE', type: 'price', color: 'teal' },
  custom: { label: 'Personalizado', type: 'custom', color: 'gray' },
};

export function createTag(type: PresetTagType, customLabel?: string): PresetTag {
  const base = DEFAULT_TAGS[type];
  return {
    id: `${type}-${Date.now()}`,
    ...base,
    label: customLabel || base.label,
  };
}

export type Preset<T> = {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt?: number;
  input: T;
  tags?: PresetTag[];
};

export interface PresetExport<T> {
  version: number;
  exportedAt: number;
  presets: Preset<T>[];
}

const EXPORT_VERSION = 1;

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

export function createPreset<T>(name: string, input: T, description?: string, tags?: PresetTag[]): Preset<T> {
  return {
    id: newPresetId(),
    name,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    input,
    tags: tags || [],
  };
}

export function updatePreset<T>(preset: Preset<T>, updates: Partial<Pick<Preset<T>, 'name' | 'description' | 'input' | 'tags'>>): Preset<T> {
  return {
    ...preset,
    ...updates,
    updatedAt: Date.now(),
  };
}

export function exportPresetsToJson<T>(presets: Preset<T>[]): string {
  const exportData: PresetExport<T> = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    presets,
  };
  return JSON.stringify(exportData, null, 2);
}

export function downloadPresetsFile<T>(presets: Preset<T>[], filename = 'farol-presets.json') {
  const json = exportPresetsToJson(presets);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

export interface ImportResult<T> {
  success: boolean;
  presets: Preset<T>[];
  error?: string;
  duplicatesSkipped?: number;
}

export function parsePresetsFromJson<T>(json: string, existingIds: Set<string>): ImportResult<T> {
  try {
    const parsed = JSON.parse(json);
    
    // Handle both array format (legacy) and object format (new export)
    let presets: Preset<T>[];
    
    if (Array.isArray(parsed)) {
      presets = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.presets)) {
      presets = parsed.presets;
    } else {
      return { success: false, presets: [], error: 'Formato de arquivo inválido' };
    }

    // Validate preset structure
    const validPresets: Preset<T>[] = [];
    let duplicatesSkipped = 0;

    for (const preset of presets) {
      if (!isValidPreset(preset)) {
        continue; // skip invalid presets
      }
      
      // Skip duplicates by ID
      if (existingIds.has(preset.id)) {
        duplicatesSkipped++;
        continue;
      }

      validPresets.push({
        ...preset,
        // Ensure required fields exist
        createdAt: preset.createdAt || Date.now(),
        updatedAt: preset.updatedAt || Date.now(),
      });
    }

    if (validPresets.length === 0 && presets.length > 0) {
      if (duplicatesSkipped === presets.length) {
        return { success: false, presets: [], error: 'Todos os presets já existem', duplicatesSkipped };
      }
      return { success: false, presets: [], error: 'Nenhum preset válido encontrado' };
    }

    return { success: true, presets: validPresets, duplicatesSkipped };
  } catch {
    return { success: false, presets: [], error: 'Erro ao analisar arquivo JSON' };
  }
}

function isValidPreset<T>(obj: unknown): obj is Preset<T> {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    p.name.trim().length > 0 &&
    p.input !== undefined &&
    p.input !== null
  );
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file);
  });
}
