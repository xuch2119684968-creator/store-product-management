# 云端部署操作清单

本项目选择 Render + Neon + Cloudflare R2：Render 的付费 Starter Web Service 保持常驻并提供自动 TLS；Neon 保存 PostgreSQL；R2 保存商品图片。前端和 API 同一 Render URL，手机使用任何网络均只需打开这个 HTTPS URL。

## 0. 部署前检查

已完成的本地保护：

- SQLite 原库和原环境变量副本：`data/backups/pre-cloud-20260718/`（Git 忽略）。
- SQLite JSON 导出：运行 `npm run db:export-sqlite`。
- 迁移核对基线：商品 30、库存总数 608、分类 11、库存记录 9。
- 本地 Git 已初始化；尚未创建提交或远程仓库。

不要公开、截图或提交以下内容：Neon `DATABASE_URL`、`JWT_SECRET`、R2 Secret Access Key、`.env`、备份 JSON/SQLite。

## 1. 创建 Neon PostgreSQL（需要你登录）

1. 打开 [Neon](https://console.neon.tech/)，注册或登录。
2. 点击 **New Project**，名称填写 `store-product-management`，区域选离你店铺较近的区域。
3. 创建后点击项目页的 **Connect**，选择 **Direct connection**（迁移用），复制以 `postgresql://` 开头、含 `sslmode=require` 的连接串。
4. 连接串只粘贴到本地 `.env` 的 `DATABASE_URL`，不要发到聊天、不要贴到 GitHub。
5. 在终端执行：

```bash
npm run db:generate
npm run db:migrate
npm run db:migrate-from-sqlite
npm run db:verify-migration
```

最后一条必须显示 `matched: true`，并显示商品 30、总库存 608。若不一致，停止部署，不要继续；SQLite 原库仍完整保留。

## 2. 创建 Cloudflare R2（需要你登录）

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/)，注册或登录。
2. 左侧进入 **Storage & databases → R2 → Overview**，点击 **Create bucket**。
3. 桶名填写 `store-product-images`（必须全局唯一；若已占用可加你的昵称后缀），点击 **Create bucket**。
4. 在该桶 **Settings → Public access** 中启用公开访问。没有自有域名时，记录 Cloudflare 给出的 `https://...r2.dev` 地址；这就是 `R2_PUBLIC_URL`。有域名后可在 **Custom Domains → Connect Domain** 绑定 `images.你的域名.com`。
5. 回到 R2 Overview，点击 **Manage in API Tokens → Create Account API Token**。权限选 **Object Read & Write**，范围选 **Apply to specific buckets only** 并仅选择刚创建的桶。点击 **Create API Token**。
6. 立即保存页面显示的 Access Key ID、Secret Access Key 和 S3 API Endpoint；Secret 之后不能再次查看。
7. 写入本地 `.env` 的 `R2_ENDPOINT`、`R2_BUCKET`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_PUBLIC_URL`。
8. 如历史 `uploads/` 有图片，执行 `npm run storage:migrate-local-images`。当前项目检查时没有历史商品图片，脚本会显示 `found: 0`。

不要在浏览器直接上传到 R2；本系统由后端校验图片签名后上传，R2 密钥永远不会下发到手机浏览器。

## 3. 创建 GitHub 私有仓库（需要你登录）

1. 打开 [GitHub](https://github.com/new)，Repository name 填 `store-product-management`。
2. 选择 **Private**，不要勾选 README、.gitignore 或 License（本地已经有）。点击 **Create repository**。
3. 回到项目终端，先检查：`git status --ignored`。确认列表中没有 `.env`、`prisma/store.db`、`data/backups`、`data/exports`。
4. 再执行下面命令。将尖括号内容替换为你的 GitHub 用户名和仓库名：

```bash
git add .
git status
git commit -m "feat: prepare cloud production deployment"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<你的仓库名>.git
git push -u origin main
```

GitHub 可能要求你使用浏览器或 Personal Access Token 授权；这是你本人需要完成的安全步骤。不要把 Token 写进项目文件。

## 4. 创建 Render 常驻 HTTPS 服务（需要你登录）

1. 打开 [Render Dashboard](https://dashboard.render.com/)，使用 GitHub 登录或在 **Account Settings → GitHub** 连接 GitHub。
2. 点击 **New + → Blueprint**，选择刚创建的私有仓库和 `main` 分支。Render 会读取根目录 `render.yaml`。
3. 服务名可填写 `store-product-management-你的昵称`。选择离你较近的区域；计划选择 **Starter**，不要使用 Free（Free 会闲置休眠，不适合店内实时查询）。
4. 创建完成后，先记下 Render 分配的网址，例如 `https://store-product-management-xxx.onrender.com`。
5. 打开该服务的 **Environment**，逐项填入：

