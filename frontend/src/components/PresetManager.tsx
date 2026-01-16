import { useState, useRef, useMemo } from 'react';
import {
  Modal,
  Button,
  TextInput,
  Textarea,
  Stack,
  Group,
  Text,
  Box,
  Paper,
  ActionIcon,
  Menu,
  Badge,
  ThemeIcon,
  Tooltip,
  FileButton,
  Divider,
  rem,
  Alert,
  Collapse,
  ScrollArea,
  Checkbox,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBookmark,
  IconBookmarkFilled,
  IconDotsVertical,
  IconTrash,
  IconPencil,
  IconCopy,
  IconDownload,
  IconUpload,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconDeviceFloppy,
  IconFolderOpen,
  IconPlus,
  IconScale,
  IconTag,
} from '@tabler/icons-react';
import { Preset, PresetTag, PresetTagType, createTag } from '../utils/presets';
import { PresetTagList, TagSelector, TagFilter } from './PresetTagSelector';

interface PresetManagerProps<T> {
  presets: Preset<T>[];
  onSave: (name: string, description?: string, tags?: PresetTag[]) => void;
  onLoad: (preset: Preset<T>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEdit: (id: string, updates: { name?: string; description?: string; tags?: PresetTag[] }) => void;
  onExportAll: () => void;
  onExportSelected: (ids: string[]) => void;
  onImport: (file: File) => Promise<{ success: boolean; error?: string; duplicatesSkipped?: number; presets: Preset<T>[] }>;
  onClearAll: () => void;
  // Quick Compare
  onCompare?: (selectedPresets: Preset<T>[]) => void;
  isCompareLoading?: boolean;
  minCompareSelection?: number;
  // Tag management
  allTags?: PresetTag[];
  onAddTag?: (presetId: string, tagType: PresetTagType, customLabel?: string) => void;
  onRemoveTag?: (presetId: string, tagId: string) => void;
  isLoading?: boolean;
}

export function PresetManager<T>({
  presets,
  onSave,
  onLoad,
  onDelete,
  onDuplicate,
  onEdit,
  onExportAll,
  onExportSelected,
  onImport,
  onClearAll,
  // Quick Compare
  onCompare,
  isCompareLoading = false,
  minCompareSelection = 2,
  // Tag management
  allTags = [],
  onAddTag,
  onRemoveTag,
  isLoading = false,
}: PresetManagerProps<T>) {
  const [opened, { open, close }] = useDisclosure(false);
  const [saveModalOpened, { open: openSaveModal, close: closeSaveModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [deleteConfirmOpened, { open: openDeleteConfirm, close: closeDeleteConfirm }] = useDisclosure(false);
  const [clearConfirmOpened, { open: openClearConfirm, close: closeClearConfirm }] = useDisclosure(false);
  
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saveTags, setSaveTags] = useState<PresetTag[]>([]);
  const [editingPreset, setEditingPreset] = useState<Preset<T> | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState<PresetTag[]>([]);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  
  // Tag filter state
  const [tagFilters, setTagFilters] = useState<PresetTagType[]>([]);
  
  // Quick compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<Set<string>>(new Set());
  
  const resetRef = useRef<() => void>(null);
  
  // Filtered presets based on tags
  const filteredPresets = useMemo(() => {
    if (tagFilters.length === 0) return presets;
    return presets.filter((p) =>
      tagFilters.some((type) => (p.tags || []).some((t) => t.type === type))
    );
  }, [presets, tagFilters]);
  
  // Check if can compare
  const canCompare = compareSelection.size >= minCompareSelection;
  
  const handleQuickCompare = () => {
    if (!onCompare || !canCompare) return;
    const selected = presets.filter((p) => compareSelection.has(p.id));
    onCompare(selected);
    setCompareMode(false);
    setCompareSelection(new Set());
  };
  
  const toggleCompareSelection = (id: string) => {
    setCompareSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = () => {
    if (!saveName.trim()) {
      notifications.show({
        title: 'Nome obrigatório',
        message: 'Informe um nome para o preset',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }
    onSave(saveName.trim(), saveDescription.trim() || undefined, saveTags.length > 0 ? saveTags : undefined);
    setSaveName('');
    setSaveDescription('');
    setSaveTags([]);
    closeSaveModal();
    notifications.show({
      title: 'Preset salvo',
      message: `"${saveName}" foi salvo com sucesso`,
      color: 'ocean',
      icon: <IconCheck size={16} />,
    });
  };

  const handleLoad = (preset: Preset<T>) => {
    onLoad(preset);
    close();
    notifications.show({
      title: 'Preset carregado',
      message: `"${preset.name}" foi aplicado ao formulário`,
      color: 'ocean',
      icon: <IconCheck size={16} />,
    });
  };

  const handleEdit = (preset: Preset<T>) => {
    setEditingPreset(preset);
    setEditName(preset.name);
    setEditDescription(preset.description || '');
    setEditTags(preset.tags || []);
    openEditModal();
  };

  const handleEditSave = () => {
    if (!editingPreset || !editName.trim()) return;
    onEdit(editingPreset.id, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      tags: editTags.length > 0 ? editTags : undefined,
    });
    closeEditModal();
    setEditingPreset(null);
    setEditTags([]);
    notifications.show({
      title: 'Preset atualizado',
      message: 'As alterações foram salvas',
      color: 'ocean',
      icon: <IconCheck size={16} />,
    });
  };

  const handleDeleteClick = (id: string) => {
    setDeletingPresetId(id);
    openDeleteConfirm();
  };

  const handleDeleteConfirm = () => {
    if (deletingPresetId) {
      onDelete(deletingPresetId);
      closeDeleteConfirm();
      setDeletingPresetId(null);
      notifications.show({
        title: 'Preset excluído',
        message: 'O preset foi removido',
        color: 'ocean',
        icon: <IconTrash size={16} />,
      });
    }
  };

  const handleDuplicate = (id: string) => {
    onDuplicate(id);
    notifications.show({
      title: 'Preset duplicado',
      message: 'Uma cópia foi criada',
      color: 'ocean',
      icon: <IconCopy size={16} />,
    });
  };

  const handleImport = async (file: File | null) => {
    if (!file) return;
    
    const result = await onImport(file);
    resetRef.current?.();
    
    if (result.success) {
      const message = result.duplicatesSkipped
        ? `${result.presets.length} preset(s) importado(s). ${result.duplicatesSkipped} duplicado(s) ignorado(s).`
        : `${result.presets.length} preset(s) importado(s) com sucesso`;
      notifications.show({
        title: 'Importação concluída',
        message,
        color: 'ocean',
        icon: <IconCheck size={16} />,
      });
    } else {
      notifications.show({
        title: 'Erro na importação',
        message: result.error || 'Não foi possível importar os presets',
        color: 'red',
        icon: <IconX size={16} />,
      });
    }
  };

  const handleExportSelected = () => {
    if (selectedPresets.size === 0) {
      notifications.show({
        title: 'Nenhum preset selecionado',
        message: 'Selecione os presets que deseja exportar',
        color: 'yellow',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }
    onExportSelected(Array.from(selectedPresets));
    setSelectedPresets(new Set());
    notifications.show({
      title: 'Exportação concluída',
      message: `${selectedPresets.size} preset(s) exportado(s)`,
      color: 'ocean',
      icon: <IconDownload size={16} />,
    });
  };

  const handleClearAll = () => {
    onClearAll();
    closeClearConfirm();
    setSelectedPresets(new Set());
    notifications.show({
      title: 'Presets removidos',
      message: 'Todos os presets foram excluídos',
      color: 'ocean',
      icon: <IconTrash size={16} />,
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedPresets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Trigger Buttons */}
      <Group gap="xs">
        <Tooltip label="Salvar configuração atual" withArrow>
          <Button
            variant="light"
            color="ocean"
            size="sm"
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={openSaveModal}
            loading={isLoading}
          >
            Salvar Preset
          </Button>
        </Tooltip>
        <Tooltip label="Gerenciar presets salvos" withArrow>
          <Button
            variant="subtle"
            color="ocean"
            size="sm"
            leftSection={<IconFolderOpen size={16} />}
            onClick={open}
            rightSection={
              presets.length > 0 && (
                <Badge size="xs" color="ocean" variant="filled" circle>
                  {presets.length}
                </Badge>
              )
            }
          >
            Meus Presets
          </Button>
        </Tooltip>
      </Group>

      {/* Save Preset Modal */}
      <Modal
        opened={saveModalOpened}
        onClose={closeSaveModal}
        title={
          <Group gap="sm">
            <ThemeIcon size="md" radius="md" variant="light" color="ocean">
              <IconDeviceFloppy size={16} />
            </ThemeIcon>
            <Text fw={600}>Salvar Preset</Text>
          </Group>
        }
        size="md"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Nome do preset"
            placeholder="Ex: Apartamento SP 500k"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            required
            data-autofocus
          />
          <Textarea
            label="Descrição (opcional)"
            placeholder="Breve descrição do cenário..."
            value={saveDescription}
            onChange={(e) => setSaveDescription(e.target.value)}
            minRows={2}
            maxRows={4}
          />
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Tags (opcional)
            </Text>
            <TagSelector
              selectedTags={saveTags}
              onAddTag={(type, customLabel) => {
                setSaveTags((prev) => [...prev, createTag(type, customLabel)]);
              }}
              onRemoveTag={(tagId) => setSaveTags((prev) => prev.filter((t) => t.id !== tagId))}
              compact
            />
          </Box>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={closeSaveModal}>
              Cancelar
            </Button>
            <Button
              color="ocean"
              leftSection={<IconCheck size={16} />}
              onClick={handleSave}
            >
              Salvar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Preset Modal */}
      <Modal
        opened={editModalOpened}
        onClose={closeEditModal}
        title={
          <Group gap="sm">
            <ThemeIcon size="md" radius="md" variant="light" color="ocean">
              <IconPencil size={16} />
            </ThemeIcon>
            <Text fw={600}>Editar Preset</Text>
          </Group>
        }
        size="md"
        centered
        zIndex={301}
      >
        <Stack gap="md">
          <TextInput
            label="Nome do preset"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            data-autofocus
          />
          <Textarea
            label="Descrição (opcional)"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            minRows={2}
            maxRows={4}
          />
          <Box>
            <Text size="sm" fw={500} mb="xs">
              Tags
            </Text>
            <TagSelector
              selectedTags={editTags}
              onAddTag={(type, customLabel) => {
                setEditTags((prev) => [...prev, createTag(type, customLabel)]);
              }}
              onRemoveTag={(tagId) => setEditTags((prev) => prev.filter((t) => t.id !== tagId))}
              compact
            />
          </Box>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={closeEditModal}>
              Cancelar
            </Button>
            <Button
              color="ocean"
              leftSection={<IconCheck size={16} />}
              onClick={handleEditSave}
            >
              Salvar alterações
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteConfirmOpened}
        onClose={closeDeleteConfirm}
        title={
          <Group gap="sm">
            <ThemeIcon size="md" radius="md" variant="light" color="red">
              <IconTrash size={16} />
            </ThemeIcon>
            <Text fw={600}>Excluir Preset</Text>
          </Group>
        }
        size="sm"
        centered
        zIndex={301}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Tem certeza que deseja excluir este preset? Esta ação não pode ser desfeita.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={closeDeleteConfirm}>
              Cancelar
            </Button>
            <Button color="red" leftSection={<IconTrash size={16} />} onClick={handleDeleteConfirm}>
              Excluir
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Clear All Confirmation Modal */}
      <Modal
        opened={clearConfirmOpened}
        onClose={closeClearConfirm}
        title={
          <Group gap="sm">
            <ThemeIcon size="md" radius="md" variant="light" color="red">
              <IconTrash size={16} />
            </ThemeIcon>
            <Text fw={600}>Excluir Todos os Presets</Text>
          </Group>
        }
        size="sm"
        centered
        zIndex={301}
      >
        <Stack gap="md">
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            Esta ação irá excluir todos os {presets.length} presets salvos. Esta ação não pode ser desfeita.
          </Alert>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={closeClearConfirm}>
              Cancelar
            </Button>
            <Button color="red" leftSection={<IconTrash size={16} />} onClick={handleClearAll}>
              Excluir tudo
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Main Presets Management Modal */}
      <Modal
        opened={opened}
        onClose={() => {
          close();
          setCompareMode(false);
          setCompareSelection(new Set());
          setTagFilters([]);
        }}
        title={
          <Group gap="sm">
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'ocean.5', to: 'ocean.7', deg: 135 }}>
              <IconBookmarkFilled size={18} />
            </ThemeIcon>
            <Box>
              <Text fw={600} size="lg">Meus Presets</Text>
              <Text size="xs" c="dimmed">
                {presets.length === 0
                  ? 'Nenhum preset salvo'
                  : `${presets.length} preset${presets.length > 1 ? 's' : ''} salvo${presets.length > 1 ? 's' : ''}`}
              </Text>
            </Box>
          </Group>
        }
        size="lg"
        centered
        styles={{
          body: { padding: 0 },
        }}
      >
        <Stack gap={0}>
          {/* Actions Bar */}
          <Box
            px="md"
            py="sm"
            style={{
              borderBottom: '1px solid var(--mantine-color-default-border)',
              backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
            }}
          >
            <Group justify="space-between">
              <Group gap="xs">
                {/* Quick Compare Toggle */}
                {onCompare && presets.length >= minCompareSelection && (
                  <Button
                    size="xs"
                    variant={compareMode ? 'filled' : 'light'}
                    color="ocean"
                    leftSection={<IconScale size={14} />}
                    onClick={() => {
                      setCompareMode(!compareMode);
                      if (compareMode) {
                        setCompareSelection(new Set());
                      }
                    }}
                  >
                    {compareMode ? 'Cancelar' : 'Comparar'}
                  </Button>
                )}
                
                {/* Tag Filter */}
                {allTags.length > 0 && (
                  <TagFilter
                    allTags={allTags}
                    selectedFilters={tagFilters}
                    onFilterChange={setTagFilters}
                  />
                )}
                
                <FileButton
                  onChange={handleImport}
                  accept="application/json,.json"
                  resetRef={resetRef}
                >
                  {(props) => (
                    <Button
                      {...props}
                      variant="light"
                      color="ocean"
                      size="xs"
                      leftSection={<IconUpload size={14} />}
                    >
                      Importar
                    </Button>
                  )}
                </FileButton>
                {presets.length > 0 && !compareMode && (
                  <>
                    <Button
                      variant="light"
                      color="ocean"
                      size="xs"
                      leftSection={<IconDownload size={14} />}
                      onClick={onExportAll}
                    >
                      Exportar tudo
                    </Button>
                    {selectedPresets.size > 0 && (
                      <Button
                        variant="filled"
                        color="ocean"
                        size="xs"
                        leftSection={<IconDownload size={14} />}
                        onClick={handleExportSelected}
                      >
                        Exportar ({selectedPresets.size})
                      </Button>
                    )}
                  </>
                )}
              </Group>
              {presets.length > 0 && !compareMode && (
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  leftSection={<IconTrash size={14} />}
                  onClick={openClearConfirm}
                >
                  Limpar tudo
                </Button>
              )}
            </Group>
          </Box>
          
          {/* Compare Mode Info Bar */}
          {compareMode && (
            <Box
              px="md"
              py="sm"
              style={{
                backgroundColor: 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))',
                borderBottom: '1px solid var(--mantine-color-default-border)',
              }}
            >
              <Group justify="space-between">
                <Group gap="xs">
                  <Badge size="lg" variant={canCompare ? 'filled' : 'light'} color={canCompare ? 'ocean' : 'gray'}>
                    {compareSelection.size} selecionado{compareSelection.size !== 1 ? 's' : ''}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    Selecione pelo menos {minCompareSelection} presets
                  </Text>
                </Group>
                <Button
                  size="xs"
                  color="ocean"
                  leftSection={<IconScale size={14} />}
                  disabled={!canCompare}
                  loading={isCompareLoading}
                  onClick={handleQuickCompare}
                >
                  Comparar Agora
                </Button>
              </Group>
            </Box>
          )}

