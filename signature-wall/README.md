# 淳安三中签名展示墙

独立的 Vue 3 + Pinia + TypeScript + Electron 展示端。只读取后台审核通过且允许上墙的签名，不包含审核或管理入口。

## 本地开发

1. 先启动 `adminsystem` 服务（默认 `http://127.0.0.1:8787`）。
2. 复制 `.env.example` 为 `.env.local`，按需设置 `VITE_WALL_API_BASE`（填写后台服务源地址，不包含 `/api/wall`）。
3. 运行 `pnpm install`，再运行 `pnpm dev`；Electron 调试使用 `pnpm electron:dev`。

## 生产运行

- `pnpm build`：生成浏览器构建。
- `pnpm electron:build`：生成 Windows 安装包。
- Electron 生产模式自动隐藏菜单并使用 kiosk 全屏；浏览器版本适合联调和内网网页大屏。

展示端每 5 秒（可在后台设置中调整）轮询公开接口。断网时保留最近一次成功数据并显示低干扰提示；布局、墙面标题和分页轮换时间由后台远程控制。
