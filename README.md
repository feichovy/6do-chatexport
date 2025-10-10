## Chat-PDF-Export（Next.js + Express）

将 六度世界聊天区 指定用户在指定日期范围内的聊天记录（CSV 备份）导出为 PDF。
前端 Next.js 13/14（App Router）+ Tailwind，后端 Node.js + Express，csv-parser 读取 CSV，pdfkit 生成 PDF（内置中文字体支持）。

## ✨ 特性

输入最少：前端只填 用户名、起止日期；无需选择频道或 CSV

自动遍历 CSV：后端扫描 backend/data/ 下全部 *.csv 并合并处理

README

只按用户名 + 日期过滤：忽略频道，严格等值匹配用户名，时间闭区间筛选

强力内容清洗：按“导出目标用户”剥离内容开头的用户名前缀（支持中/英系统头、全角/半角冒号、重复前缀、…说：、裸名字直接贴正文 等变体）

相邻消息合并：同一用户在 ≤45 秒（或时间戳相同）的相邻消息合并为一条，合并处用换行拼接（窗口可在 export.js 配置）

PDF 版式对齐终端原版：仅第一页绘制表头；第 2 页起不再画表头；内容列不拼接用户名；页脚集中回填“第 N 页”

中文字体：建议放置 NotoSansSC-Regular.ttf，避免中文乱码

日期范围接口（可选）：/api/available-dates 自动给前端日期控件设定 min/max（可无）

README

前端双方案：支持 Next 反向代理（/api → 5001）或通过 NEXT_PUBLIC_API_BASE 直连后端

## 🧱 目录结构（关键文件）
chat-pdf-export-nextjs/
├─ backend/
│  ├─ src/
│  │  ├─ routes/
│  │  │  ├─ export.js          # POST /api/export/pdf  ← 忽略频道；清洗+合并
│  │  │  └─ availableDates.js  # GET  /api/available-dates（可选）
│  │  ├─ utils/
│  │  │  ├─ csvLoader.js       # 遍历/合并 CSV，基础筛选与排序
│  │  │  └─ PDFGenerator.js    # 仅首页有表头；不拼用户名；页脚回填
│  │  ├─ config.js             # 路径/环境变量
│  │  └─ server.js             # CORS/JSON/路由挂载
│  ├─ data/                    # 放置 *.csv（全部会被扫描）
│  ├─ exports/                 # 生成的 PDF
│  ├─ fonts/                   # NotoSansSC-Regular.ttf（推荐）
│  └─ .env                     # 后端环境变量
├─ frontend/
│  ├─ app/export/page.tsx      # 页面（浅灰背景 + 顶栏 + 卡片）
│  ├─ components/ExportModal.tsx # 表单（用户名 + 日期；Blob 下载）
│  ├─ next.config.js           # （可选）/api → 5001 的 rewrites 代理
│  └─ .env.local               # 前端环境变量（直连后端可配置）
└─ README.md

## 🔧 环境要求

Node.js 18+（推荐 20+）

npm / pnpm / yarn（任选其一）

CSV 放置于 backend/data/（支持多个文件，自动遍历）

## ⚙️ 环境变量

# 后端：backend/.env

PORT=5001
HOST=localhost
DATA_BASE_PATH=./data
EXPORT_BASE_PATH=./exports
UPLOAD_BASE_PATH=./uploads

# 前端（两种方式二选一或同时存在）

1. 方案 A：Next 反代（推荐开发时使用）
frontend/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:5001/api/:path*' }];
  },
};
module.exports = nextConfig;


2. 方案 B：直连后端（生产常用）
frontend/.env.local

NEXT_PUBLIC_API_BASE=http://localhost:5001

直连时后端需允许 CORS（server.js 使用 cors()）。
组件会优先读取 NEXT_PUBLIC_API_BASE，否则回退到 /api/... 由 Next 代理。


## 🚀 启动

# 后端

cd backend
npm i
npm run dev
✅ 看到：Server is running at http://localhost:5001


# 前端

cd frontend
npm i

