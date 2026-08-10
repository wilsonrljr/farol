import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  Stack,
  Text,
  TypographyStylesProvider,
} from '@mantine/core';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const loaders: Record<string, () => Promise<string>> = {
  quickstart: () => import('@docs/quickstart.md?raw').then((module) => module.default as string),
  calculos: () => import('@docs/calculations.md?raw').then((module) => module.default as string),
  glossario: () => import('@docs/glossary.md?raw').then((module) => module.default as string),
};

interface Props {
  doc: 'quickstart' | 'calculos' | 'glossario';
}

export function DocsMarkdownPage({ doc }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setHasError(false);

    loaders[doc]()
      .then((loadedContent) => {
        if (!cancelled) setContent(loadedContent);
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, doc]);

  if (hasError) {
    return (
      <Paper className="docs-content">
        <Alert
          color="red"
          variant="light"
          icon={<IconAlertCircle size={20} />}
          title="Não foi possível carregar esta página"
        >
          <Stack gap="md" align="flex-start">
            <Text size="sm">
              Verifique sua conexão e tente novamente. As outras áreas do Farol continuam
              disponíveis.
            </Text>
            <Button
              variant="default"
              size="sm"
              leftSection={<IconRefresh size={17} />}
              onClick={() => setAttempt((current) => current + 1)}
            >
              Tentar novamente
            </Button>
          </Stack>
        </Alert>
      </Paper>
    );
  }

  if (!content) {
    return (
      <Paper className="docs-content">
        <Center mih={260} role="status" aria-live="polite">
          <Stack align="center" gap="sm">
            <Loader size="sm" color="ocean" aria-hidden="true" />
            <Text size="sm" c="dimmed">
              Carregando documentação…
            </Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  return (
    <Paper className="docs-content">
      <TypographyStylesProvider className="docs-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // The documentation shell already provides the page h1. Markdown
            // document titles therefore start at h2 to preserve one coherent
            // heading hierarchy for assistive technology.
            h1: ({ node, ...props }) => {
              void node;
              return <h2 {...props} />;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </TypographyStylesProvider>
    </Paper>
  );
}

export default DocsMarkdownPage;
