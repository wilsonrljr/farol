import { notifications } from '@mantine/notifications';
import { api, isRequestCancelled, toApiError } from '../api/client';

function filenameFromDisposition(disposition: string | null): string | undefined {
  if (!disposition) return undefined;

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/^"|"$/g, ''));
    } catch {
      // Fall through to the regular filename parameter.
    }
  }

  return /filename="?([^";]+)"?/i.exec(disposition)?.[1];
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = Array.from(filename, (character) =>
    character.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(character)
      ? '_'
      : character
  ).join('');
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  // WebKit may not have consumed the object URL when a zero-delay timer runs.
  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Downloads a file through the same Axios client used by regular API calls.
 * It therefore shares base URL, request tracing, cancellation and typed errors.
 */
export async function downloadFile(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  filename?: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const response = await api.request<Blob>({
      url: path,
      method,
      data: body,
      responseType: 'blob',
      signal,
    });
    const finalName =
      filename ||
      filenameFromDisposition(response.headers['content-disposition'] ?? null) ||
      'download';

    triggerBrowserDownload(response.data, finalName);
    return finalName;
  } catch (error) {
    const apiError = await toApiError(error);
    if (isRequestCancelled(apiError)) return null;

    notifications.show({
      color: 'red',
      title: 'Falha ao gerar arquivo',
      message: apiError.message,
    });
    return null;
  }
}
