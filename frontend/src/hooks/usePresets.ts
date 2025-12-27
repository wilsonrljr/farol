import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Preset,
  PresetTag,
  PresetTagType,
  createTag,
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
    (name: string, input: T, description?: string, tags?: PresetTag[]) => {
      const preset = createPreset(name, input, description, tags);
      setPresets((prev) => [preset, ...prev]);
      onSave?.(preset as Preset<unknown>);
      return preset;
    },
    [onSave]
  );

  const editPreset = useCallback(
    (id: string, updates: Partial<Pick<Preset<T>, 'name' | 'description' | 'input' | 'tags'>>) => {
      setPresets((prev) =>
        prev.map((p) => (p.id === id ? updatePreset(p, updates) : p))
      );
    },
    []
  );

  // Tag management
  const addTagToPreset = useCallback(
    (presetId: string, tagType: PresetTagType, customLabel?: string) => {
      const tag = createTag(tagType, customLabel);
      setPresets((prev) =>
        prev.map((p) => {
          if (p.id !== presetId) return p;
          const existingTags = p.tags || [];
          // Don't add duplicate tag types
          if (existingTags.some((t) => t.type === tagType)) return p;
          return updatePreset(p, { tags: [...existingTags, tag] });
        })
      );
    },
    []
  );

  const removeTagFromPreset = useCallback(
    (presetId: string, tagId: string) => {
      setPresets((prev) =>
        prev.map((p) => {
          if (p.id !== presetId) return p;
          const existingTags = p.tags || [];
          return updatePreset(p, { tags: existingTags.filter((t) => t.id !== tagId) });
        })
      );
    },
    []
  );

  const setPresetTags = useCallback(
    (presetId: string, tags: PresetTag[]) => {
      setPresets((prev) =>
        prev.map((p) => (p.id === presetId ? updatePreset(p, { tags }) : p))
      );
    },
    []
  );

  // Get all unique tags used across all presets
  const allTags = useMemo(() => {
    const tagMap = new Map<string, PresetTag>();
    presets.forEach((p) => {
      (p.tags || []).forEach((tag) => {
        if (!tagMap.has(tag.type)) {
          tagMap.set(tag.type, tag);
        }
      });
    });
    return Array.from(tagMap.values());
  }, [presets]);

  // Filter presets by tags
  const filterByTags = useCallback(
    (tagTypes: PresetTagType[]) => {
      if (tagTypes.length === 0) return presets;
      return presets.filter((p) =>
        tagTypes.some((type) => (p.tags || []).some((t) => t.type === type))
      );
    },
    [presets]
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
        original.description,
        original.tags // Preserve tags on duplicate
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
    // Tag management
    addTagToPreset,
    removeTagFromPreset,
    setPresetTags,
    allTags,
    filterByTags,
    isEmpty: presets.length === 0,
    count: presets.length,
  };
}
