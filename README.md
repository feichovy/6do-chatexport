## Chat-PDF-Export（Next.js + Express + AI 摘要 + 爬虫集成）

本项目用于 导出 六度世界（6do.world）聊天区 的聊天记录为 PDF，并支持：

🔍 自动爬取论坛备份帖（爬虫脚本已集成 UI 调用）

✨ AI 摘要（自动/手动两种模式）

🧹 聊天记录高级清洗 + 合并算法

📄 高质量 PDF 导出（首页摘要 + 分页 + 中文字体）

🎨 Flask 风格前端 UI（Next.js + Tailwind）

## ✨ 功能特性总览
🔹 1. 自动摘要（AI / 本地降级 / 手动输入）
若用户 不输入摘要 → 自动调用 /api/digest → 使用 LLMSummarize
若用户 输入摘要 → 作为最终摘要写入 PDF
若 没有 API KEY → 自动切换到 “本地降级摘要”（简单文本摘要，不报错）

🔹 2. 一键爬虫（Crawler）
集成爬虫脚本：
# extract_chat_from_forum.py
前端点击 “启动爬虫”，输入帖子 URL，后端自动：
调用 Python 脚本爬取帖子所有楼层
自动探测最大楼层（含 2 段智能探测算法）
多线程抓取 + 补抓
清洗消息
将 CSV 写入 backend/data/
生成的 CSV 将自动被导出系统调用。

🔹 3. 聊天记录清洗与合并（后端算法）
清除重复用户名 + 冒号前缀
清理系统提示文本
去除“裸用户名紧跟正文”
相邻消息 45 秒内合并
生成最终结构化聊天记录，用于 PDF 导出。

🔹 4. PDF 导出（新版）
首页包含：
标题区域（频道 + 用户 + 日期范围）
**摘要区：根据来源使用不同标题：
手动摘要 → “摘要 / Summary”
AI 摘要 → “AI 摘要 / Digest”**
分页自动绘制页脚：第 N 页
PDF 使用：
pdfkit
NotoSansSC-Regular.ttf（中文无乱码）

## 📦 项目目录结构
chat-pdf-export-nextjs/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── export.js
│   │   │   ├── digest.js
│   │   │   └── crawl.js          ← 新增：爬虫 API
│   │   ├── utils/
│   │   │   ├── csvLoader.js
│   │   │   ├── PDFGenerator.js   ← 新版摘要标题逻辑
│   │   │   ├── digestService.js
│   │   │   └── llmClient.js
│   │   ├── scripts/
│   │   │   └── extract_chat_from_forum.py  ← 爬虫脚本
│   │   ├── config.js
│   │   └── server.js
│   ├── data/                      ← CSV 存放处（爬虫与导出共用）
│   ├── exports/
│   ├── uploads/
│   ├── fonts/
│   └── .env
└── frontend/
    ├── app/
    │   ├── export/page.tsx       ← 含爬虫弹窗按钮
    ├── components/
    │   ├── ExportModal.tsx       ← 新版摘要逻辑
    │   ├── CrawlerModal.tsx      ← 输入 URL 弹窗
    ├── .env.local
    ├── next.config.js
    ├── tailwind.config.js
    └── public/



## 🔧 环境与安装
后端（Node.js + Python）
cd backend
npm install
pip install requests beautifulsoup4 pandas


## 🔑 API 密钥指南（AI 摘要功能）

# Official OpenAI
OPENAI_API_KEY=sk-xxxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
LLM_MAX_TOKENS=1200
LLM_TEMPERATURE=0.3

# OpenRouter（示例）
OPENAI_API_KEY=sk-or-xxx
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=gpt-4o-mini

# DeepSeek（示例）
OPENAI_API_KEY=sk-deepseek-xxx
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat

# 验证方式
运行：
npm run dev

若终端出现：
[LLM] 已加载 API KEY，AI 摘要可用。

说明成功。

若：
[LLM] OPENAI_API_KEY 未配置，将使用本地降级摘要。

说明 AI 功能自动降级，不影响导出。


## 🐍 爬虫功能

# 前端触发流程
页面 /export 右上角按钮：
启动爬虫

弹窗要求输入：
https://6do.world/t/topic/xxxxx

点击开始 → 调用后端：
POST /api/crawl

后端启动 Python：
python extract_chat_from_forum.py "<URL>"

输出 CSV 到：
backend/data/<帖子标题提取的规范化名称>.csv

文件命名遵循原脚本：
优先匹配：六度世界聊天区YYYYMM
否则取标题前 20 字清洗
自动去 emoji、符号
💡 与原脚本行为完全一致。

## 🖨️ PDF 导出接口
# POST /api/export/pdf
{
  "user": "用户名",
  "from": "2025-07-01",
  "to": "2025-08-31",
  "digest": "用户输入摘要（可空）"
}

# 返回：
Content-Type: application/pdf

## 📄 PDF 结构（新版逻辑）
首页包含：
-------------------------------------
内容 | 说明
标题 | 频道 + 用户名 + 日期范围
摘要标题 | 若手动摘要 → “摘要 / Summary”；若 AI → “AI 摘要 / Digest”
摘要文本 | 来自手动输入或 AI 返回
第一页消息表头 | 仅第一页存在

从第二页起：
无表头
自动分页
页脚统一写入“第 N 页”

## 🧠 后端摘要策略（digestService.js）
-----------------------------------
情况 | 行为
用户提供摘要 | 直接返回
用户未提供摘要、且 API Key 存在 | 调用 LLM
API Key 缺失 | 使用本地降级摘要（不报错）

## 🎨 前端逻辑说明
# ExportModal.tsx
输入用户名、日期、摘要
点击「生成摘要并导出 PDF」：
1. 若摘要为空 → 请求 AI 摘要后导出
2. 若摘要不空 → 直接导出

# CrawlerModal.tsx
输入 6do.world 帖子链接
点击开始 → 请求 /api/crawl
UI 显示状态：处理中 → 成功或失败

## 🚀 生产部署指南
# 后端
cd backend
npm ci
npm run start
-------------
建议使用 pm2：
pm2 start src/server.js

# 前端
cd frontend
npm ci
npm run build
npm start
-------------
生产环境推荐设置：
NEXT_PUBLIC_API_BASE=https://your-backend-domain/api

后端需要开启 CORS 允许前端域名。

## 🐛 常见问题

# 导出为空？
用户名是否完全一致？
日期范围是否正确？
CSV 是否存放在 backend/data？

# PDF 中文乱码？
确保有字体：
backend/fonts/NotoSansSC-Regular.ttf

# 摘要功能不可用？
检查 .env：
OPENAI_API_KEY=
OPENAI_BASE_URL=

## 🙌 致谢

Next.js, Express, pdfkit, TailwindCSS, Noto Sans SC, BeautifulSoup4