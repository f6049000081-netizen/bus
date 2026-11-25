import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID ?? '';

const DEV_BYPASS = process.env.DEV_OTP_BYPASS === 'true';

export async function sendOtp(phoneE164: string): Promise<void> {
  if (DEV_BYPASS) {
    // Never log the raw number — last 4 digits only (same as the stored phoneHint).
    console.log(`[DEV] OTP bypass enabled — code for …${phoneE164.slice(-4)} is 123456`);
    return;
  }
  await client.verify.v2.services(VERIFY_SID).verifications.create({
    to: phoneE164,
    channel: 'sms',
  });
}

export async function verifyOtp(phoneE164: string, code: string): Promise<boolean> {
  if (DEV_BYPASS) return code === '123456';
  const check = await client.verify.v2.services(VERIFY_SID).verificationChecks.create({
    to: phoneE164,
    code,
  });
  return check.status === 'approved';
}
