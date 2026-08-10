import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_PRESET_IMPORT_BYTES,
  MAX_PRESET_NAME_LENGTH,
  MAX_PRESETS_PER_FILE,
  PRESET_EXPORT_VERSION,
  createPreset,
  loadPresetsResult,
  migratePresetStorage,
  parsePresetsFromJson,
  readFileAsText,
  savePresets,
  updatePreset,
} from './presets';

const storedValues = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return storedValues.size;
  },
  clear: () => storedValues.clear(),
  getItem: (key) => storedValues.get(key) ?? null,
  key: (index) => [...storedValues.keys()][index] ?? null,
  removeItem: (key) => storedValues.delete(key),
  setItem: (key, value) => storedValues.set(key, String(value)),
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: memoryStorage,
});

interface SampleInput {
  amount: number;
  nested: { enabled: boolean };
}

const isSampleInput = (input: unknown): input is SampleInput => {
  if (!input || typeof input !== 'object') return false;
  const candidate = input as Partial<SampleInput>;
  return typeof candidate.amount === 'number' && typeof candidate.nested?.enabled === 'boolean';
};

function serializedPreset(id: string) {
  return {
    id,
    name: `Preset ${id}`,
    createdAt: 1,
    updatedAt: 1,
    input: { amount: 10, nested: { enabled: true } },
    tags: [],
  };
}

beforeEach(() => window.localStorage.clear());

describe('preset immutability', () => {
  it('isola o preset de mutações posteriores no formulário e nas atualizações', () => {
    const input: SampleInput = { amount: 10, nested: { enabled: true } };
    const preset = createPreset('Teste', input);
    input.nested.enabled = false;

    const replacement: SampleInput = { amount: 20, nested: { enabled: false } };
    const updated = updatePreset(preset, { input: replacement });
    replacement.nested.enabled = true;

    expect(preset.input.nested.enabled).toBe(true);
    expect(updated.input).toEqual({ amount: 20, nested: { enabled: false } });
  });
});

