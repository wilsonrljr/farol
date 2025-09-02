import { Button, Container, Group, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <Container size="lg" py="xl">
      <Title order={1} ta="center" fw={800} mb="md">
        Decida o melhor caminho para adquirir seu imóvel
      </Title>
      <Text c="dimmed" ta="center" size="lg" maw={760} mx="auto" mb="lg">
        Farol: compare comprar financiado, alugar e investir ou investir para comprar à vista. Simule juros, amortizações, inflação, valorização do imóvel e mais em uma interface moderna e intuitiva.
      </Text>
      <Group justify="center" gap="md">
        <Button size="md" component={Link} to="/simulacao">Simular Financiamento</Button>
        <Button size="md" variant="light" component={Link} to="/comparacao">Comparar Cenários</Button>
      </Group>
    </Container>
  );
}
