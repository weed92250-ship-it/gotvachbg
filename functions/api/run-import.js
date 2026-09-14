export async function onRequestPost(context) {
  const { env, request } = context;
  const key = request.headers.get('x-admin-key');
  return new Response(JSON.stringify({
    receivedKey: key,
    envKey: env.ADMIN_KEY,
    envKeyType: typeof env.ADMIN_KEY,
    match: key === env.ADMIN_KEY,
  }), {
    headers: { 'content-type': 'application/json' },
  });
}
