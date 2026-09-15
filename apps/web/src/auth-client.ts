import { createAuthClient } from 'better-auth/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';

/** Same-origin Better Auth client. Exported operations also normalize transport failures. */
export const authClient = createAuthClient({
  baseURL: typeof location === 'undefined' ? 'http://localhost' : location.origin,
  basePath: '/api/auth',
  plugins: [emailOTPClient(), passkeyClient()],
});

async function authResult<T>(action: () => Promise<T>) {
  try { return await action(); }
  catch { return { data: null, error: { status: 0, code: 'NETWORK_ERROR', message: 'NETWORK_ERROR' } } as const; }
}

export const sendLoginCode = (email: string) => authResult(() => authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' }));

/** `name` is used only when this email registers for the first time. */
export const verifyLoginCode = (email: string, otp: string, name: string) => authResult(() => authClient.signIn.emailOtp({ email, otp, name }));

export const signInWithPasskey = (autoFill = false) => authResult(() => authClient.signIn.passkey({ autoFill }));
export const addPasskey = () => authResult(() => authClient.passkey.addPasskey({ name: '魔導戦記' }));
export const listPasskeys = () => authResult(() => authClient.passkey.listUserPasskeys());
export const deletePasskey = (id: string) => authResult(() => authClient.passkey.deletePasskey({ id }));
export const signOut = () => authResult(() => authClient.signOut());
