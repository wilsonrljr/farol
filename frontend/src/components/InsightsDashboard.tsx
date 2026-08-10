import { useId, useMemo } from 'react';
import {
  Stack,
  Group,
  Text,
  Box,
  ThemeIcon,
  Badge,
  SimpleGrid,
  rem,
  Divider,
  Alert,
} from '@mantine/core';
import {
  IconBulb,
  IconTrendingUp,
  IconTrendingDown,
  IconAlertTriangle,
  IconCoin,
  IconChartLine,
  IconBuildingBank,
  IconPigMoney,
  IconTarget,
  IconClock,
  IconPercentage,
  IconScale,
  IconArrowRight,
  IconInfoCircle,
} from '@tabler/icons-react';
import {
  BatchComparisonResult,
  BatchComparisonResultItem,
  ComparisonScenarioType,
} from '../api/types';
import { money, moneyCompact, percent, formatMonthsYears } from '../utils/format';

// Types for insights
type InsightType = 'success' | 'warning' | 'info' | 'opportunity';
type InsightCategory = 'wealth' | 'cost' | 'scenario' | 'risk' | 'opportunity';

interface Insight {
  id: string;
  type: InsightType;
  category: InsightCategory;
  title: string;
  description: string;
  value?: string;
  icon: React.ReactNode;
  priority: number; // 1-10, higher is more important
}

interface InsightsDashboardProps {
  result: BatchComparisonResult;
}

// Color mapping for insight types
const INSIGHT_COLORS: Record<InsightType, string> = {
  success: 'emerald',
  warning: 'amber',
  info: 'sky',
  opportunity: 'violet',
};

const SCENARIO_LABELS: Record<ComparisonScenarioType, string> = {
  buy: 'Comprar',
  rent_invest: 'Alugar e investir',
  invest_buy: 'Investir para comprar',
};

