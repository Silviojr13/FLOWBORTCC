import nodemailer from "nodemailer";

/**
 * Envio de e-mail por SMTP (Gmail com senha de app, Brevo ou qualquer provedor).
 * Variáveis: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e MAIL_FROM.
 *
 * Sem SMTP configurado, em desenvolvimento a mensagem vai para o terminal (útil para
 * testar o fluxo); em produção o envio falha com erro no log do servidor.
 */

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 usa TLS direto; 587 inicia em texto e sobe para TLS (STARTTLS).
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[e-mail não enviado: SMTP não configurado]\nPara: ${message.to}\nAssunto: ${message.subject}\n${message.text}\n`);
      return;
    }
    throw new Error("SMTP não configurado: defina SMTP_HOST, SMTP_USER e SMTP_PASS.");
  }

  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || `FlowBot <${process.env.SMTP_USER}>`,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
