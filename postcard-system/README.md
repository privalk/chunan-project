# 淳安三中校友明信片制作系统

面向展厅出口触摸终端的本地优先应用。访客可以检索入口签名、现场拍照或选择照片、编辑文字、切换 10 套年代模板并生成 PNG、JPG、PDF，随后加入打印队列或扫码领取。

## 运行

```powershell
pnpm install
pnpm dev
pnpm electron:dev
```

浏览器开发地址为 `http://127.0.0.1:5176`。Electron 生产包默认 kiosk 全屏运行；`Ctrl + Shift + O` 打开独立本机运维窗口。

复制 `.env.example` 为 `.env.local` 后配置：

- `VITE_SIGNATURE_API_BASE`：签名后台 `/api/v1` 地址
- `VITE_POSTCARD_TERMINAL_ID` / `VITE_POSTCARD_TERMINAL_KEY`：终端认证
- `VITE_PICKUP_BASE_URL`：浏览器调试时的扫码取件地址
- `POSTCARD_PICKUP_BASE_URL`：Electron 运行时对手机可访问的局域网地址，例如 `http://192.168.1.50:8790/download`

## 本地数据

浏览器模式将明信片和打印队列保存在 IndexedDB `chunan-postcard-terminal`。Electron 成品位于应用 `userData/postcards/<明信片编号>`，每份包含结构化 `manifest.json`、PNG、JPG、PDF 和缩略图。运维页可配置会话、留存及打印限制。

## 与签名后台对接

项目使用 `adminsystem` 提供的终端认证接口：

- `GET /api/v1/postcard/signatures?keyword=...`
- `GET /api/v1/postcard/signatures/:id/display`
- `GET /api/v1/postcard/config`
- `POST /api/v1/postcards`
- `PATCH /api/v1/postcard/print-jobs/:id`

接口只为已登记的明信片终端返回检索结果与展示图片，不返回原始笔迹 JSON。模板、档案、打印任务和留存策略均在 `adminsystem` 统一管理；`Ctrl + Shift + O` 打开的页面仅用于本机设备故障处置。
