import { createAuthClient } from 'better-auth/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';

/** Same-origin Better Auth client. Every call returns `{ data, error }` instead of throwing. */
export const authClient = createAuthClient({
  baseURL: typeof location === 'undefined' ? 'http://localhost' : location.origin,
  basePath: '/api/auth',
  plugins: [emailOTPClient(), passkeyClient()],
});

export const sendLoginCode = (email: string) => authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });

/** `name` is used only when this email registers for the first time. */
export const verifyLoginCode = (email: string, otp: string, name: string) => authClient.signIn.emailOtp({ email, otp, name });

export const signInWithPasskey = (autoFill = false) => authClient.signIn.passkey({ autoFill });
export const addPasskey = () => authClient.passkey.addPasskey({ name: '魔導戦記' });
export const listPasskeys = () => authClient.passkey.listUserPasskeys();
export const deletePasskey = (id: string) => authClient.passkey.deletePasskey({ id });
export const signOut = () => authClient.signOut();
