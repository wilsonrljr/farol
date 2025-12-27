import { useState, useCallback, useEffect } from 'react';
import {
  Preset,
  loadPresets,
  savePresets,
  createPreset,
  updatePreset,
  downloadPresetsFile,
  parsePresetsFromJson,
  readFileAsText,
  ImportResult,
} from '../utils/presets';

interface UsePresetsOptions {
  storageKey: string;
  onSave?: (preset: Preset<unknown>) => void;
  onLoad?: (preset: Preset<unknown>) => void;
  onDelete?: (preset: Preset<unknown>) => void;
}

export function usePresets<T>(options: UsePresetsOptions) {
  const { storageKey, onSave, onLoad, onDelete } = options;
  const [presets, setPresets] = useState<Preset<T>[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Load presets from localStorage on mount
  useEffect(() => {
    const loaded = loadPresets<T>(storageKey);
    setPresets(loaded);
    setInitialized(true);
  }, [storageKey]);

  // Persist to localStorage whenever presets change (after initialization)
  useEffect(() => {
    if (initialized) {
      savePresets(storageKey, presets);
    }
  }, [storageKey, presets, initialized]);

  const addPreset = useCallback(
    (name: string, input: T, description?: string) => {
      const preset = createPreset(name, input, description);
      setPresets((prev) => [preset, ...prev]);
      onSave?.(preset as Preset<unknown>);
      return preset;
    },
    [onSave]
  );

  const editPreset = useCallback(
    (id: string, updates: Partial<Pick<Preset<T>, 'name' | 'description' | 'input'>>) => {
      setPresets((prev) =>
        prev.map((p) => (p.id === id ? updatePreset(p, updates) : p))
      );
    },
    []
  );

  const removePreset = useCallback(
    (id: string) => {
      setPresets((prev) => {
        const preset = prev.find((p) => p.id === id);
        if (preset) {
          onDelete?.(preset as Preset<unknown>);
        }
        return prev.filter((p) => p.id !== id);
      });
    },
    [onDelete]
  );

  const duplicatePreset = useCallback(
    (id: string) => {
      const original = presets.find((p) => p.id === id);
      if (!original) return null;
      const copy = createPreset(
        `${original.name} (cópia)`,
        original.input,
        original.description
      );
      setPresets((prev) => [copy, ...prev]);
      return copy;
    },
    [presets]
  );

  const loadPreset = useCallback(
    (id: string) => {
      const preset = presets.find((p) => p.id === id);
      if (preset) {
        onLoad?.(preset as Preset<unknown>);
      }
      return preset || null;
    },
    [presets, onLoad]
  );

  const getPreset = useCallback(
    (id: string) => presets.find((p) => p.id === id) || null,
    [presets]
  );

  const exportAllPresets = useCallback(
    (filename?: string) => {
      downloadPresetsFile(presets, filename);
    },
    [presets]
  );

  const exportSelectedPresets = useCallback(
    (ids: string[], filename?: string) => {
      const selected = presets.filter((p) => ids.includes(p.id));
      downloadPresetsFile(selected, filename);
    },
    [presets]
  );

  const importPresets = useCallback(
    async (file: File): Promise<ImportResult<T>> => {
      try {
        const text = await readFileAsText(file);
        const existingIds = new Set(presets.map((p) => p.id));
        const result = parsePresetsFromJson<T>(text, existingIds);

        if (result.success && result.presets.length > 0) {
          setPresets((prev) => [...result.presets, ...prev]);
        }

        return result;
      } catch {
        return { success: false, presets: [], error: 'Erro ao ler arquivo' };
      }
    },
    [presets]
  );

  const clearAllPresets = useCallback(() => {
    setPresets([]);
  }, []);

  const reorderPresets = useCallback((fromIndex: number, toIndex: number) => {
    setPresets((prev) => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result;
    });
  }, []);

  return {
    presets,
    initialized,
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
    isEmpty: presets.length === 0,
    count: presets.length,
  };
}
