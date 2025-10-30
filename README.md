## Chat-PDF-Export（Next.js + Express）

将 六度世界聊天区 指定用户在指定日期范围内的聊天记录（CSV 备份）导出为 PDF。
前端 Next.js 13/14（App Router）+ Tailwind，后端 Node.js + Express + csv-parser + pdfkit。

✅ 当前版本：前端仅输入用户名与日期范围；后端会自动遍历所有 CSV（均视为“六度世界聊天区”）、忽略频道，并做内容前缀清洗 + 相邻消息合并后导出 PDF。

## ✨ 功能特性

最小输入：只填用户名 & 起止日期；无需选择频道/CSV

自动遍历 CSV：读取 backend/data/*.csv 并合并处理

只按用户名 + 日期过滤：严格等值匹配用户名，日期为闭区间

强力清洗（以“导出目标用户名”为基准）：系统头/冒号前缀/“说：”/重复前缀/“裸名字紧跟正文”全部剥离

相邻合并：同一用户、时间差 ≤ 45s（或时间戳相同）→ 合并成一条（换行拼接）

PDF 版式对齐终端原版：仅第一页有表头；第 2 页起不再绘制表头；内容列不拼接用户名；页脚统一回填“第 N 页”

中文字体：支持 NotoSansSC-Regular.ttf，避免中文乱码

前端 UI：Flask/Bootstrap 风格模态弹窗（蒙层、圆角卡片、右上角关闭、底部按钮区）

前端请求双模式：

方案 A（推荐开发）：Next rewrites() 把 /api/* 代理到后端

方案 B（常用生产）：设置 NEXT_PUBLIC_API_BASE 直连后端（组件自动优先直连）

## 🧱 目录结构（关键文件）
chat-pdf-export-nextjs/
├─ backend/
│  ├─ src/
│  │  ├─ routes/
│  │  │  ├─ export.js            # POST /api/export/pdf（忽略频道；清洗+合并）
│  │  │  └─ availableDates.js    # GET  /api/available-dates（可选）
│  │  ├─ utils/
│  │  │  ├─ csvLoader.js         # 遍历/合并 CSV；基础筛选与排序
│  │  │  └─ PDFGenerator.js      # 仅首页有表头；不拼用户名；页脚回填
│  │  ├─ config.js               # 路径/环境变量
│  │  └─ server.js               # CORS/JSON/路由挂载
│  ├─ data/                      # *.csv（全部自动扫描）
│  ├─ exports/                   # 生成的 PDF
│  ├─ fonts/                     # NotoSansSC-Regular.ttf（推荐）
│  └─ .env                       # 后端环境变量
└─ frontend/
   ├─ app/
   │  ├─ export/page.tsx         # 蒙层+弹窗壳（Flask 风）
   │  ├─ globals.css             # Tailwind 指令 + 轻量全局皮肤（必须被 layout.tsx 引入）
   │  └─ layout.tsx              # 全局布局（import "./globals.css"）
   ├─ components/ExportModal.tsx # 纯表单组件（用户名+日期；Blob 下载）
   ├─ next.config.js             # rewrites：/api → http://localhost:5001/api（方案A）
   ├─ tailwind.config.js         # Tailwind 扫描路径（app/components/pages）
   ├─ postcss.config.js
   └─ .env.local                 # NEXT_PUBLIC_API_BASE（方案B，直连后端）


## 🔧 环境要求

Node.js 18+（推荐 20+）

npm / pnpm / yarn（任选其一）


## ⚙️ 一键安装与启动

# 1）后端
cd backend
npm i

建议设置环境变量 backend/.env

PORT=5001
HOST=localhost

DATA_BASE_PATH=./data
EXPORT_BASE_PATH=./exports
UPLOAD_BASE_PATH=./uploads

# 若使用官方 OpenAI：
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=o3-mini
LLM_MAX_TOKENS=1200
LLM_TEMPERATURE=0.3

npm run dev
# ✅ Server is running at http://localhost:5001

# 数据准备：把所有 CSV 放到 backend/data/；字段推荐 created_at / content / username（别名也兼容）。

# 2）前端
cd ../frontend
npm i

# 推荐开发
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_APP_NAME=六度世界聊天记录导出
NEXT_PUBLIC_ENV=development

# 推荐生产
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_APP_NAME=六度世界聊天记录导出
NEXT_PUBLIC_ENV=production

如首次集成 Tailwind（已配置过可跳过）

npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

npm run dev
# 打开 http://localhost:3000/export


## 前端请求配置（A/B 双模式并存）

# 方案 A：Next 反向代理（开发稳妥）
frontend/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:5001/api/:path*' }];
  },
};
module.exports = nextConfig;

前端直接请求 /api/export/pdf 即可，无需关心后端端口或 CORS。


# 方案 B：直连后端（生产常用）
frontend/.env.local

NEXT_PUBLIC_API_BASE=http://localhost:5001

组件会读取 NEXT_PUBLIC_API_BASE 并请求 ${API_BASE}/api/export/pdf。

直连需要在后端启用 CORS（server.js：app.use(cors()) 或限制到你的前端域名）。

自动择优：若设置了 NEXT_PUBLIC_API_BASE → 直连；否则走 /api 反代。


## Tailwind 生效链路（前端必须）

1. frontend/app/globals.css 包含：

@tailwind base;
@tailwind components;
@tailwind utilities;

html, body { @apply bg-slate-200 text-slate-800; }


2. frontend/app/layout.tsx 必须：

import "./globals.css";


3. frontend/tailwind.config.js 包含扫描路径：

module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}",
            "./components/**/*.{js,ts,jsx,tsx,mdx}",
            "./pages/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: {} }, plugins: [],
};


