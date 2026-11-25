// Strips anything that looks like a phone number (7+ digits, optional +,
// spaces/dashes/parens between digits) so raw numbers never reach logs or
// error responses. Third-party errors (e.g. Twilio) can echo the number back.
const PHONE_LIKE = /\+?\d(?:[\s\-().]*\d){6,}/g;

export function redactPhones(text: string): string {
  return text.replace(PHONE_LIKE, '[redacted]');
}
