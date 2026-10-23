# Techland 共创墙

## 赞助申请与广告投放

公开申请入口：https://techland-community-wall.peter-7dc.workers.dev/sponsor/ 。页面可直接分享给合作伙伴，不需要先加载 3D 车库。`npm run deploy` 会先同步申请页面与共享样式，再发布 Worker。车库前端的更新仍需随 GitHub Pages 站点发布。

运营台 `/admin` 新增「赞助申请」入口，与共创墙共用原审核密钥。申请人从车库「赞助伙伴」进入，选择类别、轮播页、档期并提交 Logo。后台可待审、批准、暂停或拒绝；核心赞助必须人工确认收款，硬件和社区必须确认资源合作，批准后按档期展示。

三页核心价格分别为 ¥100/¥1000、¥80/¥800、¥50/¥500（月/年）。金额由服务端计算，以整数分保存；客户提交的金额、付款和批准状态均不能影响上架。所有日期按北京时间处理，开始日零时生效，月/年到期零时停止；项目/活动的最后投放日含当天。管理员保存时检查版本，数据库阻止同类别同页档期重叠。

接口：`GET /api/sponsors/plans` 方案、`POST /api/sponsors/applications` 申请、`POST /api/sponsors/receipts` 私有进度、`GET /api/sponsors` 当前公开广告、`GET /api/sponsors/logos/:id` 当前有效 Logo。管理端使用 `GET /api/admin/sponsors?status=pending`、`PATCH /api/admin/sponsors/:id` 和私有 Logo 预览。审批记录保存在 `sponsor_audit`。本版不包含微信支付或任何实际扣款接口。

车库背面的相机按钮打开三类共创内容：照片墙、留言墙、许愿墙。全家福是站点静态资源，只由墙主管理；访客作品独立保存。

## 已实现的机制

- 照片：相机拍摄或选图 → 本地预览 → 明确同意分享 → 提交。客户端缩小到最长边 1280 px 并重新编码为 JPEG；服务器再次剥离 EXIF / GPS / IPTC 等元数据。关闭界面、切换类型或切到后台时停止摄像头。不会请求麦克风。
- 文字：最多 160 字，署名可选，留言为暖黄纸，愿望为薄荷绿纸。
- 审核：所有投稿默认 `pending`，只有 `approved` 出现在公开列表。未通过照片不能直接读取。本人可看到待审核预览，并凭当前浏览器保存的随机回执撤下自己的作品。刷新墙面会同步审核结果。
- 许愿：墙主可以标记 `open`、`making`、`fulfilled`，分别是愿望已种下、正在实现、愿望已实现。
- 限制：每个经过加盐散列的来源地址每小时最多 5 次提交；单张 JPEG 上限 1.5 MB，待审核队列最多 1000 份。来源原始 IP 不写入数据库。匿名投稿不能仅靠 CORS 阻挡机器人；大规模公开推广前可再加入 Turnstile。
- 保留：未审核、未通过、已撤下的服务器记录 30 天后清理；已通过内容保留，墙主可撤销公开。访客浏览器内的副本由访客自行撤下或清除浏览器数据。
- 本机体验：没有配置远端时，使用 IndexedDB，明确显示“仅本机可见”；本机内容不会自动上传。

## 结构

- `src/worker.js`：Cloudflare Worker，D1 记录、私有 R2 照片、公开接口与审核接口。
- `src/admin.js`：同源 `/admin` 审核台。审核密钥仅保存在当前页面内存，刷新/退出清除。
- `migrations/0001_wall.sql`：数据库结构。
- `../../static/maker-garage-preview/community/config.json`：前端连接地址，不包含密钥。
- `../../static/maker-garage-preview/community-wall.js`：访客界面。
- `../../static/maker-garage-preview/community-installation.js`：3D 实体挂轨、夹子、相纸、相机入口。

## 本地验证

在此目录执行：

```sh
npm ci
npm test
npx wrangler d1 migrations apply techland-community-wall --local
```

创建被 Git 忽略的 `.dev.vars`，使用仅供本地测试的 `ADMIN_TOKEN`、`RATE_SALT`，并将 `ALLOWED_ORIGINS` 设置为本地页面的 origin。运行 `npm run dev`，默认接口 `http://127.0.0.1:8787/api/`，审核台 `http://127.0.0.1:8787/admin`。

只在测试期间把前端 `mode` 设为 `shared`，`apiBase` 设为上述本地接口。不要将 localhost API 地址部署到公开网站。

## 接入实际账号

1. 在已登录的账号创建独立 D1 数据库 `techland-community-wall` 和私有 R2 bucket `techland-community-photos`。R2 保持私有，不启用公共 bucket URL。如账号要求开通付费服务，由账号所有者完成。
2. 将返回的数据库 ID 填入 `wrangler.jsonc`。`ALLOWED_ORIGINS` 填入真实网站来源；不要用通配符。
3. 通过 Wrangler secret 分别设置随机 `ADMIN_TOKEN` 和随机 `RATE_SALT`，不要写进 `vars`、前端或 Git。审核密钥交由墙主妥善保存。
4. `npx wrangler d1 migrations apply techland-community-wall --remote`，然后 `npm run deploy`。
5. 前端 `community/config.json` 设置 `mode: "shared"` 和实际的 `https://<worker>/api/`，验证待审核内容不可公开读取，再构建站点。
6. 在 `https://<worker>/admin` 使用审核密钥连接。先审核一份测试内容，再将它撤下。

当前登录、数据库创建、付费开通和网站部署状态以本次交付说明为准；配置文件本身不表示已经上线。

2026-10-23 已部署：独立 D1 数据库、私有 R2 照片桶、每日清理任务和审核 Worker 均已接通。API 为 `https://techland-community-wall.peter-7dc.workers.dev/api/`，审核台为 `https://techland-community-wall.peter-7dc.workers.dev/admin`。前端配置已切换共享模式。公开 GitHub Pages 需随站点发布此次前端文件后才会包含新功能。

已用临时合成图片验证真实云端「提交待审核 → 照片不可公开读取 → 管理员审核 → 公开可读 → 作者撤下 → 照片不可读」，测试图片已撤下。审核密钥交付文件保存在本机被 Git 忽略的 `.wrangler/admin-access.txt`；请妥善保存，不上传到网站或仓库。生产密钥不使用本地开发的 `.dev.vars` 测试值。

## API

| 路由 | 用途 |
| --- | --- |
| `GET /api/entries` | 最新 120 份已审核作品 |
| `POST /api/entries` | multipart 投稿；客户端 UUID + 随机回执支持幂等重试 |
| `POST /api/receipts` | 凭私有回执查询自己的审核状态 |
| `GET /api/photos/:id` | 只读取已审核 JPEG |
| `DELETE /api/entries/:id` | Bearer 回执撤下本人的作品 |
| `GET /api/admin/entries?status=pending` | 墙主审核列表 |
| `GET /api/admin/photos/:id` | 墙主查看未公开照片 |
| `PATCH /api/admin/entries/:id` | 墙主审核／修改愿望进度 |

测试覆盖 SQLite 数据读写、私有照片隔离、审核、撤下、投稿限制、输入校验、幂等、元数据剥离与保留策略；本地浏览器另外验证了照片、文字、愿望、刷新保留和真实审核界面。

API 依据：[Cloudflare D1](https://developers.cloudflare.com/d1/worker-api/)、[R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)、[浏览器相机权限](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)。相机实拍仍需访客本人授权设备，不会为自动化验收擅自开启用户摄像头。
