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
    id: `${type}-${newPresetId()}`,
    ...base,
    label: customLabel?.trim().slice(0, MAX_PRESET_TAG_LABEL_LENGTH) || base.label,
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

export type PresetInputValidator<T> = (input: unknown) => input is T;

export interface PresetStorageResult<T> {
  presets: Preset<T>[];
  version: number;
  migrated: boolean;
  error?: string;
  invalidSkipped?: number;
  duplicatesSkipped?: number;
}

export interface PresetSaveResult {
  success: boolean;
  error?: string;
}

export interface PresetStorageMigrationResult {
  attempted: boolean;
  migrated: boolean;
  /** Blocks writes to the destination so recoverable legacy data is not hidden. */
  blocking: boolean;
  error?: string;
}

export interface ImportResult<T> {
  success: boolean;
  presets: Preset<T>[];
  error?: string;
  duplicatesSkipped?: number;
  invalidSkipped?: number;
}

export const PRESET_EXPORT_VERSION = 3;
export const MAX_PRESET_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_PRESETS_PER_FILE = 100;
export const MAX_PRESET_TAGS = 20;
export const MAX_PRESET_ID_LENGTH = 128;
export const MAX_PRESET_NAME_LENGTH = 120;
export const MAX_PRESET_DESCRIPTION_LENGTH = 1000;
export const MAX_PRESET_TAG_LABEL_LENGTH = 64;

export function newPresetId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** Clone at every persistence boundary so form edits cannot mutate saved presets. */
export function clonePresetValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    try {
      return globalThis.structuredClone(value);
    } catch {
      // Plain JSON-compatible financial inputs are handled by the fallback.
    }
  }

  if (value === undefined || value === null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPresetTag(value: unknown): value is PresetTag {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    value.id.trim().length <= MAX_PRESET_ID_LENGTH &&
    typeof value.label === 'string' &&
    value.label.trim().length > 0 &&
    value.label.trim().length <= MAX_PRESET_TAG_LABEL_LENGTH &&
    typeof value.type === 'string' &&
    value.type in DEFAULT_TAGS &&
    typeof value.color === 'string' &&
    value.color.length <= 32
  );
}

function normalizePreset<T>(
  value: unknown,
  validateInput?: PresetInputValidator<T>
): Preset<T> | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string' ||
    value.id.trim().length === 0 ||
    value.id.trim().length > MAX_PRESET_ID_LENGTH
  ) return null;
  if (
    typeof value.name !== 'string' ||
    value.name.trim().length === 0 ||
    value.name.trim().length > MAX_PRESET_NAME_LENGTH
  ) return null;
  if (
    typeof value.description === 'string' &&
    value.description.trim().length > MAX_PRESET_DESCRIPTION_LENGTH
  ) return null;
  if (value.input === undefined || value.input === null) return null;
  if (validateInput && !validateInput(value.input)) return null;
  if (value.tags !== undefined && !Array.isArray(value.tags)) return null;
  if (Array.isArray(value.tags) && value.tags.length > MAX_PRESET_TAGS) return null;
  if (Array.isArray(value.tags) && !value.tags.every(isPresetTag)) return null;

  const now = Date.now();
  const tags = Array.isArray(value.tags)
    ? value.tags.filter(isPresetTag).map((tag) => clonePresetValue(tag))
    : [];

  return {
    id: value.id.trim(),
    name: value.name.trim(),
    description:
      typeof value.description === 'string' && value.description.trim()
        ? value.description.trim()
        : undefined,
    createdAt: isFiniteTimestamp(value.createdAt) ? value.createdAt : now,
    updatedAt: isFiniteTimestamp(value.updatedAt) ? value.updatedAt : now,
    input: clonePresetValue(value.input as T),
    tags,
  };
}

interface ExtractedPayload {
  version: number;
  presets: unknown[];
  migrated: boolean;
}

function extractPayload(value: unknown): ExtractedPayload | string {
  if (Array.isArray(value)) {
    if (value.length > MAX_PRESETS_PER_FILE) {
      return `O arquivo pode conter no máximo ${MAX_PRESETS_PER_FILE} presets`;
    }
    return { version: 0, presets: value, migrated: true };
  }

  if (!isRecord(value) || !Array.isArray(value.presets)) {
    return 'Formato de presets inválido';
  }
  if (value.presets.length > MAX_PRESETS_PER_FILE) {
    return `O arquivo pode conter no máximo ${MAX_PRESETS_PER_FILE} presets`;
  }

  const version = value.version === undefined ? 1 : Number(value.version);
  if (!Number.isInteger(version) || version < 0) return 'Versão de presets inválida';
  if (version > PRESET_EXPORT_VERSION) {
    return `Versão de presets não suportada (${version}). Atualize o Farol antes de importar.`;
  }

  return {
    version,
    presets: value.presets,
    migrated: version !== PRESET_EXPORT_VERSION,
  };
}

