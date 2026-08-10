import { useState, useMemo } from 'react';
import {
  Badge,
  Group,
  Menu,
  ActionIcon,
  Text,
  Box,
  Popover,
  Stack,
  TextInput,
  Button,
  rem,
  Tooltip,
  UnstyledButton,
  ScrollArea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus,
  IconX,
  IconTag,
  IconCheck,
  IconFilter,
} from '@tabler/icons-react';
import {
  PresetTag,
  PresetTagType,
  DEFAULT_TAGS,
  MAX_PRESET_TAG_LABEL_LENGTH,
  createTag,
} from '../utils/presets';

// Color mapping for Mantine color names
const TAG_COLORS: Record<string, string> = {
  blue: 'blue',
  ocean: 'ocean',
  orange: 'orange',
  green: 'green',
  red: 'red',
  pink: 'pink',
  cyan: 'cyan',
  grape: 'grape',
  indigo: 'indigo',
  teal: 'teal',
  gray: 'gray',
};

interface PresetTagBadgeProps {
  tag: PresetTag;
  onRemove?: () => void;
  size?: 'xs' | 'sm' | 'md';
}

export function PresetTagBadge({ tag, onRemove, size = 'sm' }: PresetTagBadgeProps) {
  return (
    <Badge
      size={size}
      color={TAG_COLORS[tag.color] || 'gray'}
      variant="light"
      rightSection={
        onRemove && (
          <ActionIcon
            size={24}
            radius="xl"
            variant="transparent"
            color={TAG_COLORS[tag.color] || 'gray'}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label={`Remover tag ${tag.label}`}
          >
            <IconX size={13} />
          </ActionIcon>
        )
      }
      style={{ cursor: onRemove ? 'pointer' : 'default' }}
    >
      {tag.label}
    </Badge>
  );
}

interface PresetTagListProps {
  tags: PresetTag[];
  onRemove?: (tagId: string) => void;
  maxVisible?: number;
  size?: 'xs' | 'sm' | 'md';
}

export function PresetTagList({
  tags,
  onRemove,
  maxVisible = 3,
  size = 'xs',
}: PresetTagListProps) {
  if (!tags || tags.length === 0) return null;

  const visibleTags = tags.slice(0, maxVisible);
  const hiddenCount = tags.length - maxVisible;

  return (
    <Group gap={4} wrap="wrap">
      {visibleTags.map((tag) => (
        <PresetTagBadge
          key={tag.id}
          tag={tag}
          size={size}
          onRemove={onRemove ? () => onRemove(tag.id) : undefined}
        />
      ))}
      {hiddenCount > 0 && (
        <Tooltip
          label={tags.slice(maxVisible).map((t) => t.label).join(', ')}
          withArrow
        >
          <Badge size={size} color="gray" variant="light">
            +{hiddenCount}
          </Badge>
        </Tooltip>
      )}
    </Group>
  );
}

interface TagSelectorProps {
  selectedTags: PresetTag[];
  onAddTag: (tagType: PresetTagType, customLabel?: string) => void;
  onRemoveTag: (tagId: string) => void;
  availableTags?: PresetTagType[];
  compact?: boolean;
}

