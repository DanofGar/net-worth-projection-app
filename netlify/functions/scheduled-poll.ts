import { Handler, schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import https from 'https';

// Initialize Supabase admin client (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Create Teller mTLS agent
function getTellerAgent() {
  const cert = Buffer.from(process.env.TELLER_CERT_B64!, 'base64');
  const key = Buffer.from(process.env.TELLER_KEY_B64!, 'base64');
  return new https.Agent({ cert, key });
}

async function tellerFetch(endpoint: string, accessToken: string) {
  const agent = getTellerAgent();
  const auth = Buffer.from(`${accessToken}:`).toString('base64');

  const response = await fetch(`https://api.teller.io${endpoint}`, {
    // @ts-ignore - Node fetch supports agent
    agent,
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Teller API error ${response.status}: ${error}`);
  }

  return response.json();
}

const handler: Handler = async () => {
  console.log('Starting scheduled balance poll...');

  // Get all enrollments
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('id, access_token, institution_name');

  if (enrollmentsError) {
    console.error('Failed to fetch enrollments:', enrollmentsError);
    return { statusCode: 500, body: 'Failed to fetch enrollments' };
  }

  if (!enrollments || enrollments.length === 0) {
    console.log('No enrollments to poll');
    return { statusCode: 200, body: 'No enrollments to poll' };
  }

  let successCount = 0;
  let errorCount = 0;

  for (const enrollment of enrollments) {
    console.log(`Polling ${enrollment.institution_name}...`);

    try {
      // Fetch accounts from Teller
      const tellerAccounts = await tellerFetch('/accounts', enrollment.access_token);

      for (const tellerAccount of tellerAccounts) {
        // Get our account record - use maybeSingle to handle missing accounts gracefully
        const { data: accountRow, error: accountError } = await supabase
          .from('accounts')
          .select('id')
          .eq('teller_account_id', tellerAccount.id)
          .maybeSingle();

        if (accountError) {
          console.error(`Error fetching account ${tellerAccount.id}:`, accountError);
          continue;
        }

        if (!accountRow) {
          // Account exists in Teller but not in our DB - might be newly added
          console.warn(`Account ${tellerAccount.id} not found in database, skipping`);
          continue;
        }

        // Fetch balance from Teller
        try {
          const balance = await tellerFetch(
            `/accounts/${tellerAccount.id}/balances`,
            enrollment.access_token
          );

          // Insert new balance record
          const { error: balanceError } = await supabase.from('balances').insert({
            account_id: accountRow.id,
            ledger: parseFloat(balance.ledger),
            available: balance.available ? parseFloat(balance.available) : null,
          });

          if (balanceError) {
            console.error(`Error inserting balance for ${tellerAccount.id}:`, balanceError);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (balanceErr) {
          console.error(`Error fetching balance for ${tellerAccount.id}:`, balanceErr);
          errorCount++;
        }
      }

      // Update last_polled_at
      await supabase
        .from('enrollments')
        .update({ last_polled_at: new Date().toISOString() })
        .eq('id', enrollment.id);

    } catch (err) {
      console.error(`Error polling ${enrollment.institution_name}:`, err);
      errorCount++;
      
      // Check for auth errors (token expired/revoked)
      if (err instanceof Error && err.message.includes('401')) {
        console.error(`Auth error for ${enrollment.institution_name} - token may need refresh`);
        // TODO: Implement token refresh flow or notify user
      }
    }
  }

  console.log(`Poll complete. Success: ${successCount}, Errors: ${errorCount}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Polling complete',
      success: successCount,
      errors: errorCount,
    }),
  };
};

// Run at 6am, 12pm, 6pm ET (11:00, 17:00, 23:00 UTC)
export const scheduledHandler = schedule('0 11,17,23 * * *', handler);

// Also export raw handler for manual triggering
export { handler };
