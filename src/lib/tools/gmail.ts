import { google } from 'googleapis';

function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  timestamp: string;
}

export async function checkEmails(query: string = '', maxResults: number = 5): Promise<EmailMessage[]> {
  try {
    const gmail = getGmailClient();

    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query || 'is:inbox',
      maxResults: Math.min(maxResults, 20),
    });

    const messages: EmailMessage[] = [];

    if (res.data.messages) {
      for (const message of res.data.messages) {
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full',
        });

        const headers = msg.data.payload?.headers || [];
        const fromHeader = headers.find((h) => h.name === 'From');
        const subjectHeader = headers.find((h) => h.name === 'Subject');
        const dateHeader = headers.find((h) => h.name === 'Date');

        messages.push({
          id: message.id!,
          from: fromHeader?.value || 'Unknown',
          subject: subjectHeader?.value || '(no subject)',
          snippet: msg.data.snippet || '',
          timestamp: dateHeader?.value || new Date().toISOString(),
        });
      }
    }

    return messages;
  } catch (err) {
    console.error('Gmail check emails error:', err);
    throw err;
  }
}

export async function draftEmail(
  to: string,
  subject: string,
  body: string,
  cc?: string
): Promise<{ id: string; message: string }> {
  try {
    const gmail = getGmailClient();

    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      cc ? `Cc: ${cc}` : '',
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      body,
    ]
      .filter((line) => line !== '')
      .join('\n');

    const encodedEmail = Buffer.from(emailLines).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    const res = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedEmail,
        },
      },
    });

    return {
      id: res.data.id || '',
      message: `Draft created for ${to} with subject "${subject}"`,
    };
  } catch (err) {
    console.error('Gmail draft email error:', err);
    throw err;
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  cc?: string
): Promise<{ id: string; message: string }> {
  try {
    const gmail = getGmailClient();

    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      cc ? `Cc: ${cc}` : '',
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      body,
    ]
      .filter((line) => line !== '')
      .join('\n');

    const encodedEmail = Buffer.from(emailLines).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });

    return {
      id: res.data.id || '',
      message: `Email sent to ${to}`,
    };
  } catch (err) {
    console.error('Gmail send email error:', err);
    throw err;
  }
}
