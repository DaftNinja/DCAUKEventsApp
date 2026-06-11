import { Resend } from "resend";

// Sender — default uses the verified contact@1giglabs.com address.
// Override with RESEND_FROM if needed.
const FROM = process.env.RESEND_FROM ?? "1GigLabs <contact@1giglabs.com>";
const APP_URL = process.env.APP_URL ?? "https://insights-generator-production.up.railway.app";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("⚠️  RESEND_API_KEY not set — emails will be logged only");
    return {
      emails: {
        send: async (opts: any) => {
          console.log(`[Email mock] To: ${opts.to} | Subject: ${opts.subject}`);
          return { data: { id: "mock" }, error: null };
        },
      },
    } as any;
  }
  return new Resend(key);
}

async function send(opts: { to: string; subject: string; html: string }): Promise<void> {
  console.log(`📧 Sending email to ${opts.to}: ${opts.subject}`);
  try {
    const { data, error } = await getResend().emails.send({ from: FROM, ...opts });
    if (error) {
      console.error(`❌ Email send error to ${opts.to}:`, error);
      throw new Error(`Email failed: ${JSON.stringify(error)}`);
    }
    console.log(`✅ Email sent to ${opts.to} (id: ${(data as any)?.id})`);
  } catch (err) {
    console.error(`❌ Email exception to ${opts.to}:`, err);
    throw err;
  }
}

// ─── Magic link sign-in ───────────────────────────────────────────────────────

export async function sendMagicLinkEmail(
  email: string,
  firstName: string,
  token: string
): Promise<void> {
  const link = `${APP_URL}/api/auth/callback?token=${token}`;
  console.log(`🔗 Magic link: ${link}`);

  await send({
    to: email,
    subject: "Your 1GigLabs sign-in link",
    html: `
      <div style="font-family: Inter, -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: white; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="margin-bottom: 24px;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: #3b82f6; border-radius: 8px; margin-bottom: 16px;">
              <span style="color: white; font-weight: 700; font-size: 13px;">1GL</span>
            </div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #0f1729;">Sign in to 1GigLabs</h1>
          </div>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
            Hi ${firstName}, click the button below to sign in to your <strong>1GigLabs Insight Generator</strong> account. This link can only be used once and expires in 15 minutes.
          </p>
          <a href="${link}" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 6px; margin-bottom: 24px;">
            Sign in
          </a>
          <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px;">
            If you didn't request this, you can safely ignore this email.
          </p>
          <p style="color: #cbd5e1; font-size: 12px; margin: 0; word-break: break-all;">
            Or paste this URL into your browser: <span style="color: #3b82f6;">${link}</span>
          </p>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">1GigLabs · contact@1giglabs.com</p>
      </div>
    `,
  });
}

// ─── Credit limit notification ────────────────────────────────────────────────

export async function sendCreditLimitEmail(email: string, firstName: string): Promise<void> {
  await send({
    to: email,
    subject: "You've used all your 1GigLabs report credits",
    html: `
      <div style="font-family: Inter, -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: white; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0;">
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #0f1729;">Report credits used</h1>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
            Hi ${firstName}, you've used all 5 of your free report credits.
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
            To continue generating reports, email <a href="mailto:contact@1giglabs.com" style="color: #3b82f6;">contact@1giglabs.com</a> to request additional credits.
          </p>
          <p style="color: #94a3b8; font-size: 13px;">Cached reports don't use credits.</p>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">1GigLabs · contact@1giglabs.com</p>
      </div>
    `,
  });
}
