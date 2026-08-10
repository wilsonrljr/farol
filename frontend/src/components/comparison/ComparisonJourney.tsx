import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type {
  BatchComparisonItem,
  BatchComparisonResult,
  ComparisonInput,
  EnhancedComparisonResult,
} from '../../api/types';
import { api, isRequestCancelled, toApiError } from '../../api/client';
import { useApi } from '../../hooks/useApi';
import { usePresets } from '../../hooks/usePresets';
import {
  MAX_BATCH_COMPARISON_ITEMS,
  MIN_BATCH_COMPARISON_ITEMS,
} from '../../constants/limits';
import { clonePresetValue, type Preset } from '../../utils/presets';
import { FormWizard } from '../ui/FormWizard';
import { PresetManager } from '../PresetManager';
import { ComparisonFormProvider, useComparisonForm } from './ComparisonFormContext';
import { isComparisonPresetInput } from './comparisonInput';
import {
  COMPARISON_EXAMPLE,
  comparisonApiPathToForm,
  comparisonDerivedValues,
  comparisonFormToInput,
  comparisonInputToForm,
  comparisonReadiness,
  createEmptyComparisonForm,
  validateComparisonForm,
  type ComparisonFormValues,
} from './comparisonFormModel';
import {
  AssumptionsStep,
  MonthlyPlanStep,
  PropertyStep,
  PurchaseStep,
} from './ComparisonSteps';
import { ReviewStep } from './ComparisonReview';

const EnhancedComparisonResults = lazy(() => import('../EnhancedComparisonResults'));
const BatchComparisonResults = lazy(() => import('../BatchComparisonResults'));

type ResultMode = 'none' | 'single' | 'batch';

const COMPARISON_PRESETS_STORAGE_KEY = 'farol-comparison-presets-v4';
const LEGACY_COMPARISON_PRESETS_STORAGE_KEYS = [
  'farol-comparison-presets',
] as const;

interface PendingReplacement {
  values: ComparisonFormValues;
  targetStep: number;
  sourceLabel: string;
  notification?: string;
}

const STEPS = [
  { label: 'Moradia', description: 'Alternativas equivalentes' },
  { label: 'Compra', description: 'Entrada e forma de pagamento' },
  { label: 'Seu mês', description: 'Renda e destino da sobra' },
  { label: 'Premissas', description: 'Cenário econômico' },
  { label: 'Revisão', description: 'Base da comparação' },
];

function ResultsFallback() {
  return (
    <Paper withBorder p="xl" role="status" aria-live="polite">
      <Group justify="center" gap="sm">
        <Loader size="sm" />
        <Text size="sm">Preparando resultados…</Text>
      </Group>
    </Paper>
  );
}

function errorStep(path: string): number {
  if (
    path === 'property_value' ||
    path === 'comparison_horizon_years' ||
    path.startsWith('ui.rent_') ||
    path.startsWith('additional_costs')
  ) return 0;
  if (
    path === 'total_savings' ||
    path === 'loan_term_years' ||
    path === 'loan_type' ||
    path.startsWith('ui.down_payment_') ||
    path.startsWith('ui.interest_') ||
    path.startsWith('fgts')
  ) return 1;
  if (path.startsWith('monthly_plan')) return 2;
  return 3;
}

function firstStepError(
  errors: Record<string, string>,
  step: number
): [string, string] | undefined {
  return Object.entries(errors).find(([path]) => errorStep(path) === step);
}

