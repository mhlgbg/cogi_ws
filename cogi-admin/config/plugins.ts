const nodemailer = require("nodemailer")

if (!global.__SMTP_DEBUG_PATCHED__) {
    global.__SMTP_DEBUG_PATCHED__ = true
    const originalCreateTransport = nodemailer.createTransport.bind(nodemailer)

    nodemailer.createTransport = (...args) => {
        const transporter = originalCreateTransport(...args)
        const originalSendMail = transporter.sendMail.bind(transporter)

        transporter.sendMail = async (mailOptions, ...rest) => {
            try {
                const authUser = transporter?.options?.auth?.user
                const from = mailOptions?.from
                const sender = mailOptions?.sender
                const returnPath = mailOptions?.returnPath
                const envelopeFrom = mailOptions?.envelope?.from
                const to = mailOptions?.to

                console.log("[SMTP DEBUG] authUser:", authUser)
                console.log("[SMTP DEBUG] from:", from)
                console.log("[SMTP DEBUG] sender:", sender)
                console.log("[SMTP DEBUG] returnPath:", returnPath)
                console.log("[SMTP DEBUG] envelope.from:", envelopeFrom)
                console.log("[SMTP DEBUG] to:", to)
            } catch (e) {
                console.log("[SMTP DEBUG] log failed:", e?.message)
            }
            return originalSendMail(mailOptions, ...rest)
        }

        return transporter
    }
}

export default ({ env }) => ({
  upload: {
    config: {
      sizeLimit: 20 * 1024 * 1024,
    },
  },
  email: {
    config: {
      provider: "@strapi/provider-email-nodemailer",
      providerOptions: {
        host: env("COMPANY_SMTP_HOST", env("SMTP_HOST")),
        port: env.int("COMPANY_SMTP_PORT", env.int("SMTP_PORT", 587)),
        secure: env.bool("COMPANY_SMTP_SECURE", env.bool("SMTP_SECURE", false)),
        auth: {
          user: env("COMPANY_SMTP_USERNAME", env("SMTP_USER")),
          pass: env("COMPANY_SMTP_PASSWORD", env("SMTP_PASS")),
        },
        // ❌ bỏ envelope ở đây (nodemailer không áp envelope ở transporter options)
      },
      settings: {
        // ✅ ép from chỉ là email thuần, KHÔNG kèm display name
        defaultFrom: env("COMPANY_DEFAULT_FROM", env("SMTP_FROM", env("SMTP_USER"))),
        defaultReplyTo: env("COMPANY_DEFAULT_REPLY_TO", env("SMTP_REPLY_TO", env("SMTP_USER"))),
      },
    },
  },
});