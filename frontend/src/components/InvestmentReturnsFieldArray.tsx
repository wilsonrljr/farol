import { Button, Group, NumberInput, Paper } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';

interface Item { start_month: number; end_month?: number | null; annual_rate: number; }
interface Props { value: Item[]; onChange: (val: Item[]) => void; }

export default function InvestmentReturnsFieldArray({ value, onChange }: Props) {
  return (
    <div>
      <Group mb="xs" justify="space-between">
        <strong>Retornos de Investimento</strong>
        <Button leftSection={<IconPlus size={16} />} size="xs" variant="light" onClick={() => onChange([...(value||[]), { start_month: 1, end_month: null, annual_rate: 8 }])}>Adicionar</Button>
      </Group>
      {(value||[]).length === 0 && <Paper p="xs" c="dimmed" fz="xs">Nenhum retorno configurado.</Paper>}
      {(value||[]).map((item, idx) => (
        <Group key={idx} mb={4} align="flex-end">
          <NumberInput label="Início (mês)" min={1} value={item.start_month} onChange={(v) => { const arr=[...value]; arr[idx].start_month=Number(v); onChange(arr); }} />
          <NumberInput label="Fim (mês)" min={1} value={item.end_month ?? undefined} onChange={(v) => { const arr=[...value]; arr[idx].end_month = v===undefined? null: Number(v); onChange(arr); }} placeholder="∞" />
          <NumberInput label="Taxa Anual %" min={0} max={200} value={item.annual_rate} onChange={(v) => { const arr=[...value]; arr[idx].annual_rate=Number(v); onChange(arr); }} />
          <Button color="red" variant="subtle" size="xs" leftSection={<IconTrash size={14} />} onClick={() => onChange(value.filter((_,i)=>i!==idx))}>Remover</Button>
        </Group>
      ))}
    </div>
  );
}