4. frontend/postcss.config.js：

module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };

# 以上任一步缺失，页面会像“纯 HTML”没有样式。修改配置后重启前端服务。


## 🔑 API 密钥配置指南

该系统默认支持 OpenAI 与兼容 API（如 DeepSeek、OpenRouter 等）。若需要启用 AI 自动摘要功能，需正确配置 Key。

1. OpenAI 官方接口

在 backend/.env 文件中填写：
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

2. 使用代理或第三方接口（可选）

若使用国内代理（如 OpenRouter、DeepSeek），可改写如下：
# 示例：OpenRouter
OPENAI_API_KEY=sk-or-xxxxxxxxxxxxxxxx
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=gpt-4o-mini

# 示例：DeepSeek
OPENAI_API_KEY=sk-deepseek-xxxxxxxxx
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat

3. 验证配置

重新启动后端：
npm run dev

终端若输出：
✅ Server is running at http://localhost:5001
[LLM] 已加载 OpenAI API Key，启用摘要生成功能。

表示配置成功。

若 Key 留空，则自动启用 本地降级摘要模式，不会报错。


## 🧩 接口

# 导出 PDF（核心）

POST /api/export/pdf

# 请求体

{
  "user": "xx",          // 必填：严格等值匹配
  "from": "2025-07-01",     // 可选：起始日期（YYYY-MM-DD）
  "to":   "2025-08-31"      // 可选：结束日期（YYYY-MM-DD）
}


响应：application/pdf 二进制流（前端使用 resp.blob() 下载）。

# 频道已忽略；后端自动遍历全部 CSV 并仅按“用户名 + 日期”筛选。


# 可用日期（可选）

GET /api/available-dates


# 响应示例

{ "min_date": "2024-01-01", "max_date": "2025-10-09" }

前端日期控件会用作 min/max；没有该接口也不影响导出。


## 🖨️ PDF 版式与字体

A4、自动分页

仅第一页绘制表头；第 2 页起不再绘制表头

内容列不拼接用户名（避免“程大厨: …”冗余）

页脚：缓冲分页后统一回填“第 N 页”

中文字体：把 NotoSansSC-Regular.ttf 放到任一位置即可：

backend/fonts/NotoSansSC-Regular.ttf

fonts/NotoSansSC-Regular.ttf（项目根）

frontend/public/NotoSansSC-Regular.ttf
未找到时回退 Helvetica（中文可能乱码）。


## 🧠 清洗与合并（后端行为）

清洗基准：使用“导出目标用户名”（而非行内 username）

清洗规则（节选）：

系统头：最初在六度聊天区中发送。{user}、Originally sent in … {user}

用户名前缀：{user}: / {user}： / {user} 说： / 重复前缀（{user}: {user}: …）

裸名字连正文：^{user}(?=[常见文字/标点/空白])

相邻合并：同一用户、时间差 ≤ 45s（或时间戳一致）→ 合并为一条，内容用换行拼接

以上参数/正则位于 backend/src/routes/export.js，可按需调整。

## 🧠 摘要功能（AI 自动 / 手动输入）

前端 ExportModal.tsx 现在支持两种摘要模式：

手动输入摘要：用户在文本框填写内容后点击「生成摘要并导出 PDF」，该文本将直接写入 PDF 首页。

自动摘要（AI）：若摘要框为空，则自动调用后端 /api/digest 生成摘要。

导出结果：

手动摘要 → PDF 首页标题为「摘要 / Summary」；

AI 生成摘要 → PDF 首页标题为「AI 摘要 / Digest」。


## 使用

1. 打开 http://localhost:3000/export

2. 填写 用户名（必填）、开始/结束日期（可空；默认最近 60 天）

3. 点击 导出 PDF，浏览器自动下载文件

# 当前 UI 为 Flask/Bootstrap 风的模态弹窗（蒙层、圆角卡片、右上角关闭、底部按钮区）。


## 🐛 排错指南

# 前端像“纯 HTML”没样式

globals.css 是否含三条 @tailwind 指令？

layout.tsx 是否 import "./globals.css"？

tailwind.config.js 的 content 是否覆盖 app/components/pages？

已修改配置但没重启 npm run dev？

# 导出 404

没配置 next.config.js 的 rewrites() 且未设置 NEXT_PUBLIC_API_BASE。

解法：配反代（A）或设直连（B），组件已兼容两者。

# 跨域（CORS）错误

只在直连（B）出现：后端需 app.use(cors()) 或限制到前端域名。

# PDF 中文乱码 / 空白

确保 NotoSansSC-Regular.ttf 位于上述任一路径。

# 内容仍带用户名

确认已用“目标用户名”做清洗；若有特殊变体，把样例加入清洗正则即可。

# 导出为空

用户名是否精确匹配？日期范围是否正确？backend/data/ 是否存在 CSV？


## 🚀 生产部署

# 后端

cd backend
npm ci
npm run start         # 或 pm2 守护

# 前端

cd frontend
npm ci
npm run build
npm start             # 默认 3000

生产直连：设置 NEXT_PUBLIC_API_BASE=https://your-backend.example.com 并在后端允许 CORS

或在 next.config.js 写生产反代，将 /api 指到后端域名/端口


## 🙌 致谢

pdfkit / csv-parser / Next.js / Noto Sans SC