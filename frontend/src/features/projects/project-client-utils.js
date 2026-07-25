export function getClientLabel(client) {
  if (!client) return 'Client unavailable';
  const personName = [client.firstName, client.lastName].filter(Boolean).join(' ').trim();
  if (client.companyName && personName) return `${client.companyName} — ${personName}`;
  return client.companyName || personName || 'Client unavailable';
}

export function createClientLabelMap(clients) {
  return new Map(clients.map((client) => [client.id, getClientLabel(client)]));
}
