import tls from 'tls';

export interface EmailResult {
    success: boolean;
    provider_response?: string;
    error?: string;
    duration_ms?: number;
}

export interface SmtpHealthResult {
    service: string;
    smtp_connection: string;
    authentication: string;
    status: string;
}

function getSmtpConfig() {
    const host = process.env.MAIL_SERVER || process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.MAIL_PORT || process.env.SMTP_PORT || 465);
    const user = process.env.MAIL_USERNAME || process.env.SMTP_USER || process.env.SMTP_USERNAME || '';
    const pass = process.env.MAIL_PASSWORD || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
    const from = process.env.MAIL_FROM || process.env.SMTP_FROM || user || 'Ashutoshbariofficial@gmail.com';

    return { host, port, user, pass, from };
}

export function isEmailConfigured(): boolean {
    const { user, pass } = getSmtpConfig();
    const placeholders = ['your_gmail', 'your_email', 'your_password', 'example.com'];
    return Boolean(user && pass && !placeholders.some(p => user.toLowerCase().includes(p)));
}

/**
 * Native, zero-dependency Node.js TLS SMTP Sender.
 * Executes direct TLS handshake over port 465 for instant, production-grade delivery.
 */
export async function sendSmtpEmail(
    to: string,
    subject: string,
    htmlContent: string,
    textContent: string
): Promise<EmailResult> {
    const { host, port, user, pass, from } = getSmtpConfig();
    const startTime = Date.now();
    const domain = to.split('@')[1] || 'unknown';

    if (!isEmailConfigured()) {
        console.warn(`[OTP_EMAIL] send_failed=true reason="Production email configuration is incomplete." target_domain=${domain}`);
        return {
            success: false,
            error: 'Production email configuration is incomplete.',
        };
    }

    console.log(`[OTP_EMAIL] send_started=true target_domain=${domain} provider=smtp`);

    return new Promise((resolve) => {
        let resolved = false;
        const finish = (result: EmailResult) => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
                resolve(result);
            }
        };

        const timeout = setTimeout(() => {
            const dur = Date.now() - startTime;
            console.error(`[OTP_EMAIL] timeout=true duration=${dur}ms target_domain=${domain}`);
            finish({
                success: false,
                error: 'Connection to email provider timed out.',
                duration_ms: dur,
            });
        }, 12000);

        const socket = tls.connect(port, host, { rejectUnauthorized: false }, () => {
            // Socket connected
        });

        let step = 0;
        let responseBuffer = '';

        socket.on('data', (data) => {
            responseBuffer += data.toString();
            const lines = responseBuffer.split('\r\n');
            const lastLine = lines[lines.length - 2] || lines[lines.length - 1];

            // Wait until a complete response code (e.g. "220 ...", "250 ...", "334 ...", "235 ...")
            if (!/^\d{3}\s/.test(lastLine)) {
                return;
            }

            const code = parseInt(lastLine.slice(0, 3), 10);
            responseBuffer = ''; // reset buffer for next command

            if (code >= 400) {
                clearTimeout(timeout);
                const dur = Date.now() - startTime;
                console.error(`[OTP_EMAIL] provider_rejected=${code} msg="${lastLine}" duration=${dur}ms target_domain=${domain}`);
                return finish({
                    success: false,
                    error: `Email provider rejected message: ${lastLine}`,
                    duration_ms: dur,
                });
            }

            switch (step) {
                case 0: // 220 banner received -> send EHLO
                    step = 1;
                    socket.write(`EHLO ashvance.tech\r\n`);
                    break;
                case 1: // 250 EHLO response -> start AUTH LOGIN
                    step = 2;
                    socket.write(`AUTH LOGIN\r\n`);
                    break;
                case 2: // 334 Username challenge -> send base64 username
                    step = 3;
                    socket.write(`${Buffer.from(user).toString('base64')}\r\n`);
                    break;
                case 3: // 334 Password challenge -> send base64 password
                    step = 4;
                    socket.write(`${Buffer.from(pass.replace(/\s+/g, '')).toString('base64')}\r\n`);
                    break;
                case 4: // 235 Authentication succeeded -> send MAIL FROM
                    step = 5;
                    socket.write(`MAIL FROM:<${from}>\r\n`);
                    break;
                case 5: // 250 Sender OK -> send RCPT TO
                    step = 6;
                    socket.write(`RCPT TO:<${to}>\r\n`);
                    break;
                case 6: // 250 Recipient OK -> send DATA
                    step = 7;
                    socket.write(`DATA\r\n`);
                    break;
                case 7: // 354 Start mail input -> send full email payload
                    step = 8;
                    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                    const rawEmail = [
                        `From: ASHVANCE TECH <${from}>`,
                        `To: ${to}`,
                        `Subject: ${subject}`,
                        `MIME-Version: 1.0`,
                        `Content-Type: multipart/alternative; boundary="${boundary}"`,
                        ``,
                        `--${boundary}`,
                        `Content-Type: text/plain; charset=UTF-8`,
                        `Content-Transfer-Encoding: 7bit`,
                        ``,
                        textContent,
                        ``,
                        `--${boundary}`,
                        `Content-Type: text/html; charset=UTF-8`,
                        `Content-Transfer-Encoding: 7bit`,
                        ``,
                        htmlContent,
                        ``,
                        `--${boundary}--`,
                        `.`,
                        ``,
                    ].join('\r\n');

                    socket.write(rawEmail);
                    break;
                case 8: // 250 Message accepted -> send QUIT & resolve success
                    clearTimeout(timeout);
                    const duration = Date.now() - startTime;
                    console.log(`[OTP_EMAIL] provider_response=250 send_completed=true duration=${duration}ms target_domain=${domain}`);
                    socket.write(`QUIT\r\n`);
                    finish({
                        success: true,
                        provider_response: lastLine,
                        duration_ms: duration,
                    });
                    break;
            }
        });

        socket.on('error', (err) => {
            clearTimeout(timeout);
            const dur = Date.now() - startTime;
            console.error(`[OTP_EMAIL] socket_error="${err.message}" duration=${dur}ms target_domain=${domain}`);
            finish({
                success: false,
                error: `Network error connecting to email provider: ${err.message}`,
                duration_ms: dur,
            });
        });
    });
}

