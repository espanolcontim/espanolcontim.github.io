import { createTransport } from 'nodemailer'

export interface Letter {
  to: string
  subject: string
  text: string
  html: string
}

export interface Mailer {
  send(letter: Letter): Promise<void>
}

/** Яндекс Почта по SMTP: ящик `SMTP_USER`, пароль приложения `SMTP_PASSWORD`. Письмо — от этого же ящика. */
export class SmtpMailer implements Mailer {
  private readonly user: string
  private readonly password: string

  constructor(user: string, password: string) {
    this.user = user
    this.password = password
  }

  async send(letter: Letter): Promise<void> {
    const transport = createTransport({
      host: 'smtp.yandex.ru',
      port: 465,
      secure: true,
      auth: { user: this.user, pass: this.password },
      // Не ждать почту до таймаута функции.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
    try {
      await transport.sendMail({ from: { name: 'Español con Tim', address: this.user }, ...letter })
    } finally {
      transport.close()
    }
  }
}

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** Письмо со ссылкой для входа. Без картинок и внешних ресурсов — так реже попадает в спам. */
export const loginLetter = (to: string, link: string): Letter => ({
  to,
  subject: 'Вход на сайт Español con Tim',
  text: [
    'Здравствуйте!',
    '',
    'Чтобы войти на сайт Español con Tim, откройте ссылку:',
    link,
    '',
    'Ссылка действует 15 минут. Входить нужно один раз на каждом устройстве.',
    'Если вы не запрашивали вход, просто удалите это письмо.',
    '',
    'Тимур, Español con Tim',
  ].join('\n'),
  html: [
    '<p>Здравствуйте!</p>',
    `<p>Чтобы войти на сайт Español con Tim, откройте ссылку:<br><a href="${escapeHtml(link)}">Войти на сайт</a></p>`,
    '<p>Ссылка действует 15 минут. Входить нужно один раз на каждом устройстве.<br>',
    'Если вы не запрашивали вход, просто удалите это письмо.</p>',
    '<p>Тимур, Español con Tim</p>',
  ].join('\n'),
})
