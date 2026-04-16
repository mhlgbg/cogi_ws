function normalizeHost(host?: string | null): string {
  if (!host) return '';

  const trimmedHost = String(host).trim().toLowerCase();
  if (!trimmedHost) return '';

  const withoutProtocol = trimmedHost.replace(/^https?:\/\//, '');
  const firstHost = withoutProtocol.split('/')[0]?.split(',')[0]?.trim() || '';
  if (!firstHost) return '';

  if (firstHost.startsWith('[')) {
    const endBracketIndex = firstHost.indexOf(']');
    return endBracketIndex > 0 ? firstHost.slice(1, endBracketIndex) : firstHost;
  }

  const colonIndex = firstHost.indexOf(':');
  return colonIndex > -1 ? firstHost.slice(0, colonIndex) : firstHost;
}

export function getMainDomain(): string {
  return normalizeHost(process.env.MAIN_DOMAIN || '');
}

export function isMainDomainHost(host?: string | null): boolean {
  const configuredMainDomain = getMainDomain();
  if (!configuredMainDomain) return false;

  return normalizeHost(host) === configuredMainDomain;
}