/**
 * Sends official ASHVANCE TECH OTP verification email matching Section 10 specifications.
 */
export async function sendOtpEmail(to: string, name: string, otpCode: string): Promise<EmailResult> {
    const cleanName = (name || '').trim() || 'Candidate';
    const subject = 'ASHVANCE TECH — Interview Verification Code';

    const textContent = `ASHVANCE TECH

Smart Interview AI

Dear ${cleanName},

Your verification code for the Smart Interview AI interview platform is:

${otpCode}

This code is valid for 5 minutes.

For security reasons, do not share this verification code with anyone.

Regards,
ASHVANCE TECH
Smart Interview AI

This is an automated email. Please do not reply.`;

    const digitsHtml = otpCode
        .split('')
        .map(
            (d) =>
                `<div style="display:inline-block;width:44px;height:52px;line-height:52px;text-align:center;font-size:26px;font-weight:900;color:#FFFFFF;background:linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(14,165,233,0.3) 100%);border:2px solid #6366F1;border-radius:10px;margin:0 4px;font-family:'Courier New',monospace;box-shadow:0 4px 12px rgba(99,102,241,0.25);">${d}</div>`
        )
        .join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ASHVANCE TECH — Interview Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0F1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#F8FAFC;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B0F1A;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:18px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.6);border:1px solid rgba(99,102,241,0.3);background-color:#0F172A;">
          <tr>
            <td style="background:linear-gradient(135deg, #0A0F1D 0%, #1E1B4B 60%, #4338CA 100%);padding:32px 40px;border-bottom:1px solid rgba(255,255,255,0.1);">
              <h1 style="margin:0;color:#FFFFFF;font-size:22px;font-weight:900;letter-spacing:-0.5px;">ASHVANCE TECH</h1>
              <p style="margin:4px 0 0;color:#38BDF8;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Smart Interview AI</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;background-color:#0F172A;">
              <p style="margin:0 0 16px;color:#E2E8F0;font-size:15px;line-height:1.6;">
                Dear <strong>${cleanName}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#94A3B8;font-size:14px;line-height:1.6;">
                Your verification code for the Smart Interview AI interview platform is:
              </p>
              <div style="background:rgba(10,15,29,0.85);border:1px solid rgba(99,102,241,0.4);border-radius:14px;padding:26px 16px;text-align:center;margin-bottom:26px;">
                <div style="margin-bottom:16px;white-space:nowrap;">
                  ${digitsHtml}
                </div>
                <div style="display:inline-block;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:20px;padding:4px 14px;">
                  <span style="color:#FBBF24;font-size:12px;font-weight:600;">Valid for 5 minutes</span>
                </div>
              </div>
              <p style="margin:0 0 20px;color:#94A3B8;font-size:13px;line-height:1.5;">
                For security reasons, do not share this verification code with anyone.
              </p>
              <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;margin-top:20px;">
                <p style="margin:0 0 4px;color:#E2E8F0;font-size:13px;font-weight:700;">Regards,</p>
                <p style="margin:0 0 2px;color:#6366F1;font-size:13px;font-weight:800;">ASHVANCE TECH</p>
                <p style="margin:0;color:#94A3B8;font-size:12px;">Smart Interview AI</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0A0F1D;padding:20px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:#64748B;font-size:11px;">
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return sendSmtpEmail(to, subject, htmlContent, textContent);
}

