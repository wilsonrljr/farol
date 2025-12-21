import { ReactNode } from 'react';
import { Paper, Box, Text, Group, rem, Stack, ThemeIcon, Progress, UnstyledButton, Transition } from '@mantine/core';
import { IconCheck, IconChevronRight, IconChevronLeft } from '@tabler/icons-react';

interface WizardStep {
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface FormWizardProps {
  steps: WizardStep[];
  active: number;
  children: ReactNode;
  onStepClick?: (step: number) => void;
}

function StepIndicator({ 
  step, 
  index, 
  active, 
  completed, 
  onClick,
  isLast 
}: { 
  step: WizardStep; 
  index: number; 
  active: boolean; 
  completed: boolean;
  onClick?: () => void;
  isLast: boolean;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: rem(12),
        flex: isLast ? 'none' : 1,
        cursor: onClick ? 'pointer' : 'default',
        opacity: active ? 1 : completed ? 0.9 : 0.5,
        transition: 'all 200ms ease',
      }}
    >
      {/* Step Circle */}
      <Box
        style={{
          width: rem(40),
          height: rem(40),
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: completed 
            ? 'var(--mantine-color-sage-6)' 
            : active 
              ? 'var(--mantine-color-sage-7)' 
              : 'var(--mantine-color-cream-2)',
          border: `2px solid ${completed || active ? 'var(--mantine-color-sage-6)' : 'var(--mantine-color-sage-3)'}`,
          color: completed || active ? 'white' : 'var(--mantine-color-sage-6)',
          transition: 'all 250ms ease',
          flexShrink: 0,
          boxShadow: active ? '0 0 0 4px var(--mantine-color-sage-1)' : 'none',
        }}
      >
        {completed ? (
          <IconCheck size={18} strokeWidth={3} />
        ) : step.icon ? (
          step.icon
        ) : (
          <Text fw={600} size="sm">{index + 1}</Text>
        )}
      </Box>
      
      {/* Step Label (visible on larger screens) */}
      <Box visibleFrom="sm" style={{ minWidth: 0 }}>
        <Text 
          fw={active ? 600 : 500} 
          size="sm" 
          c={active ? 'sage.8' : completed ? 'sage.7' : 'neutral.5'}
          style={{ whiteSpace: 'nowrap' }}
        >
          {step.label}
        </Text>
        {step.description && (
          <Text size="xs" c="neutral.5" style={{ whiteSpace: 'nowrap' }}>
            {step.description}
          </Text>
        )}
      </Box>
      
      {/* Connector Line */}
      {!isLast && (
        <Box
          style={{
            flex: 1,
            height: rem(2),
            backgroundColor: completed ? 'var(--mantine-color-sage-4)' : 'var(--mantine-color-cream-3)',
            borderRadius: rem(1),
            marginLeft: rem(8),
            marginRight: rem(8),
            transition: 'background-color 300ms ease',
          }}
          visibleFrom="sm"
        />
      )}
    </UnstyledButton>
  );
}

export function FormWizard({ steps, active, children, onStepClick }: FormWizardProps) {
  const progress = ((active) / (steps.length - 1)) * 100;

  return (
    <Box>
      {/* Progress Bar (Mobile) */}
      <Box hiddenFrom="sm" mb="lg">
        <Group justify="space-between" mb="xs">
          <Text size="sm" fw={500} c="sage.7">
            Passo {active + 1} de {steps.length}
          </Text>
          <Text size="sm" c="neutral.5">
            {steps[active].label}
          </Text>
        </Group>
        <Progress 
          value={progress} 
          size="md" 
          radius="xl"
          color="sage"
          styles={{
            root: {
              backgroundColor: 'var(--mantine-color-cream-2)',
            },
          }}
        />
      </Box>

      {/* Step Indicators (Desktop) */}
      <Box 
        visibleFrom="sm"
        mb="xl"
        p="lg"
        style={{
          backgroundColor: 'var(--mantine-color-cream-1)',
          borderRadius: rem(16),
          border: '1px solid var(--mantine-color-sage-2)',
        }}
      >
        <Group gap="xs" wrap="nowrap">
          {steps.map((step, index) => (
            <StepIndicator
              key={index}
              step={step}
              index={index}
              active={index === active}
              completed={index < active}
              onClick={onStepClick ? () => onStepClick(index) : undefined}
              isLast={index === steps.length - 1}
            />
          ))}
        </Group>
      </Box>

      {/* Content */}
      <Box>
        {children}
      </Box>

      {/* Navigation Buttons */}
      <Group justify="space-between" mt="xl">
        <UnstyledButton
          onClick={() => onStepClick?.(Math.max(0, active - 1))}
          disabled={active === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: rem(8),
            padding: `${rem(10)} ${rem(16)}`,
            borderRadius: rem(8),
            backgroundColor: active === 0 ? 'var(--mantine-color-cream-2)' : 'var(--mantine-color-sage-0)',
            color: active === 0 ? 'var(--mantine-color-neutral-4)' : 'var(--mantine-color-sage-7)',
            fontWeight: 500,
            fontSize: rem(14),
            cursor: active === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 150ms ease',
            border: '1px solid var(--mantine-color-sage-2)',
          }}
        >
          <IconChevronLeft size={18} />
          Anterior
        </UnstyledButton>

        {active < steps.length - 1 && (
          <UnstyledButton
            onClick={() => onStepClick?.(Math.min(steps.length - 1, active + 1))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: rem(8),
              padding: `${rem(10)} ${rem(16)}`,
              borderRadius: rem(8),
              backgroundColor: 'var(--mantine-color-sage-6)',
              color: 'white',
              fontWeight: 500,
              fontSize: rem(14),
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            Próximo
            <IconChevronRight size={18} />
          </UnstyledButton>
        )}
      </Group>
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
    <Paper
      p="xl"
      radius="xl"
      style={{
        border: '1px solid var(--mantine-color-sage-2)',
        backgroundColor: 'var(--mantine-color-body)',
        marginBottom: rem(24),
      }}
    >
      <Group gap="md" mb="lg" align="flex-start">
        {icon && (
          <ThemeIcon size={44} radius="lg" variant="light" color="sage">
            {icon}
          </ThemeIcon>
        )}
        <Box>
          <Text fw={600} size="lg" c="sage.8">
            {title}
          </Text>
          {description && (
            <Text size="sm" c="neutral.6" mt={4}>
              {description}
            </Text>
          )}
        </Box>
      </Group>
      {children}
    </Paper>
  );
}

interface FormRowProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

export function FormRow({ children, columns = 2 }: FormRowProps) {
  return (
    <Box
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: rem(16),
      }}
    >
      {children}
    </Box>
  );
}
