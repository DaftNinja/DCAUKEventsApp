import { Resend } from "resend";

// Sender — default uses the verified contact@stellanordc.com address.
// Override with RESEND_FROM if needed.
const FROM = process.env.RESEND_FROM ?? "Stellanor <contact@stellanordc.com>";
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
    subject: "Your Stellanor sign-in link",
    html: `
      <div style="font-family: Inter, -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: white; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0;">
          <div style="margin-bottom: 24px;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: #3b82f6; border-radius: 8px; margin-bottom: 16px;">
              <span style="color: white; font-weight: 700; font-size: 13px;">SN</span>
            </div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #0f1729;">Sign in to Stellanor</h1>
          </div>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
            Hi ${firstName}, click the button below to sign in to your <strong>Stellanor Insight Generator</strong> account. This link can only be used once and expires in 15 minutes.
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
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Stellanor · contact@stellanordc.com</p>
      </div>
    `,
  });
}

// ─── Credit limit notification ────────────────────────────────────────────────

export async function sendCreditLimitEmail(email: string, firstName: string): Promise<void> {
  await send({
    to: email,
    subject: "You've used all your Stellanor report credits",
    html: `
      <div style="font-family: Inter, -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: white; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0;">
          <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 600; color: #0f1729;">Report credits used</h1>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
            Hi ${firstName}, you've used all 5 of your free report credits.
          </p>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
            To continue generating reports, email <a href="mailto:contact@stellanordc.com" style="color: #3b82f6;">contact@stellanordc.com</a> to request additional credits.
          </p>
          <p style="color: #94a3b8; font-size: 13px;">Cached reports don't use credits.</p>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px;">Stellanor · contact@stellanordc.com</p>
      </div>
    `,
  });
}

// ─── Report ready notification ──────────────────────────────────────────────────

export async function sendReportReadyEmail(
  email: string,
  firstName: string,
  companyName: string,
  reportSlug: string,
  generationSeconds: number
): Promise<void> {
  const reportUrl = `${APP_URL}/reports/${reportSlug}`;
  await send({
    to: email,
    subject: `Your ${companyName} report is ready`,
    html: `
      <div style="font-family: Inter, -apple-system, Segoe UI, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0a0a14;">
        <div style="background: #13132a; border-radius: 10px; padding: 32px; border: 1px solid rgba(170,101,255,0.2);">
          <div style="margin-bottom: 24px;">
            <div style="display: inline-flex; align-items: center; gap: 10px; margin-bottom: 20px;">
              <div style="width: 32px; height: 32px; background: #aa65ff; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                <span style="color: #0a0a14; font-weight: 700; font-size: 11px;">SN</span>
              </div>
              <span style="color: #aa65ff; font-weight: 600; font-size: 13px;">Stellanor Insight Generator</span>
            </div>
            <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #f0eeff;">Your report is ready</h1>
            <p style="margin: 0; color: #9b96c4; font-size: 13px;">Generated in ${generationSeconds}s</p>
          </div>
          <p style="color: #9b96c4; font-size: 15px; line-height: 1.6; margin: 0 0 4px;">Hi ${firstName}, your strategic intelligence report for</p>
          <p style="color: #f0eeff; font-size: 20px; font-weight: 600; margin: 0 0 20px;">${companyName}</p>
          <p style="color: #9b96c4; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            is ready to view. It covers financials, market position, SWOT analysis, ESG, digital transformation, growth opportunities, risk assessment, and a tailored Stellanor sales brief.
          </p>
          <a href="${reportUrl}" style="display: inline-block; background: #aa65ff; color: #0a0a14; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 6px; margin-bottom: 24px;">
            View Report →
          </a>
          <p style="color: #5e5a80; font-size: 11px; margin: 0; word-break: break-all;">
            Or paste into your browser: ${reportUrl}
          </p>
        </div>
        <p style="text-align: center; color: #5e5a80; font-size: 11px; margin-top: 16px;">Stellanor · contact@stellanordc.com</p>
      </div>
    `,
  });
}
