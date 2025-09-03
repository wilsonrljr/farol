// Utilitário genérico para baixar arquivos via fetch.
export async function downloadFile(path: string, method: 'GET' | 'POST' = 'GET', body?: any, filename?: string) {
  try {
    const base = import.meta.env.VITE_API_BASE || '';
    const res = await fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Download falhou', res.status, text);
      alert('Falha ao gerar arquivo: ' + res.status);
      return;
    }
    const disposition = res.headers.get('Content-Disposition');
    const suggested = disposition && /filename="?([^";]+)"?/i.exec(disposition)?.[1];
    const blob = await res.blob();
    // Forçar MIME para xlsx se extensão indicar
    const finalName = filename || suggested || 'download';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{
      a.remove();
      URL.revokeObjectURL(url);
    }, 0);
  } catch (e) {
    console.error('Erro no download', e);
    alert('Erro inesperado ao baixar');
  }
}
