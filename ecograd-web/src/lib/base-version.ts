export async function versaoPublicada(): Promise<string> {
  const response = await fetch('/data/manifest.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Não foi possível verificar a versão da base.');
  const manifest = await response.json();
  if (typeof manifest.version !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.version)) throw new Error('Manifesto da base inválido.');
  return manifest.version;
}
