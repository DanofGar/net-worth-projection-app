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
