// backend/src/config.js
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 以 backend 目录为基准，稳定加载 .env
const BACKEND_ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(BACKEND_ROOT, '.env') });

// 解析成绝对路径
const toAbs = (p, fallbackRel) => {
  const v = (p ?? '').toString().trim();
  const rel = v || path.join(BACKEND_ROOT, fallbackRel);
  return path.resolve(rel);
};

export const DATA_DIR = toAbs(process.env.DATA_BASE_PATH, 'data');
export const EXPORT_DIR = toAbs(process.env.EXPORT_BASE_PATH, 'exports');
export const UPLOAD_DIR = toAbs(process.env.UPLOAD_BASE_PATH, 'uploads');

export const PORT = parseInt(process.env.PORT ?? '5001', 10);
export const HOST = process.env.HOST || 'localhost';

// 确保目录存在（幂等）
[DATA_DIR, EXPORT_DIR, UPLOAD_DIR].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// 调试输出
if (process.env.NODE_ENV !== 'production') {
  console.log('📂 Backend paths:');
  console.log('  BACKEND_ROOT =', BACKEND_ROOT);
  console.log('  DATA_DIR     =', DATA_DIR);
  console.log('  EXPORT_DIR   =', EXPORT_DIR);
  console.log('  UPLOAD_DIR   =', UPLOAD_DIR);
  console.log('  ENV FILE     =', path.resolve(BACKEND_ROOT, '.env'));
}
