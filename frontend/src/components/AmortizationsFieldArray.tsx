import { Button, Group, NumberInput, Paper, Select, Switch, Tooltip, Table, Collapse, ActionIcon, Text } from '@mantine/core';
import { IconPlus, IconTrash, IconEye } from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import type { AmortizationInput } from '../api/types';

interface Props {
  value: AmortizationInput[];
  onChange: (val: AmortizationInput[]) => void;
  termMonths?: number; // optional for preview
  inflationRate?: number | null; // annual % to estimate inflation-adjusted total
}

export default function AmortizationsFieldArray({ value, onChange, termMonths = 360, inflationRate }: Props) {
  const [showPreview, setShowPreview] = useState(false);

  const previewData = useMemo(() => {
    // Expand recurring amortizations client-side (approximate, no inflation compounding here)
    const out: { month: number; fixed: number; pct: number; fixedInflated: number }[] = [];
    const map = new Map<number, { fixed: number; pct: number; fixedInflated: number }>();
    const monthlyInfl = inflationRate ? (Math.pow(1 + inflationRate/100, 1/12) - 1) : 0;
    (value||[]).forEach(a => {
      // Determine months
      let months: number[] = [];
      if (a.interval_months && a.interval_months > 0) {
        const start = a.month || 1;
        if (a.occurrences) {
            months = Array.from({length: a.occurrences}, (_,i)=> start + i * a.interval_months!);
        } else {
            const end = a.end_month || termMonths;
            for (let m=start; m<= Math.min(end, termMonths); m+= a.interval_months) months.push(m);
        }
      } else if (a.month) {
        months = [a.month];
      }
      const base = months[0] || 1;
      months.forEach(m => {
        if (m < 1 || m > termMonths) return;
        const entry = map.get(m) || { fixed: 0, pct: 0, fixedInflated: 0 };
        if (a.value_type === 'percentage') {
          entry.pct += a.value;
        } else {
          const nominal = a.value;
          entry.fixed += nominal;
          if (a.inflation_adjust && monthlyInfl > 0) {
            const monthsPassed = m - base;
            entry.fixedInflated += nominal * Math.pow(1 + monthlyInfl, monthsPassed);
          } else {
            entry.fixedInflated += nominal;
          }
        }
        map.set(m, entry);
      });
    });
    Array.from(map.entries()).sort((a,b)=>a[0]-b[0]).forEach(([month, v])=> out.push({ month, ...v }));
    return out;
  }, [value, termMonths, inflationRate]);

  const totals = useMemo(()=>{
    const nominalFixed = previewData.reduce((s,r)=>s+r.fixed,0);
    const inflatedFixed = previewData.reduce((s,r)=>s+r.fixedInflated,0);
    const pctList = previewData.filter(r=>r.pct>0);
    return { nominalFixed, inflatedFixed, hasPct: pctList.length>0 };
  },[previewData]);

  return (
    <div>
      <Group mb="xs" justify="space-between">
        <strong>Amortizações Extra</strong>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Pré-visualizar meses gerados"><ActionIcon variant={showPreview? 'filled':'light'} size="sm" onClick={()=>setShowPreview(s=>!s)}><IconEye size={16} /></ActionIcon></Tooltip>
          <Button leftSection={<IconPlus size={16} />} size="xs" variant="light" onClick={() => onChange([...(value||[]), { month: 12, value: 10000, value_type: 'fixed' }])}>Adicionar</Button>
        </Group>
      </Group>
      {(value||[]).length === 0 && <Paper p="xs" c="dimmed" fz="xs">Nenhuma amortização adicionada.</Paper>}
      {(value||[]).map((item, idx) => (
        <Group key={idx} mb={4} align="flex-end">
          <NumberInput label="Mês inicial" min={1} value={item.month || 1} onChange={(v) => { const arr=[...value]; arr[idx].month = Number(v)||1; onChange(arr); }} w={90} />
          <Select label="Recorrência" value={item.interval_months? 'rec':'one'} data={[{value:'one', label:'Única'},{value:'rec', label:'Recorrente'}]} onChange={(val)=> { const arr=[...value]; if(val==='rec'){ arr[idx].interval_months = arr[idx].interval_months || 12; } else { arr[idx].interval_months = null; arr[idx].end_month = null; arr[idx].occurrences = null; } onChange(arr); }} w={110} />
          {item.interval_months && (
            <>
              <NumberInput label="Intervalo" min={1} value={item.interval_months} onChange={(v)=>{ const arr=[...value]; arr[idx].interval_months = Number(v)||1; onChange(arr); }} w={90} />
              <NumberInput label="Ocorrências" min={1} value={item.occurrences || ''} placeholder="N" onChange={(v)=>{ const arr=[...value]; arr[idx].occurrences = v? Number(v): null; arr[idx].end_month = null; onChange(arr); }} w={100} />
              <NumberInput label="Fim" min={item.month||1} value={item.end_month || ''} placeholder="Mês" onChange={(v)=>{ const arr=[...value]; arr[idx].end_month = v? Number(v): null; arr[idx].occurrences = null; onChange(arr); }} w={90} />
            </>
          )}
          <Select label="Tipo" value={item.value_type || 'fixed'} onChange={(val)=>{ const arr=[...value]; arr[idx].value_type = (val as any)||'fixed'; onChange(arr); }} data={[{value:'fixed', label:'Fixo'},{value:'percentage', label:'% Saldo'}]} w={110} />
          <NumberInput label={item.value_type==='percentage'? '%':''} min={0} value={item.value} onChange={(v) => { const arr = [...value]; arr[idx].value = Number(v)||0; onChange(arr); }} thousandSeparator w={120} />
          {item.value_type !== 'percentage' && (
            <Switch label="Inflação" checked={!!item.inflation_adjust} onChange={(e)=>{ const arr=[...value]; arr[idx].inflation_adjust = e.currentTarget.checked; onChange(arr); }} />
          )}
          <Button color="red" variant="subtle" size="xs" onClick={() => onChange(value.filter((_, i) => i!==idx))} leftSection={<IconTrash size={14} />}>Remover</Button>
        </Group>
      ))}
      <Collapse in={showPreview} mt="sm">
        <Paper p="sm" withBorder radius="md">
          <Text fw={500} size="xs" mb={4}>Pré-visualização (aprox.)</Text>
          {previewData.length === 0 && <Text size="xs" c="dimmed">Nenhum mês gerado.</Text>}
          {previewData.length>0 && (
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr><Table.Th>Mês</Table.Th><Table.Th>Fixos</Table.Th><Table.Th>% Saldo</Table.Th><Table.Th>Fixo Ajust.</Table.Th></Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {previewData.slice(0,50).map(r=> (
                  <Table.Tr key={r.month}><Table.Td>{r.month}</Table.Td><Table.Td>{r.fixed.toLocaleString('pt-BR',{style:'currency', currency:'BRL'})}</Table.Td><Table.Td>{r.pct.toFixed(2)}%</Table.Td><Table.Td>{r.fixedInflated.toLocaleString('pt-BR',{style:'currency', currency:'BRL'})}</Table.Td></Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          {previewData.length>50 && <Text size="10px" c="dimmed">Mostrando primeiros 50 de {previewData.length} meses.</Text>}
          <Group gap={12} mt={6} wrap="wrap">
            <Text size="xs" c="dimmed">Total fixo nominal: <strong>{totals.nominalFixed.toLocaleString('pt-BR',{style:'currency', currency:'BRL'})}</strong></Text>
            <Text size="xs" c="dimmed">Total fixo ajustado: <strong>{totals.inflatedFixed.toLocaleString('pt-BR',{style:'currency', currency:'BRL'})}</strong></Text>
            {totals.hasPct && <Text size="xs" c="dimmed">Há amortizações percentuais (valor depende do saldo).</Text>}
          </Group>
        </Paper>
      </Collapse>
    </div>
  );
}
