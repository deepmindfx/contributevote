// Deprecated unauthenticated proxy removed for production security.
// All Flutterwave operations run through authenticated Supabase Edge Functions
// using live credentials managed in Super Admin -> Gateway Settings.

exports.handler = async function () {
  return {
    statusCode: 410,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      error: 'Gone',
      message: 'This legacy proxy endpoint has been retired. Use authenticated Supabase Edge Functions.',
    }),
  };
};
