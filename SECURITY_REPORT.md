# 商品管理系统安全检查报告

检查日期：2026-07-18  
检查范围：`server` Express API、认证、上传、跨域和依赖

## 本次发现并处理的风险

| 项目 | 原有风险 | 已完成的加固 |
| --- | --- | --- |
| 安全响应头 | 没有统一的 HTTP 安全响应头 | 已接入 Helmet，API 使用默认拒绝资源的 CSP，并启用 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy` 等响应头；因系统在局域网 HTTP 环境运行，未强制 HSTS，避免浏览器被错误升级为 HTTPS。 |
| 服务器信息 | 可能暴露 Express 标识 | 保留并验证了 `app.disable("x-powered-by")`；响应不再包含 Express 版本标识。 |
| CORS | 允许任意私有网段地址访问，范围过宽 | 改为精确来源集合。可通过 `ALLOWED_ORIGINS` 显式指定；未设置时仅允许本机地址及启动时探测到的本机局域网 IP 的 5173/4173 端口。其他来源会收到 `403`。 |
| 请求频率 | 登录和 API 没有限制，容易被撞库或滥用 | 已添加限流：登录接口每 IP 15 分钟最多 5 次，其他 API 每 IP 15 分钟最多 300 次；返回标准限流响应头和中文提示。 |
| 登录与密码 | 需确认密码保护和 Token 校验策略 | 管理员密码使用 bcrypt（成本系数 12）散列保存、比较；登录输入增加长度限制；JWT 强制 HS256、8 小时过期、`issuer`、`audience`、`subject` 验证。 |
| JWT 使用 | 令牌验证未限制签名算法和签发范围 | 后端验证时固定 HS256，并校验签发者和受众；接口继续只接受 `Authorization: Bearer <token>`。前端将令牌放在 `sessionStorage`，关闭浏览器会话即清除。 |
| 表单和查询输入 | 个别查询与批量操作缺少上限 | 所有写操作继续使用 Zod 校验；补充了登录、商品/库存搜索、分页、批量商品操作、分类排序、价格和库存数值的长度、数量、有限值及上限校验。Prisma ORM 不使用字符串拼接 SQL。 |
| 商品图片上传 | 原先仅相信浏览器提供的 MIME 类型 | 图片限制为 JPG/JPEG、PNG、WebP，限制单文件和大小；同时校验扩展名、MIME 与文件签名，伪装图片会删除临时文件并拒绝。 |
| 导入与恢复文件 | 通用上传规则不足以区分导入和数据库备份 | CSV/XLS/XLSX 与 `.db` 备份采用独立白名单与大小限制；Excel 导入限制最多 2000 行和模板字段范围；SQLite 恢复继续校验数据库文件头。 |
| 错误处理 | 未预期异常会把内部错误消息直接返回客户端 | 未预期错误统一返回中文通用消息；Zod、CORS、数据库唯一约束和上传错误仍返回可处理的业务提示。 |

## 验证结果

- `npm run build --prefix server`：通过。
- `npm run build --prefix client`：通过。
- `npm audit --omit=dev --prefix server`：`found 0 vulnerabilities`。
- 已实测允许来源 `http://192.168.15.72:5173`：返回 `200`，并包含精确的 `Access-Control-Allow-Origin`、`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy` 响应头。
- 已实测非白名单来源 `http://evil.example`：返回 `403` 和中文拒绝信息。
- 已实测将 JSON 文件伪装为 JPG 上传：返回 `400`，提示图片内容与文件格式不匹配。
- 已实测连续失败登录：第 6 次返回 `429`，提示 15 分钟后重试。

## 部署建议与剩余注意事项

1. 局域网访问使用 HTTP，传输内容并不加密。只应在可信局域网使用；若未来开放到公网，应部署 HTTPS 反向代理，并将 `ALLOWED_ORIGINS` 固定为正式 HTTPS 域名。
2. 如需固定访问来源，在项目根目录 `.env` 中设置 `ALLOWED_ORIGINS`，用英文逗号分隔，例如：`ALLOWED_ORIGINS="http://192.168.15.72:5173,http://localhost:5173"`。局域网 IP 变化后需要同步更新该值；不设置时系统会在启动时仅放行当前电脑探测到的局域网 IP。
3. 当前 JWT 存于会话存储，适合本地单管理员系统。未来若部署 HTTPS 服务，可升级为 `HttpOnly + Secure + SameSite` Cookie，并配套 CSRF 防护。
4. SQLite 数据库和下载的备份不加密。请限制电脑账户权限、使用系统磁盘加密，并将备份保存在受控位置。
