import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Preset,
  PresetInputValidator,
  PresetTag,
  PresetTagType,
  clonePresetValue,
  createPreset,
  createTag,
  downloadPresetsFile,
  ImportResult,
  MAX_PRESETS_PER_FILE,
  loadPresetsResult,
  parsePresetsFromJson,
  readFileAsText,
  savePresets,
  updatePreset,
} from '../utils/presets';

interface UsePresetsOptions<T> {
  storageKey: string;
  validateInput?: PresetInputValidator<T>;
  onSave?: (preset: Preset<unknown>) => void;
  onLoad?: (preset: Preset<unknown>) => void;
  onDelete?: (preset: Preset<unknown>) => void;
}

export function usePresets<T>(options: UsePresetsOptions<T>) {
  const { storageKey, validateInput, onSave, onLoad, onDelete } = options;
  const [presets, setPresets] = useState<Preset<T>[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const presetsRef = useRef<Preset<T>[]>([]);
  const persistenceBlockedRef = useRef(false);
  const externalSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    const result = loadPresetsResult<T>(storageKey, validateInput);
    presetsRef.current = result.presets;
    setPresets(result.presets);
    setStorageError(result.error ?? null);
    persistenceBlockedRef.current = Boolean(result.error);
    externalSnapshotRef.current = !result.error && !result.migrated
      ? JSON.stringify(result.presets)
      : null;
    setInitialized(true);
  }, [storageKey, validateInput]);

  useEffect(() => {
    if (!initialized || persistenceBlockedRef.current) return;
    const snapshot = JSON.stringify(presets);
    if (externalSnapshotRef.current === snapshot) {
      // A storage event already persisted this exact state in another tab.
      // Writing it again (with a new exportedAt timestamp) would make tabs
      // continuously trigger each other.
      externalSnapshotRef.current = null;
      return;
    }
    externalSnapshotRef.current = null;
    const result = savePresets(storageKey, presets);
    setStorageError(result.success ? null : result.error ?? 'Falha ao salvar presets');
  }, [storageKey, presets, initialized]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey || event.storageArea !== window.localStorage) return;
      const result = loadPresetsResult<T>(storageKey, validateInput);
      persistenceBlockedRef.current = Boolean(result.error);
      setStorageError(result.error ?? null);
      if (!result.error) {
        externalSnapshotRef.current = JSON.stringify(result.presets);
        presetsRef.current = result.presets;
        setPresets(result.presets);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey, validateInput]);

  const persistPresets = useCallback(
    (nextPresets: Preset<T>[], options: { replaceInvalidStorage?: boolean } = {}) => {
      if (persistenceBlockedRef.current && !options.replaceInvalidStorage) {
        setStorageError((current) =>
          current ??
          'Os presets salvos precisam ser recuperados ou removidos antes de novas alterações.'
        );
        return false;
      }

      const snapshot = clonePresetValue(nextPresets);
      const result = savePresets(storageKey, snapshot);
      if (!result.success) {
        setStorageError(result.error ?? 'Falha ao salvar presets');
        return false;
      }

      persistenceBlockedRef.current = false;
      externalSnapshotRef.current = JSON.stringify(snapshot);
      presetsRef.current = snapshot;
      setStorageError(null);
      setPresets(snapshot);
      return true;
    },
    [storageKey]
  );

  const addPreset = useCallback(
    (name: string, input: T, description?: string, tags?: PresetTag[]) => {
      if (validateInput && !validateInput(input)) return null;
      if (presetsRef.current.length >= MAX_PRESETS_PER_FILE) {
        setStorageError(`Você pode salvar no máximo ${MAX_PRESETS_PER_FILE} presets.`);
        return null;
      }
      const preset = createPreset(name, input, description, tags);
      if (!persistPresets([preset, ...presetsRef.current])) return null;
      onSave?.(clonePresetValue(preset) as Preset<unknown>);
      return clonePresetValue(preset);
    },
    [onSave, persistPresets, validateInput]
  );

  const editPreset = useCallback(
    (
      id: string,
      updates: Partial<Pick<Preset<T>, 'name' | 'description' | 'input' | 'tags'>>
    ) => {
      if (updates.input !== undefined && validateInput && !validateInput(updates.input)) {
        return false;
      }
      return persistPresets(
        presetsRef.current.map((preset) =>
          preset.id === id ? updatePreset(preset, clonePresetValue(updates)) : preset
        )
      );
    },
    [persistPresets, validateInput]
  );

  const addTagToPreset = useCallback(
    (presetId: string, tagType: PresetTagType, customLabel?: string) => {
      const tag = createTag(tagType, customLabel);
      return persistPresets(
        presetsRef.current.map((preset) => {
          if (preset.id !== presetId) return preset;
          const existingTags = preset.tags ?? [];
          if (existingTags.some((item) => item.type === tagType)) return preset;
          return updatePreset(preset, { tags: [...existingTags, tag] });
        })
      );
    },
    [persistPresets]
  );

  const removeTagFromPreset = useCallback((presetId: string, tagId: string) => {
    return persistPresets(
      presetsRef.current.map((preset) => {
        if (preset.id !== presetId) return preset;
        return updatePreset(preset, {
          tags: (preset.tags ?? []).filter((tag) => tag.id !== tagId),
        });
      })
    );
  }, [persistPresets]);

  const setPresetTags = useCallback((presetId: string, tags: PresetTag[]) => {
    return persistPresets(
      presetsRef.current.map((preset) =>
        preset.id === presetId ? updatePreset(preset, { tags }) : preset
      )
    );
  }, [persistPresets]);

  const allTags = useMemo(() => {
    const tagMap = new Map<PresetTagType, PresetTag>();
    presets.forEach((preset) => {
      (preset.tags ?? []).forEach((tag) => {
        if (!tagMap.has(tag.type)) tagMap.set(tag.type, tag);
      });
    });
    return clonePresetValue(Array.from(tagMap.values()));
  }, [presets]);

  const filterByTags = useCallback(
    (tagTypes: PresetTagType[]) => {
      if (tagTypes.length === 0) return clonePresetValue(presets);
      return clonePresetValue(
        presets.filter((preset) =>
          tagTypes.some((type) => (preset.tags ?? []).some((tag) => tag.type === type))
        )
      );
    },
    [presets]
  );

  const removePreset = useCallback(
    (id: string) => {
      const preset = presetsRef.current.find((item) => item.id === id);
      if (!preset) return false;
      if (!persistPresets(presetsRef.current.filter((item) => item.id !== id))) {
        return false;
      }
      onDelete?.(clonePresetValue(preset) as Preset<unknown>);
      return true;
    },
    [onDelete, persistPresets]
  );

  const duplicatePreset = useCallback(
    (id: string) => {
      const original = presetsRef.current.find((preset) => preset.id === id);
      if (!original) return null;
      if (presetsRef.current.length >= MAX_PRESETS_PER_FILE) {
        setStorageError(`Você pode salvar no máximo ${MAX_PRESETS_PER_FILE} presets.`);
        return null;
      }
      const copy = createPreset(
        `${original.name} (cópia)`,
        original.input,
        original.description,
        original.tags
      );
      if (!persistPresets([copy, ...presetsRef.current])) return null;
      return clonePresetValue(copy);
    },
    [persistPresets]
  );

  const loadPreset = useCallback(
    (id: string) => {
      const preset = presets.find((item) => item.id === id);
      if (!preset) return null;
      const snapshot = clonePresetValue(preset);
      onLoad?.(snapshot as Preset<unknown>);
      return snapshot;
    },
    [presets, onLoad]
  );

  const getPreset = useCallback(
    (id: string) => {
      const preset = presets.find((item) => item.id === id);
      return preset ? clonePresetValue(preset) : null;
    },
    [presets]
  );

  const exportAllPresets = useCallback(
    (filename?: string) => downloadPresetsFile(presets, filename),
    [presets]
  );

  const exportSelectedPresets = useCallback(
    (ids: string[], filename?: string) => {
      downloadPresetsFile(
        presets.filter((preset) => ids.includes(preset.id)),
        filename
      );
    },
    [presets]
  );

  const importPresets = useCallback(
    async (file: File): Promise<ImportResult<T>> => {
      try {
        const text = await readFileAsText(file);
        const result = parsePresetsFromJson<T>(
          text,
          new Set(presetsRef.current.map((preset) => preset.id)),
          validateInput
        );

        if (result.success && result.presets.length > 0) {
          const nextPresets = [
            ...clonePresetValue(result.presets),
            ...presetsRef.current,
          ];
          if (nextPresets.length > MAX_PRESETS_PER_FILE) {
            return {
              success: false,
              presets: [],
              error: `Você pode manter no máximo ${MAX_PRESETS_PER_FILE} presets.`,
            };
          }
          if (!persistPresets(nextPresets, { replaceInvalidStorage: true })) {
            return {
              success: false,
              presets: [],
              error: 'Os presets foram validados, mas não puderam ser salvos neste navegador.',
            };
          }
        }
        return result;
      } catch (error) {
        return {
          success: false,
          presets: [],
          error: error instanceof Error ? error.message : 'Erro ao ler arquivo',
        };
      }
    },
    [persistPresets, validateInput]
  );

  const clearAllPresets = useCallback(() => {
    return persistPresets([], { replaceInvalidStorage: true });
  }, [persistPresets]);

  const reorderPresets = useCallback((fromIndex: number, toIndex: number) => {
    const previous = presetsRef.current;
    if (
      fromIndex < 0 ||
      fromIndex >= previous.length ||
      toIndex < 0 ||
      toIndex >= previous.length ||
      fromIndex === toIndex
    ) {
      return false;
    }
    const reordered = [...previous];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);
    return persistPresets(reordered);
  }, [persistPresets]);

  return {
    presets,
    initialized,
    storageError,
    addPreset,
    editPreset,
    removePreset,
    duplicatePreset,
    loadPreset,
    getPreset,
    exportAllPresets,
    exportSelectedPresets,
    importPresets,
    clearAllPresets,
    reorderPresets,
    addTagToPreset,
    removeTagFromPreset,
    setPresetTags,
    allTags,
    filterByTags,
    isEmpty: presets.length === 0,
    count: presets.length,
  };
}
