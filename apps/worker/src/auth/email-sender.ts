import { otpEmail } from './otp-email.js';

export const EMAIL_TIMEOUT_MS = 5000;

/** Sends the login code through Cloudflare Email Sending. Only the outcome leaves this function. */
export async function sendOtpEmail(env: Pick<Env, 'EMAIL' | 'EMAIL_FROM_ADDRESS'>, to: string, otp: string, timeoutMs = EMAIL_TIMEOUT_MS): Promise<boolean> {
  const { subject, text, html } = otpEmail(otp);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); });
  try {
    const sent = await Promise.race([env.EMAIL.send({ from: env.EMAIL_FROM_ADDRESS, to, subject, text, html }).then(() => true), timeout]);
    if (!sent) console.error('EMAIL_SEND_TIMEOUT');
    return sent;
  } catch {
    // Provider errors can echo the recipient; log only the outcome.
    console.error('EMAIL_SEND_FAILED');
    return false;
  } finally {
    clearTimeout(timer);
  }
}
