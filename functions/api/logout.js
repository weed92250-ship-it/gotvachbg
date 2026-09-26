export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json',
      'Set-Cookie': 'gotvach_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
    },
  });
}
