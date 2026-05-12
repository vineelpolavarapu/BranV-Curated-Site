import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Phase 1 mailer.
 *
 * USE_MOCK_INTEGRATIONS=true (default in dev): logs the message body to stdout.
 *   Useful for grabbing verification / reset links from logs without a real ESP.
 *
 * USE_MOCK_INTEGRATIONS=false: wire to Resend / Buttondown / Mailchimp in
 *   Phase 8 (`MAIL_PROVIDER`). For now this branch just throws so misconfigs
 *   surface loudly.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly mock: boolean;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.mock = (config.get<string>('USE_MOCK_INTEGRATIONS') ?? 'true') === 'true';
    this.from = config.get<string>('MAIL_FROM') ?? 'hello@branv.local';
  }

  async send(message: MailMessage): Promise<void> {
    if (this.mock) {
      this.logger.log(
        `\n────── MOCK MAIL ──────\nfrom: ${this.from}\nto: ${message.to}\nsubject: ${message.subject}\n${message.text}\n───────────────────────`,
      );
      return;
    }
    // Real provider wiring lands in Phase 8 (Reviews, Newsletter, Notifications).
    throw new Error(
      'Real email provider not yet implemented (Phase 8). Set USE_MOCK_INTEGRATIONS=true.',
    );
  }

  async sendEmailVerification(to: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: 'Verify your BranV email',
      text: `Welcome to BranV.\n\nVerify your email by visiting:\n${link}\n\nThis link expires in 24 hours.`,
    });
  }

  async sendPasswordReset(to: string, link: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your BranV password',
      text: `Reset your BranV password by visiting:\n${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this message.`,
    });
  }
}
