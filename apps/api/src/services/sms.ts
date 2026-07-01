import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID ?? '';

export async function sendOtp(phoneE164: string): Promise<void> {
  await client.verify.v2.services(VERIFY_SID).verifications.create({
    to: phoneE164,
    channel: 'sms',
  });
}

export async function verifyOtp(phoneE164: string, code: string): Promise<boolean> {
  const check = await client.verify.v2.services(VERIFY_SID).verificationChecks.create({
    to: phoneE164,
    code,
  });
  return check.status === 'approved';
}
