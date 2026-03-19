// Netlify serverless function — CORS proxy for slippilab.com animation zips
export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders() };
  }

  const file = (event.queryStringParameters || {}).file;

  if (!file || !/^[\w-]+\.zip$/.test(file)) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: `Bad request: invalid file parameter "${file}"`,
    };
  }

  const upstream = `https://slippilab.com/zips/${file}`;

  try {
    const response = await fetch(upstream, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: corsHeaders(),
        body: `Upstream error: ${response.status}`,
      };
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/zip',
        'Cache-Control': 'public, max-age=86400',
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: `Proxy error: ${err.message}`,
    };
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
