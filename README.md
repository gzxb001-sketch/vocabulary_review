# 竹墨词库 (Vocabulary Review)

一款面向英语学习者的词汇采集与间隔复习应用。通过拍照 OCR 快速录入生词，结合间隔重复（SRS）算法科学安排复习，支持离线同步、邮件/推送提醒和多设备数据隔离。

## 核心功能

- **OCR 录词**：拍照/截图识别英文生词，自动清洗识别结果并录入词库（客户端 Tesseract.js）。
- **智能词典降级链**：本地考研词库 → Free Dictionary → MyMemory 翻译 → 通用词库兜底，保证每个生词都能拿到中文释义。
- **间隔复习（SRS）**：基于 `known / vague / forgot` 三态的学习阶梯算法，遗忘后会在会话内重现，而不是简单推迟到次日。
- **离线同步（PWA）**：IndexedDB 缓存 + Service Worker，离线也能复习，联网后幂等同步（`clientResultId` 防止重复计分）。
- **多租户数据隔离**：所有查询与变更均按 `userId` 过滤，按 id 操作使用 `{ id, userId }` 双重归属校验，A 用户无法访问 B 用户数据。
- **找回密码**：邮箱验证码重置密码（10 分钟有效、5 次尝试上限、发送冷却、防枚举）。
- **提醒通知**：邮件提醒（QQ SMTP）与浏览器 Web Push 推送。
- **学习统计**：每周趋势图、词库筛选、顽固词标记、掌握度（间隔 ≥21 天且最近一次为「认识」即视为已掌握）。
- **专项攻克**：一键进入顽固词专项复习（取难度最高的 20 词），答题照常推进 SRS。
- **导入导出**：CSV 导出备份；支持导入本产品导出的 CSV、Anki Tab 分隔文本或「单词,释义」简单格式，重复词自动跳过并合并义项。

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16（App Router）+ React 19 + TypeScript |
| 数据库 | Prisma + Turso（libsql / SQLite） |
| 鉴权 | `jose`（JWT，HS256） |
| 密码 | `bcryptjs` |
| OCR | `tesseract.js`（客户端运行） |
| 状态 | `zustand` |
| 邮件 | `nodemailer` |
| 推送 | `web-push`（VAPID） |
| 校验 | `zod` |

## 快速开始

### 环境要求

- Node.js 18+
- npm

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制示例文件并填写：

```bash
cp .env.example .env
```

本地开发最小配置（使用本地 SQLite 文件）：

```env
DATABASE_URL="file:./dev.db"
# JWT_SECRET 本地可留空，会回退到开发密钥
```

如需连接 Turso（生产/远端数据库）：

```env
DATABASE_URL="libsql://your-database-name.turso.io"
TURSO_AUTH_TOKEN="your-turso-auth-token"
JWT_SECRET="generate-a-64-byte-hex-secret"
```

### 3. 初始化数据库

```bash
npx prisma generate
npx prisma db push
```

### 4. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 即可使用。

## 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | 数据库连接串，本地可用 `file:./dev.db`，生产用 Turso `libsql://...` |
| `TURSO_AUTH_TOKEN` | 生产 ✅ | Turso 鉴权令牌（本地 SQLite 不需要） |
| `JWT_SECRET` | 生产 ✅ | JWT 签名密钥，生产环境必须为强随机值 |
| `SMTP_HOST` | 邮件功能 | SMTP 服务器地址 |
| `SMTP_PORT` | 邮件功能 | SMTP 端口（QQ 邮箱 465） |
| `SMTP_SECURE` | 邮件功能 | 是否 SSL（`true`/`false`） |
| `SMTP_USER` | 邮件功能 | 发件邮箱账号 |
| `SMTP_PASS` | 邮件功能 | 邮箱授权码 |
| `SMTP_FROM` | 邮件功能 | 发件人名称与地址 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 推送功能 | Web Push 公钥 |
| `VAPID_PRIVATE_KEY` | 推送功能 | Web Push 私钥 |
| `VAPID_SUBJECT` | 推送功能 | VAPID 联系人（`mailto:` 地址） |
| `CRON_SECRET` | 生产 ✅ | 定时任务鉴权。`/api/email/send` 在生产环境未配置时直接拒绝（403）；cron 调用需携带 `Authorization: Bearer <CRON_SECRET>` |

> `JWT_SECRET` 生产环境推荐用 `crypto.randomBytes(64).toString('hex')` 生成。若未配置且 `NODE_ENV=production`，鉴权会直接抛出错误，避免使用可预测的兜底密钥。

## 项目结构