export default function ComparisonJourney() {
  const initialValuesRef = useRef<ComparisonFormValues>(createEmptyComparisonForm());
  const latestValuesRef = useRef<ComparisonFormValues>(initialValuesRef.current);
  const form = useComparisonForm({
    mode: 'controlled',
    initialValues: initialValuesRef.current,
    validate: validateComparisonForm,
    validateInputOnBlur: true,
    // React can batch the controlled rerender with a following click. Mantine calls
    // this synchronously from its setter, so navigation always validates what the
    // user just typed instead of the previous render.
    onValuesChange: (values) => {
      latestValuesRef.current = values;
    },
  });
  const [activeStep, setActiveStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [explorationAccepted, setExplorationAccepted] = useState(false);
  const [explorationModal, setExplorationModal] = useState(false);
  const [explorationTarget, setExplorationTarget] = useState(3);
  const [resultMode, setResultMode] = useState<ResultMode>('none');
  const [lastInput, setLastInput] = useState<ComparisonInput | null>(null);
  const [batchResult, setBatchResult] = useState<BatchComparisonResult | null>(null);
  const [batchInputs, setBatchInputs] = useState<ComparisonInput[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [pendingReplacement, setPendingReplacement] =
    useState<PendingReplacement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const pendingFocusPathRef = useRef<string | null>(null);
  const submittedFingerprintRef = useRef<string | null>(null);
  const batchAbortRef = useRef<AbortController | null>(null);
  const batchRequestRef = useRef(0);
  const notifiedStorageErrorRef = useRef<string | null>(null);

  const presets = usePresets<ComparisonInput>({
    storageKey: COMPARISON_PRESETS_STORAGE_KEY,
    legacyStorageKeys: LEGACY_COMPARISON_PRESETS_STORAGE_KEYS,
    validateInput: isComparisonPresetInput,
  });

  const { data, loading, call, reset } = useApi<
    [ComparisonInput],
    EnhancedComparisonResult
  >(async (input, { signal }) => {
    const response = await api.post<EnhancedComparisonResult>(
      '/api/compare-scenarios-enhanced',
      input,
      { signal }
    );
    return response.data;
  });

  const derived = comparisonDerivedValues(form.values);
  const fgtsPolicy = form.values.fgts.financed_amortization;
  const fgtsModuleEnabled = form.values.ui.modules.fgts;
  const setFormFieldValue = form.setFieldValue;
  useEffect(() => {
    if (
      !fgtsModuleEnabled ||
      !fgtsPolicy?.enabled ||
      derived.fgtsAtPurchase <= 0 ||
      derived.financedAmount <= 0 ||
      fgtsPolicy.first_month >= 25
    ) {
      return;
    }

    // Eligibility changes when any purchase input changes (price, cash down
    // payment, FGTS balance/limit or purchase-use policy). Keep the editable
    // state aligned with the backend rule instead of fixing only the payload.
    // This update is monotonic: removing the purchase withdrawal never lowers
    // a month the user already chose.
    setFormFieldValue('fgts.financed_amortization', {
      ...fgtsPolicy,
      first_month: 25,
    });
  }, [
    derived.fgtsAtPurchase,
    derived.financedAmount,
    fgtsModuleEnabled,
    fgtsPolicy,
    setFormFieldValue,
  ]);
  const missingInitialResources = derived.input.total_savings == null;
  const validationErrors = validateComparisonForm(form.values);
  const stepIsValid = (step: number) =>
    !Object.keys(validationErrors).some((path) => errorStep(path) === step);
  const completedSteps = (() => {
    const completed = Array.from({ length: STEPS.length }, () => false);
    let previousComplete = true;
    for (let step = 0; step < STEPS.length - 1; step += 1) {
      const resourceGate =
        step !== 1 || !missingInitialResources || explorationAccepted;
      completed[step] =
        previousComplete && step <= furthestStep && stepIsValid(step) && resourceGate;
      previousComplete = completed[step];
    }
    completed[STEPS.length - 1] =
      activeStep === STEPS.length - 1 && previousComplete;
    return completed;
  })();

  const clearResults = useCallback(() => {
    submittedFingerprintRef.current = null;
    reset();
    batchRequestRef.current += 1;
    batchAbortRef.current?.abort();
    batchAbortRef.current = null;
    setBatchLoading(false);
    setResultMode('none');
    setLastInput(null);
    setBatchResult(null);
    setBatchInputs([]);
  }, [reset]);

  const moveTo = (next: number) => {
    const bounded = Math.min(Math.max(next, 0), STEPS.length - 1);
    setActiveStep(bounded);
    setFurthestStep((current) => Math.max(current, bounded));
    requestAnimationFrame(() => {
      headingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      headingRef.current?.focus({ preventScroll: true });
    });
  };

  const focusError = (path: string) => {
    pendingFocusPathRef.current = path;
    moveTo(errorStep(path));
  };

  const moveForwardTo = (target: number) => {
    const bounded = Math.min(Math.max(target, activeStep + 1), STEPS.length - 1);
    const currentValues = latestValuesRef.current;
    const currentErrors = validateComparisonForm(currentValues);
    const currentMissingInitialResources =
      comparisonFormToInput(currentValues).total_savings == null;
    for (let step = activeStep; step < bounded; step += 1) {
      const firstError = firstStepError(currentErrors, step);
      if (firstError) {
        form.setErrors(currentErrors);
        focusError(firstError[0]);
        notifications.show({
          title: 'Revise esta etapa',
          message: firstError[1],
          color: 'red',
        });
        return;
      }
      if (
        step === 1 &&
        currentMissingInitialResources &&
        !explorationAccepted
      ) {
        setExplorationTarget(bounded);
        setExplorationModal(true);
        return;
      }
    }
    moveTo(bounded);
  };

  const continueFromStep = () => moveForwardTo(activeStep + 1);

  const navigateStep = (next: number) => {
    if (next <= activeStep) moveTo(next);
    else if (next <= furthestStep + 1) moveForwardTo(next);
  };

  const replaceForm = (
    values: ComparisonFormValues,
    targetStep: number,
    notification?: string
  ) => {
    clearResults();
    latestValuesRef.current = values;
    form.setValues(values);
    form.resetDirty(values);
    form.clearErrors();
    setExplorationAccepted(false);
    setFurthestStep(targetStep);
    moveTo(targetStep);
    if (notification) {
      notifications.show({
        title: 'Cenário carregado',
        message: notification,
        color: 'ocean',
      });
    }
  };

  const requestReplacement = (replacement: PendingReplacement) => {
    if (form.isDirty()) {
      setPendingReplacement(replacement);
      return;
    }
    replaceForm(
      replacement.values,
      replacement.targetStep,
      replacement.notification
    );
  };

  const fillExample = () =>
    requestReplacement({
      values: comparisonInputToForm(COMPARISON_EXAMPLE),
      targetStep: 0,
      sourceLabel: 'o exemplo',
    });

  const loadPreset = (preset: Preset<ComparisonInput>) => {
    requestReplacement({
      values: comparisonInputToForm(preset.input),
      targetStep: 4,
      sourceLabel: `o cenário salvo “${preset.name}”`,
      notification: `Revise “${preset.name}” antes de comparar.`,
    });
  };

  const canOpenPresetSave = () => {
    const errors = validateComparisonForm(latestValuesRef.current);
    if (!Object.keys(errors).length) return true;
    form.setErrors(errors);
    const [path, message] = Object.entries(errors)[0];
    focusError(path);
    notifications.show({ title: 'Revise antes de salvar', message, color: 'red' });
    return false;
  };

  const savePreset = (
    name: string,
    description?: string,
    tags?: Parameters<typeof presets.addPreset>[3]
  ) => {
    const currentValues = latestValuesRef.current;
    const input = comparisonFormToInput(currentValues);
    const errors = validateComparisonForm(currentValues);
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      const [path, message] = Object.entries(errors)[0];
      focusError(path);
      notifications.show({ title: 'Revise antes de salvar', message, color: 'red' });
      return false;
    }
    return Boolean(presets.addPreset(name, input, description, tags));
  };

  const comparePresets = async (selected: Preset<ComparisonInput>[]) => {
    if (
      selected.length < MIN_BATCH_COMPARISON_ITEMS ||
      selected.length > MAX_BATCH_COMPARISON_ITEMS
    ) {
      notifications.show({
        title: 'Quantidade de cenários inválida',
        message: `Selecione de ${MIN_BATCH_COMPARISON_ITEMS} a ${MAX_BATCH_COMPARISON_ITEMS} cenários salvos.`,
        color: 'yellow',
      });
      return;
    }
    const invalid = selected.find((preset) => !isComparisonPresetInput(preset.input));
    if (invalid) {
      notifications.show({
        title: 'Cenário salvo inválido',
        message: `Revise “${invalid.name}” antes da comparação em lote.`,
        color: 'red',
      });
      return;
    }

    clearResults();
    const controller = new AbortController();
    batchAbortRef.current = controller;
    const requestId = ++batchRequestRef.current;
    setBatchLoading(true);
    try {
      const inputs = selected.map((preset) =>
        comparisonFormToInput(comparisonInputToForm(preset.input))
      );
      const items: BatchComparisonItem[] = selected.map((preset, index) => ({
        preset_id: preset.id,
        preset_name: preset.name,
        input: inputs[index],
      }));
      const response = await api.post<BatchComparisonResult>(
        '/api/compare-scenarios-batch',
        { items },
        { signal: controller.signal }
      );
      if (controller.signal.aborted || requestId !== batchRequestRef.current) return;
      setBatchInputs(inputs);
      setBatchResult(response.data);
      setResultMode('batch');
    } catch (error) {
      if (controller.signal.aborted || requestId !== batchRequestRef.current) return;
      const apiError = await toApiError(error);
      if (!isRequestCancelled(apiError)) {
        notifications.show({
          title: 'Falha na comparação em lote',
          message: apiError.message,
          color: 'red',
        });
      }
    } finally {
      if (requestId === batchRequestRef.current) setBatchLoading(false);
    }
  };

  const submit = async () => {
    const currentValues = latestValuesRef.current;
    const errors = validateComparisonForm(currentValues);
    if (Object.keys(errors).length) {
      form.setErrors(errors);
      const [path, message] = Object.entries(errors)[0];
      focusError(path);
      notifications.show({ title: 'Ainda faltam dados', message, color: 'red' });
      return;
    }
    const currentMissingInitialResources =
      comparisonFormToInput(currentValues).total_savings == null;
    if (currentMissingInitialResources && !explorationAccepted) {
      setExplorationTarget(4);
      setExplorationModal(true);
      return;
    }

    const input = comparisonFormToInput(currentValues);
    const currentReadiness = comparisonReadiness(currentValues);
    const fingerprint = JSON.stringify(input);
    clearResults();
    submittedFingerprintRef.current = fingerprint;
    try {
      const outcome = await call(input);
      if (!outcome.committed) return;
      setLastInput(clonePresetValue(input));
      setResultMode('single');
      notifications.show({
        title: 'Comparação concluída',
        message:
          currentReadiness.status === 'comparable'
            ? 'As três estratégias foram comparadas sobre a mesma base.'
            : 'As trajetórias foram calculadas sem ranking autoritativo.',
        color: 'ocean',
      });
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      );
    } catch (error) {
      submittedFingerprintRef.current = null;
      const apiError = await toApiError(error);
      if (!isRequestCancelled(apiError)) {
        const serverErrors = Object.fromEntries(
          apiError.validationIssues
            .filter((issue) => issue.path)
            .map((issue) => [
              comparisonApiPathToForm(latestValuesRef.current, issue.path),
              issue.message,
            ])
        );
        const firstServerError = Object.entries(serverErrors)[0];
        if (firstServerError) {
          form.setErrors(serverErrors);
          focusError(firstServerError[0]);
        }
        notifications.show({
          title: 'Não foi possível comparar',
          message: firstServerError?.[1] ?? apiError.message,
          color: 'red',
        });
      }
    }
  };

  useEffect(() => {
    const path = pendingFocusPathRef.current;
    if (!path || errorStep(path) !== activeStep) return;
    const input = form.getInputNode(path) ??
      document.querySelector<HTMLElement>(`[name="${path}"]`);
    if (!input) return;
    input.focus({ preventScroll: true });
    pendingFocusPathRef.current = null;
  }, [activeStep, form.errors, form]);

  useEffect(() => {
    const expected = submittedFingerprintRef.current;
    if (!expected || (!loading && !data)) return;
    const current = JSON.stringify(comparisonFormToInput(form.values));
    if (current !== expected) clearResults();
  }, [form.values, loading, data, clearResults]);

  useEffect(() => {
    if (!missingInitialResources) setExplorationAccepted(false);
  }, [missingInitialResources]);

  useEffect(() => {
    const storageError = presets.storageError;
    if (!storageError) {
      notifiedStorageErrorRef.current = null;
      return;
    }
    if (notifiedStorageErrorRef.current === storageError) return;
    notifiedStorageErrorRef.current = storageError;
    notifications.show({
      title: 'Cenários salvos indisponíveis',
      message: storageError,
      color: 'red',
      autoClose: 8000,
    });
  }, [presets.storageError]);

  useEffect(
    () => () => {
      batchRequestRef.current += 1;
      batchAbortRef.current?.abort();
    },
    []
  );

  const stepTitle = [
    'Imóvel e alternativa de aluguel',
    'Entrada e forma de pagamento',
    'Seu orçamento mensal',
    'Premissas e detalhes do plano',
    'Revisão da comparação',
  ][activeStep];

  return (
    <ComparisonFormProvider form={form}>
      <Stack gap="lg">
        <Paper withBorder radius="xl" p={{ base: 'sm', sm: 'md' }}>
          <Group justify="space-between" gap="sm" wrap="wrap">
            <Box>
              <Text fw={700}>Monte sua comparação</Text>
              <Text size="sm" c="dimmed">
                Preencha o essencial e adicione somente os detalhes que existem no seu plano.
              </Text>
            </Box>
            <Group gap="xs" className="comparison-actions">
              <Button variant="default" size="sm" onClick={fillExample}>
                Preencher exemplo
              </Button>
              <PresetManager<ComparisonInput>
                presets={presets.presets}
                onBeforeSave={canOpenPresetSave}
                onSave={savePreset}
                onLoad={loadPreset}
                onDelete={presets.removePreset}
                onDuplicate={presets.duplicatePreset}
                onEdit={(id, updates) => presets.editPreset(id, updates)}
                onExportAll={presets.exportAllPresets}
                onExportSelected={presets.exportSelectedPresets}
                onImport={presets.importPresets}
                onClearAll={presets.clearAllPresets}
                onCompare={comparePresets}
                isCompareLoading={batchLoading}
                allTags={presets.allTags}
                onAddTag={presets.addTagToPreset}
                onRemoveTag={presets.removeTagFromPreset}
                isLoading={loading}
              />
            </Group>
          </Group>
        </Paper>

        {batchLoading && (
          <Paper withBorder p="md" role="status" aria-live="polite">
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm">Comparando os cenários salvos…</Text>
            </Group>
          </Paper>
        )}

        {explorationAccepted && missingInitialResources && (
          <Alert color="yellow" title="Análise exploratória ativada">
            Sem todos os recursos, a ferramenta mostra trajetórias, mas não declara uma melhor estratégia.
          </Alert>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (activeStep < STEPS.length - 1) {
              continueFromStep();
              return;
            }
            void submit();
          }}
          noValidate
        >
          <FormWizard
            steps={STEPS}
            active={activeStep}
            furthest={furthestStep}
            completed={completedSteps}
            onStepClick={navigateStep}
          >
            <h2 ref={headingRef} tabIndex={-1} className="comparison-step-heading">
              {stepTitle}
            </h2>
            {activeStep === 0 && <PropertyStep />}
            {activeStep === 1 && <PurchaseStep />}
            {activeStep === 2 && <MonthlyPlanStep />}
            {activeStep === 3 && <AssumptionsStep />}
            {activeStep === 4 && (
              <ReviewStep loading={loading} onEdit={moveTo} />
            )}
          </FormWizard>
        </form>

        <Modal
          opened={explorationModal}
          onClose={() => setExplorationModal(false)}
          title="Faltam dados para criar um ranking"
          centered
        >
          <Stack>
            <Text size="sm">
              Sem o dinheiro disponível hoje, não é possível comparar o patrimônio inicial de forma auditável.
            </Text>
            <Button onClick={() => { setExplorationModal(false); moveTo(1); }}>
              Preencher meus recursos
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setExplorationAccepted(true);
                setExplorationModal(false);
                moveTo(explorationTarget);
              }}
            >
              Continuar sem ranking
            </Button>
          </Stack>
        </Modal>

        <Modal
          opened={pendingReplacement !== null}
          onClose={() => setPendingReplacement(null)}
          title="Substituir os dados atuais?"
          centered
        >
          <Stack>
            <Text size="sm">
              Carregar {pendingReplacement?.sourceLabel} substituirá o que você alterou
              nesta comparação.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPendingReplacement(null)}>
                Manter meus dados
              </Button>
              <Button
                onClick={() => {
                  if (!pendingReplacement) return;
                  const replacement = pendingReplacement;
                  setPendingReplacement(null);
                  replaceForm(
                    replacement.values,
                    replacement.targetStep,
                    replacement.notification
                  );
                }}
              >
                Substituir
              </Button>
            </Group>
          </Stack>
        </Modal>

        {resultMode === 'single' && data && (
          <Box ref={resultsRef} id="results-section" pt="lg">
            <Suspense fallback={<ResultsFallback />}>
              <EnhancedComparisonResults
                result={data}
                inputPayload={lastInput ?? undefined}
              />
            </Suspense>
          </Box>
        )}

        {resultMode === 'batch' && batchResult && (
          <Box id="batch-results-section" pt="lg">
            <Suspense fallback={<ResultsFallback />}>
              <BatchComparisonResults
                result={batchResult}
                presetInputs={batchInputs}
                onBack={clearResults}
              />
            </Suspense>
          </Box>
        )}
      </Stack>
    </ComparisonFormProvider>
  );
}
