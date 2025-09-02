import { Container, Title } from '@mantine/core';
import LoanSimulationForm from '../components/LoanSimulationForm';

export default function LoanSimulation() {
  return (
    <Container size="xl">
      <Title order={2} mb="md">Simulação de Financiamento</Title>
      <LoanSimulationForm />
    </Container>
  );
}
