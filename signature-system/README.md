# 淳安三中触摸签名终端

基于 Vue 3 + Pinia + TypeScript + Electron 的全屏签名采集前端。使用 Pointer Events 统一支持触摸、触控笔和鼠标，笔迹点采用 0～1 归一化坐标，并记录压力和相对时间。

采集流程为“选择身份信息 → 书写签名 → 预览确认”。支持匿名、在校学生、教师职工、校友和来访嘉宾；匿名模式不保存人员信息，其他身份要求填写姓名，学号/工号与班级/部门选填。

## 本地运行

```bash
pnpm install
pnpm run electron:dev
```

仅在浏览器中调试：

```bash
pnpm run dev
```

## 后台连接

复制 `.env.example` 为 `.env`，按部署环境设置：

```env
VITE_SIGNATURE_API_BASE=http://127.0.0.1:8787/api/v1
VITE_TERMINAL_ID=Z1-01
VITE_TERMINAL_API_KEY=dev-terminal-key-change-before-production
```

每台终端必须使用唯一编号。确认签名时，终端先写入 IndexedDB，再上传后台；网络异常不会阻断现场流程，待网络恢复后会自动补传。应用也会定时发送心跳，供后台判断设备在线状态。

## 数据保存

每次确认签名会保留：

- `raw.json`：归一化坐标、压力、时间与原始笔画
- `signature.svg`：可无损缩放的矢量签名
- `display.png`：1200×400 透明背景展示图
- `display.jpg`：1200×400 白底通用展示图
- `print.png`：3000×1000 白底高清打印图
- `thumbnail.png`：360×120 透明背景缩略图

在 Electron 中，上述文件还会写入应用数据目录的 `signatures/<签名编号>/`。生产构建默认启用 kiosk 全屏模式；开发构建使用普通窗口便于调试。

人员信息保存在 `raw.json` 的 `context` 字段中，并随整个签名对象进入 IndexedDB、Electron 本地文件和离线补传队列。

## 构建

```bash
pnpm run build
pnpm run electron:build
```
