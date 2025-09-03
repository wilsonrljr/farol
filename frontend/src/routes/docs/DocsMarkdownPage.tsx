import { useEffect, useState } from 'react';
import { Loader, Paper, ScrollArea, Text } from '@mantine/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Mapeia identificadores para imports raw dos markdowns
const loaders: Record<string, () => Promise<string>> = {
  quickstart: () => import('@docs/quickstart.md?raw').then(m => m.default as string),
  calculos: () => import('@docs/calculations.md?raw').then(m => m.default as string),
  glossario: () => import('@docs/glossary.md?raw').then(m => m.default as string),
};

interface Props {
  doc: 'quickstart' | 'calculos' | 'glossario';
}

export function DocsMarkdownPage({ doc }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(null);
    setError(null);
    loaders[doc]()
      .then(setContent)
      .catch(e => setError(String(e)));
  }, [doc]);

  if (error) {
    return <Text c="red" size="sm">Erro ao carregar documentação: {error}</Text>;
  }
  if (!content) {
    return <Loader />;
  }
  return (
    <ScrollArea h="75vh">
      <Paper p="md" withBorder>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </Paper>
    </ScrollArea>
  );
}

export default DocsMarkdownPage;
