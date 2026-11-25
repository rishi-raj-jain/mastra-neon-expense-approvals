// Creates the Acme organization in Neon Auth with three users:
// Dana Smith (owner), Zhang Kai (admin), and Alex Lopez (member).
const baseUrl = process.env.NEON_AUTH_BASE_URL!;
const password = 'AbC123dEf';
// Neon Auth only accepts requests from trusted origins. localhost is
// trusted while Allow localhost is on.
const trustedOrigin = 'http://localhost:4111';

async function call(path: string, body: unknown, cookie?: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: trustedOrigin, ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${JSON.stringify(data)}`);
  const sessionCookie = res.headers
    .getSetCookie()
    .map(c => c.split(';')[0])
    .find(c => c.startsWith('__Secure-neon-auth.session_token='));
  return { data, cookie: sessionCookie };
}

async function signUp(name: string, email: string) {
  const { data, cookie } = await call('/sign-up/email', { name, email, password });
  return { id: data.user.id as string, cookie: cookie! };
}

const dana = await signUp('Dana Smith', 'dana@example.com');
const zhang = await signUp('Zhang Kai', 'zhang@example.com');
const alex = await signUp('Alex Lopez', 'alex@example.com');

// The creator of an organization becomes its owner.
const { data: org } = await call('/organization/create', { name: 'Acme', slug: 'acme' }, dana.cookie);

for (const [user, email, role] of [
  [zhang, 'zhang@example.com', 'admin'],
  [alex, 'alex@example.com', 'member'],
] as const) {
  const { data: invitation } = await call(
    '/organization/invite-member',
    { organizationId: org.id, email, role },
    dana.cookie,
  );
  await call('/organization/accept-invitation', { invitationId: invitation.id }, user.cookie);
}

console.log(`NEON_AUTH_ORGANIZATION_ID=${org.id}`);

export {};
