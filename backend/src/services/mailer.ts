import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config";

let transporter: Transporter | null = null;

export async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  if (config.etherealUser && config.etherealPass) {
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: { user: config.etherealUser, pass: config.etherealPass },
      pool: true,
      maxConnections: 5,
    });
    console.log("[mailer] using provided Ethereal account");
    return transporter;
  }

  // Auto-create a throwaway Ethereal account for local dev.
  const testAccount = await nodemailer.createTestAccount();
  console.log("[mailer] created Ethereal test account:", testAccount.user);
  console.log("[mailer] preview inbox: https://ethereal.email/login");
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
    pool: true,
    maxConnections: 5,
  });
  return transporter;
}

export function getPreviewUrl(info: { messageId?: string } & Record<string, unknown>): string | null {
  try {
    const url = nodemailer.getTestMessageUrl(info as never);
    return typeof url === "string" ? url : null;
  } catch {
    return null;
  }
}