describe('preset persistence and import', () => {
  it('migra o storage legado uma única vez e só então remove a origem', () => {
    window.localStorage.setItem(
      'comparison-legacy',
      JSON.stringify([serializedPreset('legacy-id')])
    );

    const migration = migratePresetStorage<SampleInput>(
      'comparison-legacy',
      'comparison-v4',
      isSampleInput
    );

    expect(migration).toMatchObject({
      attempted: true,
      migrated: true,
      blocking: false,
    });
    expect(window.localStorage.getItem('comparison-legacy')).toBeNull();
    expect(loadPresetsResult('comparison-v4', isSampleInput).presets)
      .toHaveLength(1);

    const destinationSnapshot = window.localStorage.getItem('comparison-v4');
    expect(migratePresetStorage(
      'comparison-legacy',
      'comparison-v4',
      isSampleInput
    )).toMatchObject({ attempted: false, migrated: false });
    expect(window.localStorage.getItem('comparison-v4')).toBe(destinationSnapshot);
  });

  it('não migra parcialmente nem apaga um storage legado misto', () => {
    const original = JSON.stringify([
      serializedPreset('valid-id'),
      { ...serializedPreset('invalid-id'), input: { amount: '10' } },
    ]);
    window.localStorage.setItem('comparison-legacy', original);

    const migration = migratePresetStorage<SampleInput>(
      'comparison-legacy',
      'comparison-v4',
      isSampleInput
    );

    expect(migration).toMatchObject({
      attempted: true,
      migrated: false,
      blocking: true,
    });
    expect(migration.error).toContain('conteúdo original foi preservado');
    expect(window.localStorage.getItem('comparison-legacy')).toBe(original);
    expect(window.localStorage.getItem('comparison-v4')).toBeNull();
  });

  it('preserva o storage legado corrompido e não cria o destino', () => {
    window.localStorage.setItem('comparison-legacy', '{invalid-json');

    const migration = migratePresetStorage<SampleInput>(
      'comparison-legacy',
      'comparison-v4',
      isSampleInput
    );

    expect(migration).toMatchObject({
      attempted: true,
      migrated: false,
      blocking: true,
    });
    expect(migration.error).toContain('corrompidos');
    expect(window.localStorage.getItem('comparison-legacy')).toBe('{invalid-json');
    expect(window.localStorage.getItem('comparison-v4')).toBeNull();
  });

  it('salva envelope versionado e migra o formato legado em array', () => {
    const preset = createPreset('Teste', { amount: 10, nested: { enabled: true } });
    expect(savePresets('sample', [preset]).success).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('sample') ?? '{}').version).toBe(
      PRESET_EXPORT_VERSION
    );

    window.localStorage.setItem('legacy', JSON.stringify([serializedPreset('legacy-id')]));
    const loaded = loadPresetsResult<SampleInput>('legacy', isSampleInput);
    expect(loaded.migrated).toBe(true);
    expect(loaded.presets).toHaveLength(1);
  });

  it('preserva conteúdo corrompido em vez de sobrescrevê-lo silenciosamente', () => {
    window.localStorage.setItem('broken', '{invalid-json');

    const loaded = loadPresetsResult<SampleInput>('broken', isSampleInput);

    expect(loaded.error).toContain('corrompidos');
    expect(window.localStorage.getItem('broken')).toBe('{invalid-json');
  });

  it('bloqueia a normalização quando o armazenamento mistura presets válidos e inválidos', () => {
    const original = JSON.stringify([
      serializedPreset('valid-id'),
      { ...serializedPreset('invalid-id'), input: { amount: '10' } },
    ]);
    window.localStorage.setItem('mixed', original);

    const loaded = loadPresetsResult<SampleInput>('mixed', isSampleInput);

    expect(loaded.presets).toHaveLength(1);
    expect(loaded.invalidSkipped).toBe(1);
    expect(loaded.error).toContain('conteúdo original foi preservado');
    expect(window.localStorage.getItem('mixed')).toBe(original);
  });

  it('elimina IDs repetidos no próprio arquivo e rejeita versões futuras', () => {
    const duplicatePayload = JSON.stringify([
      serializedPreset('same-id'),
      serializedPreset('same-id'),
    ]);
    const imported = parsePresetsFromJson<SampleInput>(
      duplicatePayload,
      new Set(),
      isSampleInput
    );

    expect(imported.success).toBe(true);
    expect(imported.presets).toHaveLength(1);
    expect(imported.duplicatesSkipped).toBe(1);

    const future = parsePresetsFromJson<SampleInput>(
      JSON.stringify({ version: PRESET_EXPORT_VERSION + 1, presets: [] }),
      new Set(),
      isSampleInput
    );
    expect(future.success).toBe(false);
    expect(future.error).toContain('não suportada');
  });

  it('rejeita quantidade e comprimentos estruturais excessivos', () => {
    const tooMany = parsePresetsFromJson<SampleInput>(
      JSON.stringify(
        Array.from({ length: MAX_PRESETS_PER_FILE + 1 }, (_, index) =>
          serializedPreset(`preset-${index}`)
        )
      ),
      new Set(),
      isSampleInput
    );
    const longName = parsePresetsFromJson<SampleInput>(
      JSON.stringify([
        {
          ...serializedPreset('long-name'),
          name: 'x'.repeat(MAX_PRESET_NAME_LENGTH + 1),
        },
      ]),
      new Set(),
      isSampleInput
    );

    expect(tooMany.success).toBe(false);
    expect(tooMany.error).toContain('no máximo');
    expect(longName.success).toBe(false);
    expect(longName.error).toContain('Nenhum preset válido');
  });

  it('rejeita arquivos acima de 5 MB antes de acionar o FileReader', async () => {
    const oversizedFile = { size: MAX_PRESET_IMPORT_BYTES + 1 } as File;

    await expect(readFileAsText(oversizedFile)).rejects.toThrow('5 MB');
  });
});