```
src/
├── app/                    # 页面与 API 路由（App Router）
│   ├── api/                # 后端接口
│   │   ├── auth/           # 注册/登录/找回密码
│   │   ├── words/          # 词库 CRUD/搜索/导入导出/词典增强
│   │   ├── review/         # 复习提交/今日复习
│   │   ├── stats/          # 学习统计
│   │   ├── email/          # 邮件提醒
│   │   └── notifications/  # Web Push 订阅/发送
│   ├── capture/            # OCR 录词页
│   ├── review/             # 复习页
│   ├── words/              # 词库页
│   ├── login/              # 登录/注册/找回密码
│   └── ...
├── lib/                    # 核心逻辑
│   ├── auth.ts             # JWT 签发/校验
│   ├── scheduler.ts        # 间隔复习算法
│   ├── dictionary.ts       # 词典降级链
│   ├── review-offline.ts   # 离线同步
│   ├── mailer.ts           # 邮件发送
│   ├── web-push.ts         # 推送
│   └── ...
├── store/                  # 客户端状态（zustand）
└── middleware.ts           # 请求鉴权中间件

prisma/
└── schema.prisma           # 数据模型
```

## 数据模型

- `User` — 用户账号与提醒设置
- `Word` — 生词（词条/释义/音标/例句）
- `Meaning` — 多义项
- `WordSource` — 生词来源（考试/阅读/听课/手动/其他）
- `ReviewSchedule` — 复习计划（间隔/难度系数）
- `Review` — 复习记录（幂等 `clientResultId`）
- `PushSubscription` — Web Push 订阅
- `PasswordResetCode` — 密码重置验证码

## 部署到 Vercel

1. 将项目推送到 GitHub 并导入 Vercel。
2. 在 `Settings → Environment Variables` 配置上述环境变量（至少 `DATABASE_URL`、`TURSO_AUTH_TOKEN`、`JWT_SECRET`）。
3. 构建命令与安装命令已由 `vercel.json` 配置：

```json
{
  "framework": "nextjs",
  "buildCommand": "npx prisma generate && next build",
  "installCommand": "npm install"
}
```

4. 修改环境变量后需手动 **Redeploy** 才会生效。

### 邮件提醒的定时触发

邮件提醒不会由进程内的 `setInterval` 常驻触发（在 Vercel 等 serverless 平台上该定时器会被冻结）。当前采用两层触发：

- **主触发：cron-job.org 每分钟** GET/POST 请求 `https://<你的域名>/api/email/send`，必须携带 `Authorization: Bearer <CRON_SECRET>` 请求头（生产环境未配置 CRON_SECRET 时该接口会拒绝请求）。
- **兜底触发：Vercel Cron 每天一次**（`vercel.json` 中 `0 12 * * *`，即北京时间 20:00）。Hobby 免费版只允许每天一次的 cron——**注意：更频繁的 cron 表达式会导致整个部署被 Vercel 拒绝**（历史教训：曾配置 `* * * * *` 导致连续多日无法部署）。窗口匹配 + 当日去重保证两层触发不会重复发信。

**发送语义**：用户设定的提醒时刻是「最早发送时刻」而非精确时刻。cron 只要在该时刻之后到达（当天任意时间），提醒就会发出（每天最多一封，由 `emailLastSentAt` 去重）；错过精确分钟、cron 抖动或当天恢复后都会自动补发，发送失败会在下个周期重试。

**安全基线**：生产环境启动时会校验必需环境变量（`DATABASE_URL`、`JWT_SECRET`），缺失直接报错退出，不会带病部署；`CRON_SECRET` 缺失时打印告警，且 `/api/email/send` 会拒绝调用。

本地/自托管（长期运行的 Node 进程）会自动启动进程内调度器，无需额外配置。

## 数据埋点

产品使用 Vercel Web Analytics 做漏斗分析（无 cookie，部署后无需额外配置；在 Vercel 项目面板 **Analytics** 标签页开启即可）。事件定义集中在 `src/lib/analytics.ts`，换供应商只需改这一个文件。

| 事件 | 参数 | 含义 |
|------|------|------|
| `guest_save_blocked` | `page`, `wordCount` | 游客保存被 401 拦截（注册模态弹出的时刻），漏斗关键摩擦点 |
| `auth_success` | `mode`, `source` | 注册/登录成功；`source` 区分页内模态（manual / capture_review）与登录页 |
| `word_save_success` | `page`, `count`, `convertedFromGuest` | 词条保存成功；`convertedFromGuest=true` 表示注册后自动续存的首批词（激活信号） |
| `review_session_start` | `wordCount`, `mode` | 已登录用户开始一次复习会话；`mode` 区分常规（normal）与专项攻克（stubborn） |
| `review_session_complete` | `total`, `known`, `vague`, `forgot`, `endedEarly`, `mode` | 一次复习会话结束（完成或提前结束） |
| `demo_session_complete` | — | 游客体验模式复习完成 |

**北极星指标口径**：

- **游客→注册转化率** = `auth_success(source 为 auth_modal)` / `guest_save_blocked`
- **复习完成率（按天）** = `review_session_complete(endedEarly=false)` / `review_session_start` 的会话数
- **顽固词攻克率** = 专项攻克会话（`mode=stubborn`）的 `review_session_complete` 中 known 占比
- **D7 留存**：由 Vercel 面板按访客回访估算（页面自动上报 pageview）

开发环境不发数据：事件写入 `window.__zhumoEvents` 并打印到控制台，便于本地验证参数。

## 常用脚本

```bash
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run start            # 启动生产服务器
npm run lint             # 代码检查
npm run prisma:generate  # 生成 Prisma Client
npm run prisma:push      # 同步数据库模型
```
