// Vercel Serverless Function - proxies RPC requests to Shinami
// The API key stays server-side and is never exposed to the browser

export const config = {
  runtime: 'edge', // Use edge runtime for lower latency
};

export default async function handler(request: Request) {
  // Only allow POST requests (Sui RPC uses POST)
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Get the API key from environment (set in Vercel dashboard, NOT prefixed with VITE_)
  const apiKey = process.env.SHINAMI_API_KEY;
  if (!apiKey) {
    return new Response('RPC not configured', { status: 500 });
  }

  const suiRpcUrl = `https://api.us1.shinami.com/sui/node/v1/${apiKey}`;

  try {
    const body = await request.text();
    
    const response = await fetch(suiRpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    const data = await response.text();
    
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        // Allow requests from your frontend
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('RPC proxy error:', error);
    return new Response(JSON.stringify({ error: 'RPC request failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
