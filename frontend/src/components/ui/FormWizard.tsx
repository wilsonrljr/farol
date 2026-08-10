import type { ReactNode } from '../../types/react';
import {
  Box,
  Button,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { IconCheck, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

interface WizardStep {
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface FormWizardProps {
  steps: WizardStep[];
  active: number;
  furthest?: number;
  completed?: readonly boolean[];
  children: ReactNode;
  onStepClick?: (step: number) => void;
}

interface StepIndicatorProps {
  step: WizardStep;
  index: number;
  active: boolean;
  completed: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

function StepContent({ step, index, active, completed }: Omit<StepIndicatorProps, 'onClick'>) {
  return (
    <Group gap="sm" wrap="nowrap" align="center">
      <ThemeIcon
        size={36}
        radius="xl"
        variant={active || completed ? 'filled' : 'light'}
        color={active || completed ? 'ocean' : 'gray'}
        aria-hidden="true"
      >
        {completed ? <IconCheck size={17} strokeWidth={2.6} /> : step.icon ?? index + 1}
      </ThemeIcon>
      <Box style={{ minWidth: 0 }}>
        <Text size="sm" fw={active ? 700 : 600} c={active ? 'bright' : 'dimmed'}>
          {step.label}
        </Text>
        {step.description && (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {step.description}
          </Text>
        )}
      </Box>
    </Group>
  );
}

function StepIndicator(props: StepIndicatorProps) {
  const { onClick, ...contentProps } = props;
  const commonStyle = {
    width: '100%',
    minHeight: 56,
    padding: 'var(--mantine-spacing-xs)',
    borderRadius: 'var(--mantine-radius-lg)',
    background: props.active
      ? 'light-dark(var(--mantine-color-ocean-0), var(--mantine-color-dark-6))'
      : 'transparent',
    border: props.active
      ? '1px solid light-dark(var(--mantine-color-ocean-2), var(--mantine-color-ocean-8))'
      : '1px solid transparent',
    textAlign: 'left' as const,
  };

  if (!onClick || props.disabled) {
    return (
      <Box
        style={{ ...commonStyle, opacity: props.disabled ? 0.55 : 1 }}
        aria-current={props.active ? 'step' : undefined}
        aria-disabled={props.disabled || undefined}
      >
        <StepContent {...contentProps} />
      </Box>
    );
  }

  return (
    <UnstyledButton
      onClick={onClick}
      style={commonStyle}
      aria-current={props.active ? 'step' : undefined}
      aria-label={`Ir para a etapa ${props.index + 1}: ${props.step.label}`}
    >
      <StepContent {...contentProps} />
    </UnstyledButton>
  );
}

export function FormWizard({
  steps,
  active,
  furthest = active,
  completed,
  children,
  onStepClick,
}: FormWizardProps) {
  const currentStep = Math.min(Math.max(active, 0), Math.max(steps.length - 1, 0));
  const visitedStep = Math.min(Math.max(furthest, currentStep), Math.max(steps.length - 1, 0));
  const progress = steps.length > 0
    ? completed
      ? (completed.filter(Boolean).length / steps.length) * 100
      : ((visitedStep + 1) / steps.length) * 100
    : 0;
  const progressLabel = completed
    ? `${Math.round(progress)}% dos dados validados`
    : `${Math.round(progress)}% do formulário percorrido`;

  return (
    <Box>
      <Paper withBorder radius="xl" p={{ base: 'sm', sm: 'md' }} mb="xl">
        <Box hiddenFrom="sm">
          <Group justify="space-between" gap="xs" mb="xs" wrap="nowrap">
            <Text size="sm" fw={650} c="ocean.7">
              Etapa {currentStep + 1} de {steps.length}
            </Text>
            <Text size="sm" c="dimmed" truncate="end">
              {steps[currentStep]?.label}
            </Text>
          </Group>
          <Progress
            value={progress}
            size="sm"
            radius="xl"
            color="ocean"
            aria-label={progressLabel}
          />
        </Box>

        <Box visibleFrom="sm">
          <Progress
            value={progress}
            size={4}
            radius="xl"
            color="ocean"
            mb="sm"
            aria-label={progressLabel}
          />
          <SimpleGrid cols={steps.length} spacing="xs">
            {steps.map((step, index) => (
              <StepIndicator
                key={step.label}
                step={step}
                index={index}
                active={index === currentStep}
                completed={
                  index !== currentStep &&
                  (completed?.[index] ?? index <= visitedStep)
                }
                disabled={index > visitedStep + 1}
                onClick={onStepClick ? () => onStepClick(index) : undefined}
              />
            ))}
          </SimpleGrid>
        </Box>
      </Paper>

      {children}

      {onStepClick && (
        <Group justify="space-between" mt="lg" gap="sm" wrap="wrap">
          <Button
            type="button"
            variant="default"
            leftSection={<IconChevronLeft size={18} />}
            onClick={() => onStepClick(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            mih={44}
          >
            Anterior
          </Button>

          {currentStep < steps.length - 1 && (
            <Button
              type="button"
              color="ocean"
              rightSection={<IconChevronRight size={18} />}
              onClick={() => onStepClick(Math.min(steps.length - 1, currentStep + 1))}
              mih={44}
            >
              Próxima etapa
            </Button>
          )}
        </Group>
      )}
    </Box>
  );
}

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  icon?: ReactNode;
}

export function FormSection({ title, description, children, icon }: FormSectionProps) {
  return (
    <Paper withBorder radius="xl" p={{ base: 'md', sm: 'xl' }}>
      <Group gap="md" mb="lg" align="flex-start" wrap="nowrap">
        {icon && (
          <ThemeIcon size={40} radius="xl" variant="light" color="ocean" aria-hidden="true">
            {icon}
          </ThemeIcon>
        )}
        <Box style={{ minWidth: 0 }}>
          <Text component="h3" fw={700} size="lg" m={0}>
            {title}
          </Text>
          {description && (
            <Text size="sm" c="dimmed" mt={4} maw={720} lh={1.5}>
              {description}
            </Text>
          )}
        </Box>
      </Group>
      <Stack gap="lg">{children}</Stack>
    </Paper>
  );
}

interface FormRowProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

export function FormRow({ children, columns = 2 }: FormRowProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: columns }} spacing="md">
      {children}
    </SimpleGrid>
  );
}