若使用方案A，请先创建 next.config.js（见上）

npm run dev

打开 http://localhost:3000/export


## 📥 数据准备（CSV）

将所有 CSV 放到 backend/data/；会被自动遍历与合并

README

推荐字段（程序已做兼容）：

时间：created_at（或 timestamp / date）

内容：content（或 message / text / excerpt …）

用户：username（或 user / name）

频道：可有可无（已忽略）


## 1) 导出 PDF（核心）

POST /api/export/pdf

# 请求体

{
  "user": "xx",          // 必填：严格等值匹配
  "from": "2025-07-01",     // 可选：起始日期（YYYY-MM-DD）
  "to":   "2025-08-31"      // 可选：结束日期（YYYY-MM-DD）
}

# 响应

Content-Type: application/pdf

二进制 PDF 流（前端用 resp.blob() 下载）

频道参数已移除；后端会自动遍历全部 CSV 并仅按“用户名 + 日期”筛选。

README

2) 可选：可用日期

GET /api/available-dates

# 响应示例

{ "min_date": "2024-01-01", "max_date": "2025-10-09" }

用于前端设置日期 min/max（若无该接口，前端会静默忽略）。


## 🖨️ PDF 生成规则

A4、自动分页；仅第一页绘制表头，第 2 页起不再绘制表头

内容列不拼接用户名（防止“xx: …”这类冗余）

页脚：缓冲分页后统一回填“第 N 页”

中文字体：放置 NotoSansSC-Regular.ttf 到以下任意路径之一：

backend/fonts/NotoSansSC-Regular.ttf

fonts/NotoSansSC-Regular.ttf（项目根）

frontend/public/NotoSansSC-Regular.ttf

未找到时回退 Helvetica（中文会乱码）


## 🧠 清洗与合并（后端行为）

清洗基准：使用“导出目标用户名”作为剥离前缀的依据

可清洗前缀示例：

系统头：最初在六度聊天区中发送。程大厨…、Originally sent in … 程大厨 …

用户名前缀：xx: / xx： / xx 说： / 连续前缀（如 xx: xx …）

裸名字粘连正文（无冒号/空格）：xxyyyy… → 去掉 “xx”

相邻合并：同一用户、时间差 ≤ 45s（或时间戳完全一致）→ 合并为一条记录，内容以换行拼接

合并窗口与清洗规则位于 backend/src/routes/export.js，可按需要微调


## 🧪 前端使用

打开 http://localhost:3000/export，填写：

用户名（必填）

开始/结束日期（可选；默认最近 60 天）

点击“导出 PDF”，浏览器自动下载生成文件。当前 UI 为接近 Flask/Bootstrap/Discourse 的浅灰背景 + 白色卡片风格。


## 🐛 排错

# 前端 404：

你未配置 next.config.js 的 rewrites()，又没设置 NEXT_PUBLIC_API_BASE；

解决：创建 frontend/next.config.js（方案 A）或设置 .env.local（方案 B），重启前端。

# 跨域（CORS）：

直连模式下请在后端 server.js 启用 cors()（开发可放开 http://localhost:3000）。

# PDF 中文乱码/空白：

放置 NotoSansSC-Regular.ttf 至上述任意路径。

# 导出内容仍含用户名：

确认你已更新 export.js 使用目标用户名做清洗；

个别特殊前缀可按样例再补一条正则。

# 导出为空：

检查用户名是否精确匹配、日期范围是否正确；

确认 backend/data/ 下确有 CSV，且 csvLoader 能读取。


## 📦 生产部署

# 后端

cd backend
npm ci
npm run start   # = node src/server.js
# 建议配 PM2/systemd；按需配置 CORS


# 前端

cd frontend
npm ci
npm run build
npm start       # 默认 3000

直连后端：设置 NEXT_PUBLIC_API_BASE=https://your-backend.example.com

或在 next.config.js 中将 /api 反代到你的后端域名/端口


## 🙌 致谢

pdfkit / csv-parser / Next.js / Noto Sans SC