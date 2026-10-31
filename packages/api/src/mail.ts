/**
 * メール送信 (FR-25)。外部へ出るのはこの1関数だけにする (NFR-04)。
 *
 * テンプレートは招待・再設定・連携確認の3つ。本文に業務データ (明細・金額) を載せない。
 * 失敗の記録はテンプレート名と Resend の HTTP 状態だけで、宛先や本文・リンクは出さない。
 *
 * RESEND_API_KEY が無い環境 (ローカル) では送らない。開発outboxでも宛先・URLはログへ出さない。
 */

export type MailTemplate = 'invite' | 'password_reset' | 'link_confirm';

export interface MailEnv {
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  MAIL_DEV_OUTBOX?: string;
}

export interface MailParams {
  /** 画面へ戻る URL。トークンを含むので、ログには出さない。 */
  url: string;
  /** 招待の役割など、本文の言い回しを変える補足。 */
  role?: 'admin' | 'member';
}

export class MailSendError extends Error {
  constructor(
    readonly template: MailTemplate,
    readonly status: number | null,
  ) {
    super(`mail_send_failed:${template}`);
    this.name = 'MailSendError';
  }
}

const APP_NAME = 'Focus Ledger';

function productionMailFrom(env: MailEnv, template: MailTemplate): string {
  const from = env.MAIL_FROM?.trim();
  // Resendを使う環境では検証済み送信元を必須にし、予約ドメインへの誤配信を防ぐ。
  if (
    !from ||
    /[\r\n]/.test(from) ||
    !from.includes('@') ||
    /@(?:[^>]*\.)?example\.(?:com|net|org|invalid)>?$/i.test(from)
  ) {
    throw new MailSendError(template, null);
  }
  return from;
}

function render(template: MailTemplate, params: MailParams): { subject: string; text: string } {
  switch (template) {
    case 'invite':
      return {
        subject: `${APP_NAME} への招待`,
        text: [
          `${APP_NAME} に${params.role === 'admin' ? '管理者として' : ''}招待されました。`,
          '次のリンクから 72 時間以内に登録してください。',
          '',
          params.url,
          '',
          '心当たりがない場合は、このメールを破棄してください。',
        ].join('\n'),
      };
    case 'password_reset':
      return {
        subject: `${APP_NAME} のパスワード再設定`,
        text: [
          'パスワードの再設定を受け付けました。',
          '次のリンクから 1 時間以内に新しいパスワードを設定してください。',
          '',
          params.url,
          '',
          '心当たりがない場合は、このメールを破棄してください。パスワードは変わりません。',
        ].join('\n'),
      };
    case 'link_confirm':
      return {
        subject: `${APP_NAME} のログイン手段の追加の確認`,
        text: [
          'ログイン手段の追加を受け付けました。',
          '次のリンクから 1 時間以内に確認してください。',
          '',
          params.url,
          '',
          '心当たりがない場合は、パスワードを変更してください。',
        ].join('\n'),
      };
  }
}

export type SendMail = (to: string, template: MailTemplate, params: MailParams) => Promise<void>;

/** テストで差し替えるための口。null のときは既定の Resend 送信を使う。 */
let override: SendMail | null = null;

export function setSendMailForTest(fn: SendMail | null): void {
  override = fn;
}

export function createSendMail(env: MailEnv): SendMail {
  return async (to, template, params) => {
    if (override) return override(to, template, params);
    const message = render(template, params);
    if (!env.RESEND_API_KEY) {
      if (env.MAIL_DEV_OUTBOX === '1') {
        console.log(JSON.stringify({ level: 'info', job: 'mail_dev_outbox', template, queued: 1 }));
        return;
      }
      throw new MailSendError(template, null);
    }
    const from = productionMailFrom(env, template);
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [to],
          subject: message.subject,
          text: message.text,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          job: 'mail_send',
          template,
          name: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      throw new MailSendError(template, null);
    }
    if (!response.ok) {
      console.error(JSON.stringify({ level: 'error', job: 'mail_send', template, status: response.status }));
      throw new MailSendError(template, response.status);
    }
  };
}