| Render 环境变量 | 填写内容 |
| --- | --- |
| `DATABASE_URL` | Neon 的 **Direct connection** URL。 |
| `FRONTEND_URL` | Render 分配的完整 `https://...onrender.com` 地址。 |
| `API_BASE_URL` | 与 `FRONTEND_URL` 相同。 |
| `ALLOWED_ORIGINS` | 与 `FRONTEND_URL` 相同；若有自有域名后再加逗号和新域名。 |
| `R2_ENDPOINT` | Cloudflare 给出的 S3 API Endpoint。 |
| `R2_BUCKET` | `store-product-images` 或你实际创建的桶名。 |
| `R2_ACCESS_KEY_ID` | R2 Access Key ID。 |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Access Key。 |
| `R2_PUBLIC_URL` | R2 的 `https://...r2.dev` 或已绑定的 `https://images.你的域名.com`。 |
| `JWT_SECRET` | Blueprint 自动生成；如需手动设置，用 `openssl rand -base64 48` 生成。 |

不要修改 `NODE_ENV=production` 和 `PORT=10000`。保存后点击 **Manual Deploy → Deploy latest commit**。

6. 打开 **Events/Logs**，应依次看到依赖安装、Prisma Client 生成、前后端构建、`prisma migrate deploy` 和“商品管理服务已启动”。Render 会调用 `/api/health`；成功后显示 **Live**。
7. 用手机的移动网络（关闭 Wi‑Fi）打开 Render HTTPS URL。浏览器地址栏应显示锁图标，不应显示“不安全”。

## 5. 首次正式登录和验收

1. 使用初始管理员 `admin` / `admin123` 登录一次。
2. 系统会跳到“系统设置”。填写当前密码 `admin123` 和一个至少 6 位的新密码，保存后重新登录。
3. 验证：新增商品、修改价格、入库、出库、条形码查价、分类、新增图片、Excel 导出、云端 JSON 备份和恢复确认提示。
4. 在 Render **Manual Deploy → Deploy latest commit** 重新部署一次，确认商品与库存仍存在；上传的图片仍能显示。这证明 PostgreSQL 与 R2 不依赖 Render 临时磁盘。

## 更新、日志和故障处理

- 日常更新：`git add . && git commit -m "说明" && git push`。Render 检测到 `main` 新提交后自动部署。
- 查看服务日志：Render 服务页点击 **Logs**；日志只记录方法、路径、状态和耗时，不记录密码、Cookie、Token 或数据库连接串。
- 健康检查：打开 `https://你的正式网址/api/health`，应返回 `status: ok` 与 `database: ok`。
- 构建失败：先查看 Render **Events** 中第一条失败命令；本地运行 `npm run db:generate && npm run build`。数据库迁移失败时核对 `DATABASE_URL` 是否为 Neon Direct URL，确认目标库为空，再重新部署。
- 图片上传失败：核对所有 `R2_*` 变量、R2 Token 是否仅限正确桶且有 Object Read & Write 权限、`R2_PUBLIC_URL` 是否为 HTTPS。
- CORS 403：核对 `FRONTEND_URL` 和 `ALLOWED_ORIGINS` 是否等于浏览器实际 HTTPS 地址（不带末尾 `/`）。

## 自有域名

购买域名后，在 Render 服务 **Settings → Custom Domains → Add Custom Domain** 填 `shop.你的域名.com`。按 Render 页面提示在域名 DNS 添加 CNAME；验证完成后 Render 自动签发 HTTPS。随后将 Render 环境变量 `FRONTEND_URL`、`API_BASE_URL`、`ALLOWED_ORIGINS` 改为新 HTTPS 域名并重新部署。

图片可单独在 Cloudflare R2 桶 **Settings → Custom Domains** 绑定 `images.你的域名.com`，验证后把 `R2_PUBLIC_URL` 改为该地址。

## 费用预估（2026-07）

- Render Starter 常驻 Web Service：约 **US$7/月**；使用 Free 会在 15 分钟闲置后休眠，不适合本系统。
- Neon Free：当前含 0.5 GB 数据、100 CU-hours/月，适合小型间歇访问；超出或需要更高恢复保留时间再升级，典型 Launch 用量约 US$15/月。
- Cloudflare R2：小量商品图片通常在免费额度内；按实际对象存储和操作量计费，R2 出站流量不收费。
- 因此小型个人店常见起步为约 **US$7/月**，以 Render、Neon、Cloudflare 控制台账单为准；平台定价可能变化。
