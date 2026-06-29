# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## 📧 Email (Gmail SMTP)

Project này dùng `@strapi/provider-email-nodemailer` để gửi mail qua Gmail SMTP.

Thêm vào file `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_gmail@gmail.com
SMTP_REPLY_TO=your_gmail@gmail.com
```

Lưu ý:

- Nên dùng **Gmail App Password** (yêu cầu bật **2FA**) cho `SMTP_PASS`.
- Không nên dùng mật khẩu Gmail thường vì dễ gặp lỗi xác thực `534`.

## AI Chat Env

Public Chat AI dùng một API key OpenAI dùng chung toàn hệ thống.

Thêm vào file `.env`:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_DEFAULT_MODEL=gpt-4o-mini
```

Lưu ý:

- `OPENAI_API_KEY` là tùy chọn ở giai đoạn này. Nếu thiếu, hệ thống sẽ log warning và fallback về scripted reply.
- `OPENAI_DEFAULT_MODEL` là tùy chọn. Nếu tenant đã cấu hình `ai-assistant.model` thì model của tenant sẽ được ưu tiên.
- Không lưu API key vào tenant. Tenant chỉ cấu hình prompt, knowledge, model và trạng thái bật/tắt assistant.

## ⚙️ Deployment

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