function normalizePayload<T>(
  payload: ExtractedPayload,
  existingIds: ReadonlySet<string>,
  validateInput?: PresetInputValidator<T>
): PresetStorageResult<T> {
  const presets: Preset<T>[] = [];
  const seen = new Set(existingIds);
  let invalidSkipped = 0;
  let duplicatesSkipped = 0;

  for (const candidate of payload.presets) {
    const preset = normalizePreset(candidate, validateInput);
    if (!preset) {
      invalidSkipped += 1;
      continue;
    }
    if (seen.has(preset.id)) {
      duplicatesSkipped += 1;
      continue;
    }

    seen.add(preset.id);
    presets.push(preset);
  }

  const error =
    presets.length === 0 && payload.presets.length > 0
      ? duplicatesSkipped === payload.presets.length
        ? 'Todos os presets já existem'
        : 'Nenhum preset válido encontrado'
      : undefined;

  return {
    presets,
    version: payload.version,
    migrated: payload.migrated,
    error,
    invalidSkipped,
    duplicatesSkipped,
  };
}

export function loadPresetsResult<T>(
  storageKey: string,
  validateInput?: PresetInputValidator<T>
): PresetStorageResult<T> {
  if (typeof window === 'undefined') {
    return {
      presets: [],
      version: PRESET_EXPORT_VERSION,
      migrated: false,
      error: 'Armazenamento local indisponível',
    };
  }

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return {
      presets: [],
      version: PRESET_EXPORT_VERSION,
      migrated: false,
      error: 'Não foi possível acessar os presets salvos neste navegador',
    };
  }

  if (!raw) {
    return { presets: [], version: PRESET_EXPORT_VERSION, migrated: false };
  }

  try {
    const extracted = extractPayload(JSON.parse(raw));
    if (typeof extracted === 'string') {
      return {
        presets: [],
        version: PRESET_EXPORT_VERSION,
        migrated: false,
        error: extracted,
      };
    }
    const result = normalizePayload(extracted, new Set(), validateInput);
    if ((result.invalidSkipped ?? 0) > 0 || (result.duplicatesSkipped ?? 0) > 0) {
      const details = [
        result.invalidSkipped ? `${result.invalidSkipped} inválido(s)` : null,
        result.duplicatesSkipped ? `${result.duplicatesSkipped} duplicado(s)` : null,
      ].filter(Boolean).join(' e ');
      return {
        ...result,
        error: `Os presets salvos contêm ${details}. O conteúdo original foi preservado para recuperação.`,
      };
    }
    return result;
  } catch {
    return {
      presets: [],
      version: PRESET_EXPORT_VERSION,
      migrated: false,
      error: 'Os presets salvos estão corrompidos e foram preservados para recuperação',
    };
  }
}

export function loadPresets<T>(storageKey: string): Preset<T>[] {
  return loadPresetsResult<T>(storageKey).presets;
}

export function savePresets<T>(
  storageKey: string,
  presets: readonly Preset<T>[]
): PresetSaveResult {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Armazenamento local indisponível' };
  }

  try {
    const envelope: PresetExport<T> = {
      version: PRESET_EXPORT_VERSION,
      exportedAt: Date.now(),
      presets: clonePresetValue([...presets]),
    };
    window.localStorage.setItem(storageKey, JSON.stringify(envelope));
    return { success: true };
  } catch {
    return {
      success: false,
      error: 'Não foi possível salvar os presets. Verifique o espaço e as permissões do navegador.',
    };
  }
}

/**
 * Move a complete, valid preset collection to a new storage key exactly once.
 *
 * The destination always wins when it already exists. A mixed or corrupt
 * legacy collection is deliberately left untouched and the destination is not
 * created: silently keeping only the valid subset would make the skipped
 * scenarios look deleted. The source is removed only after the destination can
 * be read back with the same validated records.
 */
