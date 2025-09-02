import { Container, Title } from '@mantine/core';
import ComparisonForm from '../components/ComparisonForm';

export default function ScenarioComparison() {
  return (
    <Container size="xl">
      <Title order={2} mb="md">Comparação de Cenários</Title>
      <ComparisonForm />
    </Container>
  );
}
