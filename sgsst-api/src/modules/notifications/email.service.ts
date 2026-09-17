import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env';

type EmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter?: Transporter;

  async send(input: EmailInput) {
    if (!env.emailEnabled) {
      this.logger.log(`[email disabled] ${input.to} - ${input.subject}`);
      return { sent: false, disabled: true };
    }

    if (!env.smtpHost || !env.smtpFrom) {
      this.logger.warn('Email is enabled but SMTP_HOST or SMTP_FROM is missing');
      return { sent: false, misconfigured: true };
    }

    await this.getTransporter().sendMail({
      from: env.smtpFrom,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { sent: true };
  }

  private getTransporter() {
    this.transporter =
      this.transporter ??
      nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        auth:
          env.smtpUser && env.smtpPassword
            ? { user: env.smtpUser, pass: env.smtpPassword }
            : undefined,
      });
    return this.transporter;
  }
}