export function TagSelector({
  selectedTags,
  onAddTag,
  onRemoveTag,
  availableTags,
}: TagSelectorProps) {
  const [opened, { toggle, open, close }] = useDisclosure(false);
  const [customLabel, setCustomLabel] = useState('');

  const tagOptions = useMemo(() => {
    const available = availableTags || (Object.keys(DEFAULT_TAGS) as PresetTagType[]);
    return available.filter(
      (type) => !selectedTags.some((t) => t.type === type)
    );
  }, [availableTags, selectedTags]);

  const handleAddTag = (type: PresetTagType) => {
    onAddTag(type);
    close();
  };

  const handleAddCustomTag = () => {
    if (customLabel.trim()) {
      onAddTag('custom', customLabel.trim());
      setCustomLabel('');
      close();
    }
  };

  return (
    <Group gap="xs" wrap="wrap">
      {selectedTags.map((tag) => (
        <PresetTagBadge
          key={tag.id}
          tag={tag}
          size="sm"
          onRemove={() => onRemoveTag(tag.id)}
        />
      ))}
      
      <Popover
        opened={opened}
        onChange={(nextOpened) => (nextOpened ? open() : close())}
        position="bottom-start"
        withinPortal
        shadow="md"
      >
        <Popover.Target>
          <ActionIcon
            size={44}
            variant="light"
            color="ocean"
            onClick={toggle}
            radius="xl"
            aria-label="Adicionar tag"
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown p="sm">
          <Stack gap="xs">
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              Adicionar tag
            </Text>
            <ScrollArea.Autosize mah={200}>
              <Stack gap={4}>
                {tagOptions.length === 0 && (
                  <Text size="sm" c="dimmed" py="xs">
                    Todas as tags disponíveis já foram adicionadas.
                  </Text>
                )}
                {tagOptions.map((type) => {
                  const tag = DEFAULT_TAGS[type];
                  return (
                    <UnstyledButton
                      key={type}
                      onClick={() => handleAddTag(type)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: rem(8),
                        padding: `${rem(6)} ${rem(8)}`,
                        borderRadius: rem(6),
                        minHeight: rem(44),
                        width: '100%',
                      }}
                    >
                      <Badge
                        size="sm"
                        color={TAG_COLORS[tag.color] || 'gray'}
                        variant="light"
                      >
                        {tag.label}
                      </Badge>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
            
            {/* Custom tag input */}
            <Box pt="xs" style={{ borderTop: '1px solid light-dark(rgba(0, 0, 0, 0.06), rgba(255, 255, 255, 0.08))' }}>
              <Text size="xs" c="dimmed" mb={4}>
                Tag personalizada:
              </Text>
              <Group gap="xs">
                <TextInput
                  size="xs"
                  placeholder="Nome da tag"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  maxLength={MAX_PRESET_TAG_LABEL_LENGTH}
                  style={{ flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomTag();
                    }
                  }}
                />
                <ActionIcon
                  size={44}
                  color="ocean"
                  variant="filled"
                  onClick={handleAddCustomTag}
                  disabled={!customLabel.trim()}
                  aria-label="Adicionar tag personalizada"
                >
                  <IconCheck size={12} />
                </ActionIcon>
              </Group>
            </Box>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}

interface TagFilterProps {
  allTags: PresetTag[];
  selectedFilters: PresetTagType[];
  onFilterChange: (filters: PresetTagType[]) => void;
}

export function TagFilter({
  allTags,
  selectedFilters,
  onFilterChange,
}: TagFilterProps) {
  const [opened, { toggle, open, close }] = useDisclosure(false);

  const toggleFilter = (type: PresetTagType) => {
    if (selectedFilters.includes(type)) {
      onFilterChange(selectedFilters.filter((t) => t !== type));
    } else {
      onFilterChange([...selectedFilters, type]);
    }
  };

  const clearFilters = () => {
    onFilterChange([]);
    close();
  };

  if (allTags.length === 0) return null;

  return (
    <Popover
      opened={opened}
      onChange={(nextOpened) => (nextOpened ? open() : close())}
      position="bottom-start"
      withinPortal
      shadow="md"
    >
      <Popover.Target>
        <Button
          size="xs"
          variant={selectedFilters.length > 0 ? 'filled' : 'light'}
          color="ocean"
          leftSection={<IconFilter size={14} />}
          rightSection={
            selectedFilters.length > 0 && (
              <Badge size="xs" color="white" variant="filled" circle>
                {selectedFilters.length}
              </Badge>
            )
          }
          onClick={toggle}
          mih={44}
        >
          Filtrar
        </Button>
      </Popover.Target>
      <Popover.Dropdown p="sm">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              Filtrar por tag
            </Text>
            {selectedFilters.length > 0 && (
              <Button size="xs" variant="subtle" color="gray" onClick={clearFilters}>
                Limpar
              </Button>
            )}
          </Group>
          <Group gap="xs" wrap="wrap">
            {allTags.map((tag) => {
              const isSelected = selectedFilters.includes(tag.type);
              return (
                <UnstyledButton
                  key={tag.type}
                  onClick={() => toggleFilter(tag.type)}
                  aria-pressed={isSelected}
                  aria-label={`Filtrar por ${tag.label}`}
                  style={{ minHeight: rem(44), display: 'inline-flex', alignItems: 'center' }}
                >
                  <Badge
                    size="sm"
                    color={TAG_COLORS[tag.color] || 'gray'}
                    variant={isSelected ? 'filled' : 'light'}
                    style={{ cursor: 'pointer' }}
                    leftSection={isSelected && <IconCheck size={10} />}
                  >
                    {tag.label}
                  </Badge>
                </UnstyledButton>
              );
            })}
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