function InsightCard({ insight }: { insight: Insight }) {
  const color = INSIGHT_COLORS[insight.type];
  const titleId = useId();
  
  return (
    <Box
      component="article"
      aria-labelledby={titleId}
      p="md"
      style={{
        background: 'var(--farol-surface-raised)',
        border: '1px solid var(--farol-border)',
        borderInlineStart: `3px solid var(--mantine-color-${color}-5)`,
        borderRadius: rem(12),
        height: '100%',
      }}
    >
      <Group gap="md" wrap="nowrap" align="flex-start">
        <ThemeIcon
          size="lg"
          radius="xl"
          variant="light"
          color={color}
        >
          {insight.icon}
        </ThemeIcon>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" mb={4} wrap="wrap">
            <Text id={titleId} component="h3" fw={650} size="sm">
              {insight.title}
            </Text>
            {insight.value && (
              <Badge size="sm" color={color} variant="light">
                {insight.value}
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed" style={{ lineHeight: 1.5 }}>
            {insight.description}
          </Text>
        </Box>
      </Group>
    </Box>
  );
}

// Utility functions for insight generation
function calculateWealthSpread(results: BatchComparisonResultItem[]): {
  best: number;
  worst: number;
  spread: number;
  spreadPercentage: number;
} | null {
  const wealthValues = results.flatMap((r) =>
    r.result.comparison_status === 'comparable'
      ? r.result.scenarios
          .filter((s) => s.is_feasible !== false)
          .map((s) => s.final_wealth ?? s.final_equity)
      : []
  );
  if (wealthValues.length === 0) return null;
  const best = Math.max(...wealthValues);
  const worst = Math.min(...wealthValues);
  const spread = best - worst;
  const spreadPercentage = worst > 0 ? (spread / worst) * 100 : 0;
  
  return { best, worst, spread, spreadPercentage };
}

function analyzeScenarioConsistency(results: BatchComparisonResultItem[]): {
  dominantScenario: string | null;
  dominantCount: number;
  total: number;
} {
  const winCounts: Record<string, number> = {};
  let comparableTotal = 0;
  
  for (const item of results) {
    const winner = item.result.best_scenario_type;
    if (winner == null || item.result.comparison_status !== 'comparable') continue;
    comparableTotal += 1;
    winCounts[winner] = (winCounts[winner] || 0) + 1;
  }
  
  const entries = Object.entries(winCounts);
  if (entries.length === 0) return { dominantScenario: null, dominantCount: 0, total: 0 };
  
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const [dominantScenario, dominantCount] = sorted[0];
  
  return { dominantScenario, dominantCount, total: comparableTotal };
}

function analyzeROI(results: BatchComparisonResultItem[]): {
  avgROI: number;
  bestROI: number;
  worstROI: number;
  bestROIPreset: string;
  bestROIScenario: string;
} | null {
  const roiValues: { value: number; preset: string; scenario: string }[] = [];
  
  for (const item of results) {
    if (item.result.comparison_status !== 'comparable') continue;
    for (const scenario of item.result.scenarios) {
      const value = scenario.metrics.roi_percentage;
      if (scenario.is_feasible === false || value == null || !Number.isFinite(value)) continue;
      roiValues.push({
        value,
        preset: item.preset_name,
        scenario: scenario.name,
      });
    }
  }
  if (roiValues.length === 0) return null;
  
  const avgROI = roiValues.reduce((sum, r) => sum + r.value, 0) / roiValues.length;
  const sorted = [...roiValues].sort((a, b) => b.value - a.value);
  const bestROI = sorted[0];
  const worstROI = sorted[sorted.length - 1];
  
  return {
    avgROI,
    bestROI: bestROI.value,
    worstROI: worstROI.value,
    bestROIPreset: bestROI.preset,
    bestROIScenario: bestROI.scenario,
  };
}

function generateInsights(result: BatchComparisonResult): Insight[] {
  const insights: Insight[] = [];
  const { results, global_best } = result;
  
  if (results.length === 0) return insights;

  if (
    result.comparison_status === 'no_authoritative_result' ||
    global_best == null
  ) {
    insights.push({
      id: 'no-comparable-ranking',
      type: 'warning',
      category: 'risk',
      title: 'Sem ranking comparável',
      description: 'Os presets usam bases de recursos diferentes ou não possuem fluxo viável. Consulte cada cartão separadamente; estes dados não sustentam um campeão global nem recomendações de parâmetros.',
      icon: <IconScale size={16} />,
      priority: 10,
    });
    return insights;
  }
  
  // 1. Best Wealth Insight
  insights.push({
    id: 'best-wealth',
    type: 'success',
    category: 'wealth',
    title: 'Maior patrimônio comparável',
    description: `O cenário "${global_best.scenario_name}" do preset "${global_best.preset_name}" termina com o maior patrimônio entre as combinações comparáveis e viáveis analisadas.`,
    value: money(global_best.final_wealth),
    icon: <IconCoin size={16} />,
    priority: 10,
  });

  if (result.comparison_status === 'partial') {
    insights.push({
      id: 'partial-ranking',
      type: 'warning',
      category: 'risk',
      title: 'Ranking parcial',
      description: 'O destaque acima considera apenas presets e cenários comparáveis. Resultados exploratórios ou inviáveis foram excluídos; por isso não é seguro generalizar os demais insights agregados.',
      icon: <IconAlertTriangle size={16} />,
      priority: 9,
    });
    return insights;
  }
  
  // 2. Wealth Spread Analysis
  const wealthSpread = calculateWealthSpread(results);
  if (wealthSpread != null && wealthSpread.spread > 0) {
    const significantSpread = wealthSpread.spreadPercentage > 20;
    insights.push({
      id: 'wealth-spread',
      type: significantSpread ? 'warning' : 'info',
      category: 'wealth',
      title: significantSpread ? 'Grande Variação de Resultados' : 'Variação de Patrimônio',
      description: significantSpread
        ? `A amplitude observada entre o maior e o menor patrimônio é de ${money(wealthSpread.spread)} (${percent(wealthSpread.spreadPercentage)}). Como há várias premissas, este dado não identifica qual parâmetro causou a diferença.`
        : `A amplitude observada entre patrimônios é de ${money(wealthSpread.spread)}; ela não isola o efeito de uma premissa específica.`,
      value: moneyCompact(wealthSpread.spread),
      icon: <IconScale size={16} />,
      priority: significantSpread ? 8 : 5,
    });
  }
  
  // 3. Scenario Consistency Analysis
  const consistency = analyzeScenarioConsistency(results);
  if (consistency.dominantScenario && consistency.total > 1) {
    const dominanceRatio = consistency.dominantCount / consistency.total;
    if (dominanceRatio >= 0.7) {
      insights.push({
        id: 'scenario-dominance',
        type: 'success',
        category: 'scenario',
        title: 'Cenário Consistente',
        description: `O cenário "${SCENARIO_LABELS[consistency.dominantScenario as ComparisonScenarioType] ?? consistency.dominantScenario}" foi o vencedor válido em ${consistency.dominantCount} de ${consistency.total} presets (${percent(dominanceRatio * 100)}). Isso descreve somente estas simulações e não demonstra vantagem fora delas.`,
        value: `${consistency.dominantCount}/${consistency.total}`,
        icon: <IconTarget size={16} />,
        priority: 7,
      });
    } else if (dominanceRatio < 0.5 && consistency.total >= 3) {
      insights.push({
        id: 'scenario-variety',
        type: 'info',
        category: 'scenario',
        title: 'Resultados Variados',
        description: `Não há um cenário claramente dominante. Diferentes configurações de parâmetros favorecem diferentes estratégias. Analise os detalhes de cada preset para entender os fatores determinantes.`,
        icon: <IconChartLine size={16} />,
        priority: 6,
      });
    }
  }
  
  // 4. ROI Analysis
  const roiAnalysis = analyzeROI(results);
  if (roiAnalysis != null && roiAnalysis.bestROI > 0) {
    insights.push({
      id: 'best-roi',
      type: 'opportunity',
      category: 'opportunity',
      title: 'Maior retorno comparável',
      description: `Entre os cenários em que o retorno comparável é definido, "${roiAnalysis.bestROIScenario}" no preset "${roiAnalysis.bestROIPreset}" apresenta ${percent(roiAnalysis.bestROI)}.`,
      value: percent(roiAnalysis.bestROI),
      icon: <IconPercentage size={16} />,
      priority: 7,
    });
  }
  
  if (roiAnalysis != null && roiAnalysis.worstROI < 0) {
    insights.push({
      id: 'negative-roi-warning',
      type: 'warning',
      category: 'risk',
      title: 'Retorno comparável negativo',
      description: `Alguns cenários com retorno definido chegam a ${percent(roiAnalysis.worstROI)}. Revise o patrimônio final e as premissas antes de interpretar esse indicador isoladamente.`,
      value: percent(roiAnalysis.worstROI),
      icon: <IconTrendingDown size={16} />,
      priority: 9,
    });
  }
  
  // 5. Scenario-specific insights
  const scenarioWins: Record<string, number> = {};
  let comparableResultsCount = 0;
  results.forEach((r) => {
    const winner = r.result.best_scenario_type;
    if (winner == null || r.result.comparison_status !== 'comparable') return;
    comparableResultsCount += 1;
    scenarioWins[winner] = (scenarioWins[winner] || 0) + 1;
  });
  
  // Buy scenario wins
  const buyWins = scenarioWins.buy || 0;
  if (buyWins > 0 && buyWins === comparableResultsCount) {
    insights.push({
      id: 'buy-always-wins',
      type: 'info',
      category: 'scenario',
      title: 'Comprar venceu nestes presets',
      description: 'Comprar teve o maior patrimônio líquido em todas as configurações comparáveis analisadas. O resultado não isola qual premissa foi responsável.',
      icon: <IconBuildingBank size={16} />,
      priority: 6,
    });
  }
  
  // Invest scenario wins
  const rentWins = scenarioWins.rent_invest || 0;
  if (rentWins > 0 && rentWins === comparableResultsCount) {
    insights.push({
      id: 'rent-always-wins',
      type: 'info',
      category: 'scenario',
      title: 'Alugar e investir venceu nestes presets',
      description: 'Alugar e investir teve o maior patrimônio líquido em todas as configurações comparáveis analisadas, sem atribuição causal a uma premissa específica.',
      icon: <IconChartLine size={16} />,
      priority: 6,
    });
  }
  
  // Invest then buy scenario wins
  const investBuyWins = scenarioWins.invest_buy || 0;
  if (investBuyWins > 0 && investBuyWins === comparableResultsCount) {
    insights.push({
      id: 'invest-buy-always-wins',
      type: 'info',
      category: 'scenario',
      title: 'Investir para comprar venceu nestes presets',
      description: 'Investir para comprar teve o maior patrimônio líquido em todas as configurações comparáveis analisadas; a conclusão vale apenas para essas premissas.',
      icon: <IconPigMoney size={16} />,
      priority: 6,
    });
  }
  
  // 6. Compare presets with best of each
  if (results.length >= 2) {
    const presetBestScenarios = results.flatMap((r) => {
      if (
        r.result.comparison_status !== 'comparable' ||
        r.result.best_scenario_type == null
      ) return [];
      const winner = r.result.scenarios.find(
        (scenario) => scenario.scenario_type === r.result.best_scenario_type
      );
      if (!winner) return [];
      return [{
        preset: r.preset_name,
        best: winner.scenario_type,
        wealth: winner.final_wealth ?? winner.final_equity,
      }];
    });
    
    const sorted = presetBestScenarios.sort((a, b) => b.wealth - a.wealth);
    const bestPreset = sorted[0];
    const secondBest = sorted[1];
    
    if (bestPreset && secondBest && bestPreset.wealth > secondBest.wealth) {
      const diff = bestPreset.wealth - secondBest.wealth;
      const diffPercent = secondBest.wealth !== 0
        ? (diff / Math.abs(secondBest.wealth)) * 100
        : null;
      
      if (diffPercent != null && diffPercent > 5) {
        insights.push({
          id: 'preset-comparison',
          type: 'opportunity',
          category: 'opportunity',
          title: 'Diferença entre Presets',
          description: `O preset "${bestPreset.preset}" terminou com ${money(diff)} a mais que "${secondBest.preset}" (${percent(diffPercent)} de diferença). Como várias premissas podem mudar juntas, a comparação não identifica a causa.`,
          value: moneyCompact(diff),
          icon: <IconArrowRight size={16} />,
          priority: 7,
        });
      }
    }
  }
  
  // 7. Break-even analysis
  const breakEvenMonths = results.flatMap((r) =>
    r.result.comparison_status === 'comparable' ? r.result.scenarios
      .filter((s) => s.is_feasible !== false)
      .filter((s) => s.metrics.break_even_month != null)
      .map((s) => ({
        preset: r.preset_name,
        scenario: s.name,
        month: s.metrics.break_even_month!,
      })) : []
  );
  
  if (breakEvenMonths.length > 0) {
    const minBreakEven = Math.min(...breakEvenMonths.map((b) => b.month));
    const maxBreakEven = Math.max(...breakEvenMonths.map((b) => b.month));
    
    if (maxBreakEven - minBreakEven > 24) {
      insights.push({
        id: 'break-even-variation',
        type: 'info',
        category: 'cost',
        title: 'Variação no Ponto de Equilíbrio',
        description: `O ponto de equilíbrio varia de ${formatMonthsYears(minBreakEven)} a ${formatMonthsYears(maxBreakEven)} dependendo do cenário e preset. Considere seu horizonte de tempo ao escolher.`,
        icon: <IconClock size={16} />,
        priority: 5,
      });
    }
  }
  
  // Sort by priority
  return insights.sort((a, b) => b.priority - a.priority);
}

export default function InsightsDashboard({ result }: InsightsDashboardProps) {
  const insights = useMemo(() => generateInsights(result), [result]);
  const titleId = useId();
  
  if (insights.length === 0) {
    return (
      <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
        Não há dados comparáveis suficientes para sintetizar estes resultados.
      </Alert>
    );
  }
  
  const criticalInsights = insights.filter((i) => i.type === 'warning' && i.priority >= 8);
  const primaryInsights = insights.filter(
    (i) => i.priority >= 7 && !criticalInsights.some((critical) => critical.id === i.id)
  );
  const secondaryInsights = insights.filter((i) => i.priority < 7);
  
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      p="lg"
      style={{
        background: 'var(--farol-surface-raised)',
        border: '1px solid var(--farol-border)',
        boxShadow: 'none',
        borderRadius: 'var(--mantine-radius-lg)',
      }}
    >
      <Group gap="sm" mb="lg">
        <ThemeIcon
          size="lg"
          radius="md"
          variant="light"
          color="violet"
        >
          <IconBulb size={20} />
        </ThemeIcon>
        <Box>
          <Text id={titleId} component="h2" fw={600} size="lg">
            Leitura dos resultados
          </Text>
          <Text size="xs" c="dimmed">
            Síntese descritiva, sem atribuir causalidade ou criar recomendações.
          </Text>
        </Box>
      </Group>
      
      <Stack gap="md">
        {criticalInsights.length > 0 && (
          <Stack gap="sm">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Pontos de atenção
            </Text>
            {criticalInsights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </Stack>
        )}

        {/* Primary insights in a grid */}
        {primaryInsights.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {primaryInsights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </SimpleGrid>
        )}
        
        {/* Secondary insights */}
        {secondaryInsights.length > 0 && (
          <>
            {(primaryInsights.length > 0 || criticalInsights.length > 0) && (
              <Divider
                label={
                  <Text size="xs" c="dimmed" fw={500}>
                    Outros insights
                  </Text>
                }
                labelPosition="center"
              />
            )}
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {secondaryInsights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))}
            </SimpleGrid>
          </>
        )}
      </Stack>
    </Box>
  );
}
