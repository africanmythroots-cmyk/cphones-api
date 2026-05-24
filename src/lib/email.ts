import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const isMock = !apiKey || apiKey === 'mock_resend_api_key' || apiKey.startsWith('re_123');

const resend = isMock ? null : new Resend(apiKey);

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends transactional email using Resend.
 * Falls back to console logger if API Key is not configured.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ success: boolean; id?: string }> {
  if (isMock || !resend) {
    console.log('\n=================== [EMAIL MOCK] ===================');
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('----------------------------------------------------');
    console.log('HTML Body:');
    console.log(html);
    console.log('====================================================\n');
    return { success: true, id: `mock_email_${Date.now()}` };
  }

  try {
    const response = await resend.emails.send({
      from: 'CPhones Tanzania <noreply@cphones.co.tz>',
      to,
      subject,
      html,
    });

    if (response.error) {
      console.error('[Resend Error]', response.error);
      return { success: false };
    }

    return { success: true, id: response.data?.id };
  } catch (error) {
    console.error('[Resend Exception]', error);
    return { success: false };
  }
}
