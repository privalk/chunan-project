# 淳安三中展厅统一业务后台（adminsystem）

这是 `signature-system`、`signature-wall` 与 `postcard-system` 共用的统一后台，不是静态演示页面。系统使用 Vue 3 + Pinia + TypeScript 构建管理界面，后端使用 Node.js 内置 SQLite，签名与明信片成品均会持久化到磁盘。

## 功能范围

- 管理员登录、8 小时会话、登录限流与退出登录
- 管理员 / 操作员 / 审计员三级权限
- 签名接收、幂等去重、分页检索、状态筛选与详情预览
- 签名人员信息补录和修正，数据库与原始 JSON 同步更新并记录审计
- 原始轨迹 JSON、透明 PNG、高分辨率打印 PNG、JPG、SVG 与缩略图归档
- 批量 ZIP 导出、CSV 报表、归档、恢复与软删除
- 终端心跳、在线状态和最后上报时间
- 登录、导出、删除、设置及用户变更审计日志
- 自动归档、过期软删除记录清理和保留策略设置
- 终端断网时本地排队，恢复联网后自动补传
- 明信片成品、打印队列、模板上下架与自定义模板统一管理
- 明信片终端通过受控接口检索签名，不复制原始笔迹数据

## 本地运行

要求 Node.js 22.5 或更高版本。

```bash
pnpm install
pnpm run dev
```

管理后台默认地址：`http://127.0.0.1:5174`（若端口被占用，以 Vite 输出为准）。API 默认地址：`http://127.0.0.1:8787`。

生产方式：

```bash
pnpm run build
pnpm start
```

构建完成后，Node 服务会同时托管 `dist` 管理界面与 `/api` 接口，访问 `http://127.0.0.1:8787` 即可。

## 初始账号与配置

复制 `.env.example` 中的变量到运行环境，至少替换初始密码和终端 API Key：

- 初始管理员：`admin`
- 开发初始密码：`Admin@123456`
- 开发终端 Key：`dev-terminal-key-change-before-production`

首次登录后应在“用户权限”中立即修改管理员密码。生产环境还应通过 HTTPS 反向代理对外提供服务，并限制数据库目录的系统权限。

## 数据目录

默认数据写入 `data/`：

```text
data/
├─ adminsystem.sqlite
├─ signatures/
   └─ <签名编号>/
      ├─ raw.json
      ├─ signature.svg
      ├─ display.png
      ├─ display.jpg
      ├─ print.png
      └─ thumbnail.png
└─ postcards/
   └─ <明信片编号>/
      ├─ manifest.json
      ├─ postcard.png
      ├─ postcard.jpg
      └─ thumbnail.jpg
```

SQLite 已启用 WAL。升级时若检测到旧的 `signature-admin.sqlite` 会幂等迁移为 `adminsystem.sqlite`。备份时应同时备份数据库、`signatures` 与 `postcards` 目录。

## 终端接入

在 `signature-system/.env` 配置：

```env
VITE_SIGNATURE_API_BASE=http://127.0.0.1:8787/api/v1
VITE_TERMINAL_ID=Z1-01
VITE_TERMINAL_API_KEY=dev-terminal-key-change-before-production
```

每台终端应使用唯一 `VITE_TERMINAL_ID`，生产部署应为不同终端分配不同 Key。服务端目前通过环境变量设置一个通用 Key，后续若接入统一设备平台，可直接扩展 `terminals` 表为逐设备密钥。

明信片终端使用 `Z3-25` 和独立的 `POSTCARD_TERMINAL_API_KEY`，默认开发密钥仅用于本机联调。

## 校验命令

```bash
pnpm run check
pnpm run build
```

## 明信片取件地址

服务默认监听 `0.0.0.0:8787`。明信片取件二维码会自动使用物理以太网或 Wi-Fi
的局域网地址。服务器存在多张物理网卡时，可显式指定对外地址：

```env
ADMIN_PUBLIC_HOST=192.168.5.247
POSTCARD_PUBLIC_BASE_URL=http://192.168.5.247:8787
```
