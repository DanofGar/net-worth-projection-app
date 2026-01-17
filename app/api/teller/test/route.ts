import { NextResponse } from 'next/server';
import { tellerFetch } from '@/lib/teller';

export async function GET() {
  // Use a sandbox test token from Teller docs
  const testToken = 'test_token_ky6igyqi3qxa4';
  
  // Check if env vars are loaded
  const envCheck = {
    TELLER_CERT_B64: !!process.env.TELLER_CERT_B64,
    TELLER_KEY_B64: !!process.env.TELLER_KEY_B64,
    certLength: process.env.TELLER_CERT_B64?.length || 0,
    keyLength: process.env.TELLER_KEY_B64?.length || 0,
    // Show first few chars to verify it's loading (safe to expose)
    certPreview: process.env.TELLER_CERT_B64?.substring(0, 20) || 'NOT SET',
    keyPreview: process.env.TELLER_KEY_B64?.substring(0, 20) || 'NOT SET',
    // List all TELLER_* env vars that are set
    tellerEnvVars: Object.keys(process.env)
      .filter(key => key.startsWith('TELLER_'))
      .reduce((acc, key) => {
        acc[key] = process.env[key] ? `${process.env[key]!.substring(0, 10)}... (${process.env[key]!.length} chars)` : 'NOT SET';
        return acc;
      }, {} as Record<string, string>),
  };
  
  try {
    const accounts = await tellerFetch('/accounts', testToken);
    return NextResponse.json({ success: true, accounts, envCheck });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: String(error),
      envCheck 
    }, { status: 500 });
  }
}