/**
 * Safe internal diagnostic check for SMTP connectivity and authentication.
 * Never exposes passwords or sensitive credentials.
 */
export async function checkSmtpHealth(): Promise<SmtpHealthResult> {
    const { host, port, user, pass } = getSmtpConfig();

    if (!isEmailConfigured()) {
        return {
            service: 'email',
            smtp_connection: 'failed',
            authentication: 'unconfigured',
            status: 'Production email configuration is incomplete.',
        };
    }

    return new Promise((resolve) => {
        let resolved = false;
        const finish = (result: SmtpHealthResult) => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
                resolve(result);
            }
        };

        const timeout = setTimeout(() => {
            finish({
                service: 'email',
                smtp_connection: 'timeout',
                authentication: 'untested',
                status: 'Connection to SMTP provider timed out.',
            });
        }, 8000);

        const socket = tls.connect(port, host, { rejectUnauthorized: false }, () => {});

        let step = 0;
        let responseBuffer = '';

        socket.on('data', (data) => {
            responseBuffer += data.toString();
            const lines = responseBuffer.split('\r\n');
            const lastLine = lines[lines.length - 2] || lines[lines.length - 1];

            if (!/^\d{3}\s/.test(lastLine)) return;
            const code = parseInt(lastLine.slice(0, 3), 10);
            responseBuffer = '';

            if (code >= 400) {
                clearTimeout(timeout);
                return finish({
                    service: 'email',
                    smtp_connection: 'ok',
                    authentication: 'failed',
                    status: `SMTP provider error: ${lastLine}`,
                });
            }

            switch (step) {
                case 0:
                    step = 1;
                    socket.write(`EHLO ashvance.tech\r\n`);
                    break;
                case 1:
                    step = 2;
                    socket.write(`AUTH LOGIN\r\n`);
                    break;
                case 2:
                    step = 3;
                    socket.write(`${Buffer.from(user).toString('base64')}\r\n`);
                    break;
                case 3:
                    step = 4;
                    socket.write(`${Buffer.from(pass.replace(/\s+/g, '')).toString('base64')}\r\n`);
                    break;
                case 4:
                    clearTimeout(timeout);
                    socket.write(`QUIT\r\n`);
                    finish({
                        service: 'email',
                        smtp_connection: 'ok',
                        authentication: 'ok',
                        status: 'ready',
                    });
                    break;
            }
        });

        socket.on('error', (err) => {
            clearTimeout(timeout);
            finish({
                service: 'email',
                smtp_connection: 'failed',
                authentication: 'untested',
                status: `Socket error: ${err.message}`,
            });
        });
    });
}
