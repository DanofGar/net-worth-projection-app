import https from 'https';

export function getTellerAgent() {
  const certB64 = process.env.TELLER_CERT_B64;
  const keyB64 = process.env.TELLER_KEY_B64;
  
  if (!certB64) {
    throw new Error('TELLER_CERT_B64 environment variable is not set');
  }
  if (!keyB64) {
    throw new Error('TELLER_KEY_B64 environment variable is not set');
  }
  
  const cert = Buffer.from(certB64, 'base64');
  const key = Buffer.from(keyB64, 'base64');
  
  return new https.Agent({ cert, key });
}

export async function tellerFetch(
  endpoint: string,
  accessToken: string
): Promise<any> {
  const agent = getTellerAgent();
  const auth = Buffer.from(`${accessToken}:`).toString('base64');
  
  const response = await fetch(`https://api.teller.io${endpoint}`, {
    // @ts-ignore - Node fetch supports agent
    agent,
    headers: {
      'Authorization': `Basic ${auth}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Teller API error: ${response.status}`);
  }
  
  return response.json();
}

export async function tellerFetchTransactions(
  accountId: string,
  accessToken: string,
  params?: { count?: number; from_id?: string }
): Promise<any[]> {
  const query = new URLSearchParams();
  if (params?.count) query.set('count', String(params.count));
  if (params?.from_id) query.set('from_id', params.from_id);
  const qs = query.toString();
  const endpoint = `/accounts/${accountId}/transactions${qs ? `?${qs}` : ''}`;
  return tellerFetch(endpoint, accessToken);
}
