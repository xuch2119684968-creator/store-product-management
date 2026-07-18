# 商品管理系统（云端正式版）

这是适合实体店个人管理的商品、库存、价格与价签系统。正式架构为单一 HTTPS Web 服务：React 前端由 Express 同域提供，Express API 使用 PostgreSQL 保存业务数据，商品图片保存到 Cloudflare R2。因此手机和电脑始终访问同一份实时数据，家里的电脑关闭不会影响使用。

## 正式架构

| 层级 | 选型 | 原因 |
| --- | --- | --- |
| 前端与 API | Render Web Service（单服务） | 自动 HTTPS、GitHub 自动部署、前端与 API 同域，避免跨域 Cookie 与 mixed content。 |
| 数据库 | Neon PostgreSQL | 标准 PostgreSQL、独立于应用重部署、支持连接池和恢复能力。 |
| 图片 | Cloudflare R2 | S3 兼容、对象持久化、重部署不会丢失图片。 |
| ORM | Prisma | 迁移、类型安全和参数化查询。 |

不使用浏览器 localStorage、JSON 或 SQLite 作为生产数据源。SQLite 只保留为本地历史数据迁移源。

## 当前安全与功能

- HTTPS 同域 HttpOnly 登录 Cookie：生产环境 `Secure`、`SameSite=Lax`、8 小时有效；退出时清除 Cookie。
- bcrypt 密码散列、JWT HS256 签名和签发者/受众校验、所有管理 API 鉴权。
- 首次默认管理员登录后强制跳到系统设置修改密码。
- Helmet、严格 CORS 白名单、登录每 15 分钟最多 5 次、API 每 15 分钟最多 300 次。
- Zod 输入校验、Prisma 参数化查询、价格 `DECIMAL(12,2)`、库存整数和库存变动事务记录。
- 图片仅限 JPG/JPEG、PNG、WebP，限制大小并校验文件签名；生产上传到 R2，删除商品时同步删除 R2 对象。
- 商品、分类、库存、查价、条形码、导入导出、价签和云端 JSON 逻辑备份/事务恢复。

详细安全说明见 `SECURITY_REPORT.md`，云端操作见 `DEPLOYMENT_GUIDE.md`。

## 现有数据保护与迁移

本次云端改造前，已复制本地 SQLite 和原 `.env` 到被 Git 忽略的 `data/backups/pre-cloud-20260718/`。原始数据库不会被迁移脚本改写。

已实测本地 SQLite 数据：1 个管理员、11 个分类、1 个供应商、30 个商品、9 条库存记录、8 项设置、总库存 608。导出脚本会生成被 Git 忽略的 JSON 快照：

```bash
npm run db:export-sqlite
```

创建 Neon PostgreSQL 后：

```bash
# .env 的 DATABASE_URL 改为 Neon 的直连 PostgreSQL URL 后执行
npm run db:generate
npm run db:migrate
npm run db:migrate-from-sqlite
npm run db:verify-migration

# 若历史 uploads 中存在图片，设置 R2_* 环境变量后执行
npm run storage:migrate-local-images
```

迁移会先复制 SQLite 到 `data/backups/pre-postgres-migration/`；目标库默认必须为空。若数量或库存汇总不一致，导入事务会回滚。不要设置 `MIGRATION_ALLOW_NON_EMPTY=true`，除非已人工确认要清空目标云数据库。

## 本地开发

需要 Node.js 22+、PostgreSQL 16+。将 `.env.example` 复制为 `.env`，填写本地 PostgreSQL 连接串和随机 `JWT_SECRET`：

```bash
cp .env.example .env
npm install
npm install --prefix server
npm install --prefix client
npm run db:generate
npm run db:migrate
npm run dev
```

前端开发地址为 `http://localhost:5173`，API 健康检查为 `http://localhost:3001/api/health`。`client/vite.config.ts` 中的 localhost 代理仅用于开发，生产不运行 Vite。

如安装 Docker Desktop，也可运行完整本地 PostgreSQL 环境：

```bash
docker compose up --build
```

然后访问 `http://localhost:3001`。停止服务：`docker compose down`；如需保留本地数据库卷，不要加 `-v`。

## 生产命令

```bash
# 生成 Prisma Client
npm run db:generate

# 构建 Vite 前端和 Express 后端
npm run build

# 对 PostgreSQL 安全应用已提交迁移
npm run db:deploy

# 启动已构建的同域正式服务（不要使用 npm run dev）
npm run start:cloud
```

Render 使用 `render.yaml`：构建时安装三个 package 的依赖、生成 Prisma Client 并构建；启动时先执行 `prisma migrate deploy`，随后启动 `server/dist/index.js`。健康检查为 `/api/health`，会验证数据库连接。

## 环境变量

完整模板在 `.env.example`。生产环境至少必须设置：

| 变量 | 用途 |
| --- | --- |
| `NODE_ENV=production` | 开启生产安全策略和静态前端服务。 |
| `PORT` | 平台注入的端口；Render 使用 `10000`。 |
| `DATABASE_URL` | Neon PostgreSQL URL，生产必须以 `postgresql://` 开头。 |
| `FRONTEND_URL` | Render 的 HTTPS 正式网址。 |
| `API_BASE_URL` | 同域时填同一个 HTTPS 正式网址。 |
| `ALLOWED_ORIGINS` | 逗号分隔的允许来源，至少包含正式前端 HTTPS 地址。 |
| `JWT_SECRET` | 至少 32 位随机密钥，绝不提交 GitHub。 |
| `R2_ENDPOINT`、`R2_BUCKET`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_PUBLIC_URL` | Cloudflare R2 的限定桶读写凭据与 HTTPS 图片公开地址。 |

`.env`、SQLite、备份、导出和 uploads 均被 `.gitignore` 排除，提交前可用 `git status --ignored` 再次确认。

## 数据备份与恢复

- 商品与库存记录可在“数据导入导出”页面导出 Excel。
- “系统设置 → 云端数据备份与恢复”下载完整 JSON 逻辑备份，包含管理员哈希、分类、供应商、商品、库存记录和设置。
- 恢复必须在页面二次确认；后端再次要求确认头，先校验关系后在单一 PostgreSQL 事务中恢复。任意一步失败都会回滚，不会留下半份数据。
- Neon 提供数据库侧恢复能力；数据库大规模恢复或灾难恢复时，应先在 Neon 创建分支/恢复点验证，再替换生产连接。

## 部署与更新

完整的逐步账号授权、Neon、R2、GitHub、Render、日志、域名和故障处理说明，请按 `DEPLOYMENT_GUIDE.md` 执行。部署成功后，后续只需推送到已连接分支，Render 会自动构建、迁移和部署。
