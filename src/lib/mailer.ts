import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP 未配置（缺少 SMTP_HOST / SMTP_USER / SMTP_PASS）");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user, pass },
  });
}

export interface EmailContent {
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(to: string, content: EmailContent): Promise<void> {
  const transport = getTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({
    from,
    to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}