export function migratePresetStorage<T>(
  legacyStorageKey: string,
  destinationStorageKey: string,
  validateInput?: PresetInputValidator<T>
): PresetStorageMigrationResult {
  if (typeof window === 'undefined') {
    return {
      attempted: false,
      migrated: false,
      blocking: false,
    };
  }

  let destinationRaw: string | null;
  let legacyRaw: string | null;
  try {
    destinationRaw = window.localStorage.getItem(destinationStorageKey);
    legacyRaw = window.localStorage.getItem(legacyStorageKey);
  } catch {
    return {
      attempted: true,
      migrated: false,
      blocking: true,
      error: 'Não foi possível acessar os presets salvos neste navegador',
    };
  }

  // An explicit destination, including an intentionally empty collection,
  // prevents a later render from resurrecting presets from the old key.
  if (destinationRaw !== null || legacyRaw === null) {
    return {
      attempted: false,
      migrated: false,
      blocking: false,
    };
  }

  const legacy = loadPresetsResult<T>(legacyStorageKey, validateInput);
  if (legacy.error) {
    return {
      attempted: true,
      migrated: false,
      blocking: true,
      error: `Não foi possível migrar os presets antigos. ${legacy.error}`,
    };
  }

  const saved = savePresets(destinationStorageKey, legacy.presets);
  if (!saved.success) {
    return {
      attempted: true,
      migrated: false,
      blocking: true,
      error: `Não foi possível migrar os presets antigos. ${saved.error ?? 'Falha ao salvar presets'}`,
    };
  }

  const verification = loadPresetsResult<T>(destinationStorageKey, validateInput);
  const verified =
    !verification.error &&
    JSON.stringify(verification.presets) === JSON.stringify(legacy.presets);
  if (!verified) {
    // The destination was created by this attempt, so removing only that new
    // value restores the pre-migration state. The legacy value remains intact.
    try {
      window.localStorage.removeItem(destinationStorageKey);
    } catch {
      // Keep the original verification error; recovery remains possible from
      // the untouched legacy key even if storage permissions changed mid-run.
    }
    return {
      attempted: true,
      migrated: false,
      blocking: true,
      error: 'Não foi possível confirmar a migração dos presets antigos. O conteúdo original foi preservado.',
    };
  }

  try {
    window.localStorage.removeItem(legacyStorageKey);
  } catch {
    // The new copy is already verified. Leaving the source behind is harmless:
    // destination precedence makes the operation idempotent on the next load.
  }

  return {
    attempted: true,
    migrated: true,
    blocking: false,
  };
}

export function createPreset<T>(
  name: string,
  input: T,
  description?: string,
  tags?: PresetTag[]
): Preset<T> {
  const now = Date.now();
  return {
    id: newPresetId(),
    name: name.trim().slice(0, MAX_PRESET_NAME_LENGTH),
    description:
      description?.trim().slice(0, MAX_PRESET_DESCRIPTION_LENGTH) || undefined,
    createdAt: now,
    updatedAt: now,
    input: clonePresetValue(input),
    tags: clonePresetValue(tags ?? []),
  };
}

export function updatePreset<T>(
  preset: Preset<T>,
  updates: Partial<Pick<Preset<T>, 'name' | 'description' | 'input' | 'tags'>>
): Preset<T> {
  return {
    ...clonePresetValue(preset),
    ...(updates.name !== undefined
      ? { name: updates.name.trim().slice(0, MAX_PRESET_NAME_LENGTH) }
      : {}),
    ...(updates.description !== undefined
      ? {
          description:
            updates.description.trim().slice(0, MAX_PRESET_DESCRIPTION_LENGTH) ||
            undefined,
        }
      : {}),
    ...(updates.input !== undefined ? { input: clonePresetValue(updates.input) } : {}),
    ...(updates.tags !== undefined ? { tags: clonePresetValue(updates.tags) } : {}),
    updatedAt: Date.now(),
  };
}

export function exportPresetsToJson<T>(presets: readonly Preset<T>[]): string {
  const exportData: PresetExport<T> = {
    version: PRESET_EXPORT_VERSION,
    exportedAt: Date.now(),
    presets: clonePresetValue([...presets]),
  };
  return JSON.stringify(exportData, null, 2);
}

export function downloadPresetsFile<T>(
  presets: readonly Preset<T>[],
  filename = 'farol-presets.json'
) {
  const json = exportPresetsToJson(presets);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

export function parsePresetsFromJson<T>(
  json: string,
  existingIds: ReadonlySet<string>,
  validateInput?: PresetInputValidator<T>
): ImportResult<T> {
  try {
    const byteLength = new TextEncoder().encode(json).byteLength;
    if (byteLength > MAX_PRESET_IMPORT_BYTES) {
      return {
        success: false,
        presets: [],
        error: 'O arquivo de presets excede o limite de 5 MB',
      };
    }
    const extracted = extractPayload(JSON.parse(json));
    if (typeof extracted === 'string') {
      return { success: false, presets: [], error: extracted };
    }

    const result = normalizePayload(extracted, existingIds, validateInput);
    return {
      success: !result.error,
      presets: result.presets,
      error: result.error,
      duplicatesSkipped: result.duplicatesSkipped,
      invalidSkipped: result.invalidSkipped,
    };
  } catch {
    return { success: false, presets: [], error: 'Erro ao analisar arquivo JSON' };
  }
}

export function readFileAsText(file: File): Promise<string> {
  if (file.size > MAX_PRESET_IMPORT_BYTES) {
    return Promise.reject(new Error('O arquivo de presets excede o limite de 5 MB'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file);
  });
}
