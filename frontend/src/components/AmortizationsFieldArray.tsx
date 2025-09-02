import { Button, Group, NumberInput, Paper } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

interface Props {
  value: { month: number; value: number }[];
  onChange: (val: { month: number; value: number }[]) => void;
}

export default function AmortizationsFieldArray({ value, onChange }: Props) {
  return (
    <div>
      <Group mb="xs" justify="space-between">
        <strong>Amortizações Extra</strong>
        <Button leftSection={<IconPlus size={16} />} size="xs" variant="light" onClick={() => onChange([...(value||[]), { month: 1, value: 1000 }])}>Adicionar</Button>
      </Group>
      {(value||[]).length === 0 && <Paper p="xs" c="dimmed" fz="xs">Nenhuma amortização adicionada.</Paper>}
      {(value||[]).map((item, idx) => (
        <Group key={idx} mb={4} align="flex-end">
          <NumberInput label="Mês" min={1} value={item.month} onChange={(v) => {
            const arr = [...value]; arr[idx].month = Number(v); onChange(arr);
          }} />
          <NumberInput label="Valor" min={0} value={item.value} onChange={(v) => { const arr = [...value]; arr[idx].value = Number(v); onChange(arr); }} thousandSeparator />
          <Button color="red" variant="subtle" size="xs" onClick={() => onChange(value.filter((_, i) => i!==idx))} leftSection={<IconTrash size={14} />}>Remover</Button>
        </Group>
      ))}
    </div>
  );
}
