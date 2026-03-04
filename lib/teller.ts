import https from 'https';

export interface TellerAccount {
  id: string;
  name: string;
  type: string;
  subtype: string;
  last_four: string | null;
}

export interface TellerBalance {
  ledger: string;
  available: string | null;
}

export interface TellerTransaction {
  id: string;
  description: string;
  date: string;
  amount: string;
  status: string;
}

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

export async function tellerFetch<T = unknown>(
  endpoint: string,
  accessToken: string
): Promise<T> {
  const agent = getTellerAgent();
  const auth = Buffer.from(`${accessToken}:`).toString('base64');

  const response = await fetch(`https://api.teller.io${endpoint}`, {
    // @ts-expect-error - Node fetch supports agent option
    agent,
    headers: {
      'Authorization': `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Teller API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function tellerFetchTransactions<T = unknown>(
  accountId: string,
  accessToken: string,
  params?: { count?: number; from_id?: string }
): Promise<T[]> {
  const query = new URLSearchParams();
  if (params?.count) query.set('count', String(params.count));
  if (params?.from_id) query.set('from_id', params.from_id);
  const qs = query.toString();
  const endpoint = `/accounts/${accountId}/transactions${qs ? `?${qs}` : ''}`;
  return tellerFetch<T[]>(endpoint, accessToken);
}
