import { createFormContext } from '@mantine/form';
import type { ComparisonFormValues } from './comparisonFormModel';

export const [
  ComparisonFormProvider,
  useComparisonFormContext,
  useComparisonForm,
] = createFormContext<ComparisonFormValues>();
