import { useMemo } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Box,
  ThemeIcon,
  Badge,
  SimpleGrid,
  rem,
  Divider,
  Tooltip,
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
  EnhancedComparisonScenario,
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
  success: 'sage',
  warning: 'orange',
  info: 'blue',
  opportunity: 'grape',
};

const INSIGHT_ICONS: Record<InsightType, React.ReactNode> = {
  success: <IconTrendingUp size={16} />,
  warning: <IconAlertTriangle size={16} />,
  info: <IconInfoCircle size={16} />,
  opportunity: <IconBulb size={16} />,
};

function InsightCard({ insight }: { insight: Insight }) {
  const color = INSIGHT_COLORS[insight.type];
  
  return (
    <Paper
      p="md"
      radius="lg"
      style={{
        border: `1px solid var(--mantine-color-${color}-3)`,
        backgroundColor: `light-dark(var(--mantine-color-${color}-0), var(--mantine-color-dark-7))`,
      }}
    >
      <Group gap="md" wrap="nowrap" align="flex-start">
        <ThemeIcon
          size="lg"
          radius="md"
          variant="light"
          color={color}
        >
          {insight.icon}
        </ThemeIcon>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" mb={4}>
            <Text fw={600} size="sm">
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
    </Paper>
  );
}

// Utility functions for insight generation
function calculateWealthSpread(results: BatchComparisonResultItem[]): {
  best: number;
  worst: number;
  spread: number;
  spreadPercentage: number;
} {
  const wealthValues = results.flatMap((r) =>
    r.result.scenarios.map((s) => s.final_wealth ?? s.final_equity)
  );
  const best = Math.max(...wealthValues);
  const worst = Math.min(...wealthValues);
  const spread = best - worst;
  const spreadPercentage = worst > 0 ? (spread / worst) * 100 : 0;
  
  return { best, worst, spread, spreadPercentage };
}

function findBestAndWorstScenarios(results: BatchComparisonResultItem[]): {
  bestPreset: string;
  bestScenario: string;
  bestWealth: number;
  worstPreset: string;
  worstScenario: string;
  worstWealth: number;
} {
  let bestPreset = '';
  let bestScenario = '';
  let bestWealth = -Infinity;
  let worstPreset = '';
  let worstScenario = '';
  let worstWealth = Infinity;
  
  for (const item of results) {
    for (const scenario of item.result.scenarios) {
      const wealth = scenario.final_wealth ?? scenario.final_equity;
      if (wealth > bestWealth) {
        bestWealth = wealth;
        bestPreset = item.preset_name;
        bestScenario = scenario.name;
      }
      if (wealth < worstWealth) {
        worstWealth = wealth;
        worstPreset = item.preset_name;
        worstScenario = scenario.name;
      }
    }
  }
  
  return { bestPreset, bestScenario, bestWealth, worstPreset, worstScenario, worstWealth };
}

function analyzeScenarioConsistency(results: BatchComparisonResultItem[]): {
  dominantScenario: string | null;
  dominantCount: number;
  total: number;
} {
  const winCounts: Record<string, number> = {};
  
  for (const item of results) {
    const winner = item.result.best_scenario;
    winCounts[winner] = (winCounts[winner] || 0) + 1;
  }
  
  const entries = Object.entries(winCounts);
  if (entries.length === 0) return { dominantScenario: null, dominantCount: 0, total: results.length };
  
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const [dominantScenario, dominantCount] = sorted[0];
  
  return { dominantScenario, dominantCount, total: results.length };
}