          {/* Presets List */}
          {presets.length === 0 ? (
            <Box p="xl" ta="center">
              <ThemeIcon size={60} radius="xl" variant="light" color="ocean" mx="auto" mb="md">
                <IconBookmark size={30} />
              </ThemeIcon>
              <Text fw={600} size="lg" mb="xs">
                Nenhum preset salvo
              </Text>
              <Text size="sm" c="dimmed" maw={300} mx="auto" mb="md">
                Salve configurações de simulação para reutilizar depois. Você também pode importar presets de um arquivo.
              </Text>
              <Group justify="center" gap="sm">
                <Button
                  variant="light"
                  color="ocean"
                  leftSection={<IconPlus size={16} />}
                  onClick={() => {
                    close();
                    openSaveModal();
                  }}
                >
                  Salvar preset atual
                </Button>
                <FileButton
                  onChange={handleImport}
                  accept="application/json,.json"
                  resetRef={resetRef}
                >
                  {(props) => (
                    <Button
                      {...props}
                      variant="subtle"
                      color="ocean"
                      leftSection={<IconUpload size={16} />}
                    >
                      Importar arquivo
                    </Button>
                  )}
                </FileButton>
              </Group>
            </Box>
          ) : filteredPresets.length === 0 ? (
            <Box p="xl" ta="center">
              <ThemeIcon size={60} radius="xl" variant="light" color="gray" mx="auto" mb="md">
                <IconTag size={30} />
              </ThemeIcon>
              <Text fw={600} size="lg" mb="xs">
                Nenhum preset encontrado
              </Text>
              <Text size="sm" c="dimmed" maw={300} mx="auto" mb="md">
                Nenhum preset corresponde aos filtros selecionados.
              </Text>
              <Button
                variant="light"
                color="ocean"
                onClick={() => setTagFilters([])}
              >
                Limpar filtros
              </Button>
            </Box>
          ) : (
            <ScrollArea.Autosize mah={400} offsetScrollbars>
              <Stack gap={0}>
                {filteredPresets.map((preset, index) => {
                  const isSelected = compareMode
                    ? compareSelection.has(preset.id)
                    : selectedPresets.has(preset.id);
                  
                  return (
                    <Paper
                      key={preset.id}
                      p="md"
                      style={{
                        borderRadius: 0,
                        borderBottom: index < filteredPresets.length - 1 ? '1px solid var(--mantine-color-default-border)' : undefined,
                        backgroundColor: isSelected
                          ? 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-7))'
                          : undefined,
                        cursor: 'pointer',
                        transition: 'background-color 150ms ease',
                      }}
                      onClick={() => {
                        if (compareMode) {
                          toggleCompareSelection(preset.id);
                        } else {
                          toggleSelect(preset.id);
                        }
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                          {compareMode ? (
                            <Checkbox
                              checked={isSelected}
                              onChange={() => {}}
                              color="ocean"
                              size="md"
                              styles={{ input: { cursor: 'pointer' } }}
                            />
                          ) : (
                            <ThemeIcon
                              size="lg"
                              radius="md"
                              variant={isSelected ? 'filled' : 'light'}
                              color="ocean"
                            >
                              {isSelected ? (
                                <IconCheck size={16} />
                              ) : (
                                <IconBookmark size={16} />
                              )}
                            </ThemeIcon>
                          )}
                          <Box style={{ minWidth: 0, flex: 1 }}>
                            <Group gap="xs" mb={2}>
                              <Text fw={600} size="sm" truncate="end">
                                {preset.name}
                              </Text>
                              {index === 0 && (
                                <Badge size="xs" variant="light" color="ocean">
                                  Recente
                                </Badge>
                              )}
                            </Group>
                            {preset.description && (
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {preset.description}
                              </Text>
                            )}
                            {/* Tags */}
                            {preset.tags && preset.tags.length > 0 && (
                              <Box mt={4}>
                                <PresetTagList tags={preset.tags} maxVisible={3} size="xs" />
                              </Box>
                            )}
                            <Text size="xs" c="dimmed" mt={4}>
                              {formatDate(preset.updatedAt || preset.createdAt)}
                            </Text>
                          </Box>
                        </Group>
                        {!compareMode && (
                          <Group gap="xs" wrap="nowrap">
                            <Tooltip label="Carregar preset" withArrow>
                              <Button
                                variant="light"
                                color="ocean"
                                size="xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLoad(preset);
                                }}
                              >
                                Carregar
                              </Button>
                            </Tooltip>
                            <Menu shadow="md" width={160} position="bottom-end" withinPortal>
                              <Menu.Target>
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <IconDotsVertical size={16} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item
                                  leftSection={<IconPencil size={14} />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(preset);
                                  }}
                                >
                                  Editar
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<IconCopy size={14} />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicate(preset.id);
                                  }}
                                >
                                  Duplicar
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<IconDownload size={14} />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onExportSelected([preset.id]);
                                  }}
                                >
                                  Exportar
                                </Menu.Item>
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={14} />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(preset.id);
                                  }}
                                >
                                  Excluir
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Group>
                        )}
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
          )}

          {/* Footer hint */}
          {presets.length > 0 && !compareMode && (
            <Box
              px="md"
              py="sm"
              style={{
                borderTop: '1px solid var(--mantine-color-default-border)',
                backgroundColor: 'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))',
              }}
            >
              <Text size="xs" c="dimmed" ta="center">
                💡 Clique em um preset para selecioná-lo, ou use os botões para carregar diretamente
              </Text>
            </Box>
          )}
        </Stack>
      </Modal>
    </>
  );
}
