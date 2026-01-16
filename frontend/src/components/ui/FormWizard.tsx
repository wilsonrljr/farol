import type { ReactNode } from '../../types/react';
import { Box, Text, Group, rem, Stack, ThemeIcon, Progress, UnstyledButton, Transition } from '@mantine/core';
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
            ? 'var(--mantine-color-ocean-6)' 
            : active 
              ? 'var(--mantine-color-ocean-7)' 
              : 'light-dark(var(--mantine-color-slate-2), var(--mantine-color-dark-7))',
          border: `2px solid ${completed || active ? 'var(--mantine-color-ocean-6)' : 'var(--mantine-color-default-border)'}`,
          color: completed || active ? 'white' : 'var(--mantine-color-ocean-6)',
          transition: 'all 250ms ease',
          flexShrink: 0,
          boxShadow: active
            ? '0 0 0 4px light-dark(var(--mantine-color-ocean-1), var(--mantine-color-dark-6))'
            : 'none',
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
          c={active ? 'bright' : completed ? 'ocean.7' : 'dimmed'}
          style={{ whiteSpace: 'nowrap' }}
        >
          {step.label}
        </Text>
        {step.description && (
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
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
            backgroundColor: completed
              ? 'var(--mantine-color-ocean-4)'
              : 'light-dark(var(--mantine-color-slate-3), var(--mantine-color-dark-5))',
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
          <Text size="sm" fw={500} c="ocean.7">
            Passo {active + 1} de {steps.length}
          </Text>
          <Text size="sm" c="dimmed">
            {steps[active].label}
          </Text>
        </Group>
        <Progress 
          value={progress} 
          size="md" 
          radius="xl"
          color="ocean"
          styles={{
            root: {
              backgroundColor: 'light-dark(var(--mantine-color-slate-2), var(--mantine-color-dark-6))',
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
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
          borderRadius: rem(16),
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
            borderRadius: rem(12),
            backgroundColor:
              active === 0
                ? 'light-dark(rgba(0, 0, 0, 0.04), rgba(255, 255, 255, 0.04))'
                : 'light-dark(rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.12))',
            color: active === 0 ? 'var(--mantine-color-dimmed)' : 'var(--mantine-color-ocean-6)',
            fontWeight: 500,
            fontSize: rem(14),
            cursor: active === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 200ms ease',
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
              padding: `${rem(10)} ${rem(20)}`,
              borderRadius: rem(12),
              background: 'linear-gradient(135deg, var(--mantine-color-ocean-5) 0%, var(--mantine-color-ocean-6) 100%)',
              color: 'white',
              fontWeight: 500,
              fontSize: rem(14),
              cursor: 'pointer',
              transition: 'all 200ms ease',
              boxShadow: '0 4px 12px -2px var(--mantine-color-ocean-5)',
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
    <Box
      p="xl"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: 'var(--glass-shadow), var(--glass-shadow-glow)',
        borderRadius: rem(20),
        marginBottom: rem(24),
      }}
    >
      <Group gap="md" mb="lg" align="flex-start">
        {icon && (
          <ThemeIcon 
            size={48} 
            radius="xl" 
            variant="light" 
            color="ocean"
            style={{
              background: 'light-dark(linear-gradient(135deg, var(--mantine-color-ocean-1) 0%, var(--mantine-color-ocean-0) 100%), linear-gradient(135deg, var(--mantine-color-ocean-8) 0%, var(--mantine-color-ocean-9) 100%))',
            }}
          >
            {icon}
          </ThemeIcon>
        )}
        <Box>
          <Text fw={600} size="lg" c="bright">
            {title}
          </Text>
          {description && (
            <Text size="sm" c="dimmed" mt={4}>
              {description}
            </Text>
          )}
        </Box>
      </Group>
      {children}
    </Box>
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