function analyzeROI(results: BatchComparisonResultItem[]): {
  avgROI: number;
  bestROI: number;
  worstROI: number;
  bestROIPreset: string;
  bestROIScenario: string;
} {
  const roiValues: { value: number; preset: string; scenario: string }[] = [];
  
  for (const item of results) {
    for (const scenario of item.result.scenarios) {
      roiValues.push({
        value: scenario.metrics.roi_percentage,
        preset: item.preset_name,
        scenario: scenario.name,
      });
    }
  }
  
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

function analyzeInterestRates(results: BatchComparisonResultItem[]): {
  hasVariation: boolean;
  impactDescription: string | null;
} {
  // This would need access to the input data, simplified for now
  return { hasVariation: false, impactDescription: null };
}

function generateInsights(result: BatchComparisonResult): Insight[] {
  const insights: Insight[] = [];
  const { results, global_best, ranking } = result;
  
  if (results.length === 0) return insights;
  
  // 1. Best Wealth Insight
  insights.push({
    id: 'best-wealth',
    type: 'success',
    category: 'wealth',
    title: 'Melhor Resultado',
    description: `O cenário "${global_best.scenario_name}" do preset "${global_best.preset_name}" gera o maior patrimônio final entre todas as combinações analisadas.`,
    value: money(global_best.final_wealth),
    icon: <IconCoin size={16} />,
    priority: 10,
  });
  
  // 2. Wealth Spread Analysis
  const wealthSpread = calculateWealthSpread(results);
  if (wealthSpread.spread > 0) {
    const significantSpread = wealthSpread.spreadPercentage > 20;
    insights.push({
      id: 'wealth-spread',
      type: significantSpread ? 'warning' : 'info',
      category: 'wealth',
      title: significantSpread ? 'Grande Variação de Resultados' : 'Variação de Patrimônio',
      description: significantSpread
        ? `A diferença entre o melhor e o pior cenário é de ${money(wealthSpread.spread)} (${percent(wealthSpread.spreadPercentage)}). A escolha dos parâmetros impacta significativamente o resultado final.`
        : `A diferença entre o melhor e pior cenário é de ${money(wealthSpread.spread)}.`,
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
        description: `O cenário "${consistency.dominantScenario}" foi o melhor em ${consistency.dominantCount} de ${consistency.total} presets (${percent(dominanceRatio * 100)}). Esta estratégia tende a ser a mais vantajosa para os parâmetros analisados.`,
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
  if (roiAnalysis.bestROI > 0) {
    insights.push({
      id: 'best-roi',
      type: 'opportunity',
      category: 'opportunity',
      title: 'Melhor Retorno sobre Investimento',
      description: `O cenário "${roiAnalysis.bestROIScenario}" no preset "${roiAnalysis.bestROIPreset}" apresenta o melhor ROI de ${percent(roiAnalysis.bestROI)}.`,
      value: percent(roiAnalysis.bestROI),
      icon: <IconPercentage size={16} />,
      priority: 7,
    });
  }
  
  if (roiAnalysis.worstROI < 0) {
    insights.push({
      id: 'negative-roi-warning',
      type: 'warning',
      category: 'risk',
      title: 'ROI Negativo Detectado',
      description: `Alguns cenários apresentam ROI negativo (até ${percent(roiAnalysis.worstROI)}), indicando perda de patrimônio em termos reais. Considere ajustar os parâmetros para melhorar o retorno.`,
      value: percent(roiAnalysis.worstROI),
      icon: <IconTrendingDown size={16} />,
      priority: 9,
    });
  }
  
  // 5. Scenario-specific insights
  const scenarioWins: Record<string, number> = {};
  results.forEach((r) => {
    const winner = r.result.best_scenario;
    scenarioWins[winner] = (scenarioWins[winner] || 0) + 1;
  });
  
  // Buy scenario wins
  const buyWins = scenarioWins['Comprar'] || 0;
  if (buyWins > 0 && buyWins === results.length) {
    insights.push({
      id: 'buy-always-wins',
      type: 'info',
      category: 'scenario',
      title: 'Comprar é Sempre Melhor',
      description: 'Em todas as configurações analisadas, comprar o imóvel foi a melhor opção. Isso pode indicar condições favoráveis de financiamento ou valorização do imóvel alta.',
      icon: <IconBuildingBank size={16} />,
      priority: 6,
    });
  }
  
  // Invest scenario wins
  const rentWins = scenarioWins['Alugar e Investir'] || 0;
  if (rentWins > 0 && rentWins === results.length) {
    insights.push({
      id: 'rent-always-wins',
      type: 'info',
      category: 'scenario',
      title: 'Alugar e Investir é Sempre Melhor',
      description: 'Em todas as configurações, alugar e investir o capital foi a melhor opção. Isso pode indicar taxas de juros altas ou retornos de investimento superiores.',
      icon: <IconChartLine size={16} />,
      priority: 6,
    });
  }
  
  // Invest then buy scenario wins
  const investBuyWins = scenarioWins['Investir e Comprar'] || 0;
  if (investBuyWins > 0 && investBuyWins === results.length) {
    insights.push({
      id: 'invest-buy-always-wins',
      type: 'info',
      category: 'scenario',
      title: 'Investir para Comprar é Sempre Melhor',
      description: 'Em todas as configurações, investir até juntar para comprar à vista foi a melhor estratégia.',
      icon: <IconPigMoney size={16} />,
      priority: 6,
    });
  }
  
  // 6. Compare presets with best of each
  if (results.length >= 2) {
    const presetBestScenarios = results.map((r) => ({
      preset: r.preset_name,
      best: r.result.best_scenario,
      wealth: r.result.scenarios.find((s) => s.name === r.result.best_scenario)?.final_wealth ?? 0,
    }));
    
    const sorted = presetBestScenarios.sort((a, b) => b.wealth - a.wealth);
    const bestPreset = sorted[0];
    const secondBest = sorted[1];
    
    if (bestPreset.wealth > secondBest.wealth) {
      const diff = bestPreset.wealth - secondBest.wealth;
      const diffPercent = (diff / secondBest.wealth) * 100;
      
      if (diffPercent > 5) {
        insights.push({
          id: 'preset-comparison',
          type: 'opportunity',
          category: 'opportunity',
          title: 'Diferença entre Presets',
          description: `O preset "${bestPreset.preset}" gera ${money(diff)} a mais que "${secondBest.preset}" (${percent(diffPercent)} de diferença). Os parâmetros deste preset são mais favoráveis.`,
          value: moneyCompact(diff),
          icon: <IconArrowRight size={16} />,
          priority: 7,
        });
      }
    }
  }
  
  // 7. Break-even analysis
  const breakEvenMonths = results.flatMap((r) =>
    r.result.scenarios
      .filter((s) => s.metrics.break_even_month != null)
      .map((s) => ({
        preset: r.preset_name,
        scenario: s.name,
        month: s.metrics.break_even_month!,
      }))
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
  
  if (insights.length === 0) {
    return (
      <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
        Não foi possível gerar insights para esta comparação. Tente adicionar mais presets ou variar os parâmetros.
      </Alert>
    );
  }
  
  // Separate insights by importance
  const primaryInsights = insights.filter((i) => i.priority >= 7);
  const secondaryInsights = insights.filter((i) => i.priority < 7);
  
  return (
    <Paper
      p="lg"
      radius="lg"
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        backgroundColor: 'var(--mantine-color-body)',
      }}
    >
      <Group gap="sm" mb="lg">
        <ThemeIcon
          size="lg"
          radius="md"
          variant="gradient"
          gradient={{ from: 'grape.5', to: 'grape.7', deg: 135 }}
        >
          <IconBulb size={20} />
        </ThemeIcon>
        <Box>
          <Text fw={600} size="lg">
            Insights Automáticos
          </Text>
          <Text size="xs" c="dimmed">
            Análise inteligente dos resultados da comparação
          </Text>
        </Box>
      </Group>
      
      <Stack gap="md">
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
            {primaryInsights.length > 0 && (
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
    </Paper>
  );
}
