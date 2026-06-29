# Mail Queue Setup

Queue name: `cogi-mail-queue`

Environment variables in `.env`:

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
MAIL_QUEUE_ENABLED=true
MAIL_PROVIDER=ses
MAIL_FALLBACK_ENABLED=true
MAIL_FALLBACK_PROVIDER=company
MAIL_QUEUE_RATE_MAX=1
MAIL_QUEUE_RATE_DURATION=1000
MAIL_QUEUE_ATTEMPTS=3
MAIL_QUEUE_BACKOFF_DELAY=5000
MAIL_QUEUE_CONCURRENCY=1

SES_SMTP_HOST=email-smtp.ap-southeast-1.amazonaws.com
SES_SMTP_PORT=587
SES_SMTP_USERNAME=
SES_SMTP_PASSWORD=
SES_DEFAULT_FROM=no-reply@system.alphataiho.com
SES_DEFAULT_REPLY_TO=support@alphataiho.com

COMPANY_SMTP_HOST=
COMPANY_SMTP_PORT=
COMPANY_SMTP_SECURE=
COMPANY_SMTP_USERNAME=
COMPANY_SMTP_PASSWORD=
COMPANY_DEFAULT_FROM=
COMPANY_DEFAULT_REPLY_TO=
```

Run Redis on Windows:

```powershell
docker run --name cogi-redis -p 6379:6379 redis:7-alpine
```

Run the mail worker:

```powershell
npm run mail:worker
```

Example usage from a controller or service:

```ts
import { enqueueMail } from '../services/mail-queue';

await enqueueMail({
  tenantId,
  mailType: 'custom_notice',
  to: 'user@example.com',
  subject: 'Subject',
  html: '<p>Hello</p>',
  text: 'Hello',
  metadata: {
    source: 'example-controller',
  },
});
```

Provider behavior:

- Worker reads `MAIL_PROVIDER` as the primary provider.
- If `MAIL_FALLBACK_ENABLED=true` and the primary provider fails with a temporary error, worker retries immediately through `MAIL_FALLBACK_PROVIDER`.
- Invalid recipient or invalid message errors do not trigger fallback.
- BullMQ `jobId` remains string-based as `mail-log-<id>`.

Quick test guide:

1. Set `MAIL_PROVIDER=company` to verify the old company SMTP path only.
2. Set `MAIL_PROVIDER=ses` to verify AWS SES SMTP as the primary path.
3. Set `MAIL_FALLBACK_ENABLED=false` to verify primary-provider failures surface as `FAILED` or `RETRYING`.
4. Use Mail Monitor `Send Test Mail` to create a queue job and inspect `provider`, `fallbackProvider`, `providerMessageId`, and `sendStatus` in `mail_logs`.