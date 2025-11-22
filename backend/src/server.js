// backend/src/server.js
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import availableDatesRouter from './routes/availableDates.js';
import digestRouter from './routes/digest.js';
import crawlerRouter from './routes/crawler.js';
import path from 'path';

import { PORT, EXPORT_DIR, UPLOAD_DIR, DATA_DIR } from './config.js';
import exportRouter from './routes/export.js';

const app = express();

// 中间件
app.use(cors({
  origin: 'http://localhost:3000', // dev 环境可按需修改
  credentials: true
}));
app.use(express.json());
app.use('/api/available-dates', availableDatesRouter);
app.use('/api', digestRouter);
app.use('/api/crawler', crawlerRouter);

// 确保关键目录存在
const ensureDir = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dirPath}`);
    }
  } catch (err) {
    console.error('❌ Failed to create directory', dirPath, err);
  }
};

ensureDir(EXPORT_DIR);
ensureDir(UPLOAD_DIR);
ensureDir(DATA_DIR);

// 路由
app.use('/api/export', exportRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    dataDir: DATA_DIR,
    exportDir: EXPORT_DIR
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
