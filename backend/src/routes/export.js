// backend/src/routes/export.js
import express from "express";
import fs from "fs";
import path from "path";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import customParse from "dayjs/plugin/customParseFormat.js";

import { generatePDF } from "../utils/PDFGenerator.js";
import { loadChatRecords } from "../utils/csvLoader.js";
import { EXPORT_DIR as EXPORT_DIR_FROM_CFG } from "../config.js";

dayjs.extend(utc);
dayjs.extend(customParse);

const router = express.Router();

// ------------ 配置（合并/清洗策略）------------
const MERGE_WINDOW_SECONDS = 45;          // 同一用户、相邻消息≤45秒合并
const MERGE_IF_SAME_TIMESTAMP = true;     // 时间戳完全相同必合并

// 若 config.js 未导出 EXPORT_DIR，则退回默认目录
const EXPORT_DIR =
  EXPORT_DIR_FROM_CFG ||
  path.join(process.cwd(), "backend", "exports");

// ------------ 小工具 ------------
const trim = (v) => (v ?? "").toString().trim();
const toUTCLabel = (d) => {
  const x = dayjs.utc(d);
  return x.isValid() ? `${x.format("YYYY-MM-DD HH:mm:ss")} UTC` : "";
};

// 只按“用户名 + 时间”过滤（忽略频道）
function filterByUserAndTime(rows, { user, from, to }) {
  const wantUser = trim(user);
  const fromD = from ? dayjs.utc(`${from} 00:00:00`, "YYYY-MM-DD HH:mm:ss", true) : null;
  const toD = to ? dayjs.utc(`${to} 23:59:59`, "YYYY-MM-DD HH:mm:ss", true) : null;

  return rows.filter(r => {
    const nameOk = wantUser ? trim(r.username) === wantUser : true;
    const d = r.created_at ? dayjs.utc(r.created_at) : null;
    return nameOk && d?.isValid() && (!fromD || !d.isBefore(fromD)) && (!toD || !d.isAfter(toD));
  });
}

// ✅ 用“导出目标用户名”做前缀清理（无论行内 username 如何，都按目标用户剥前缀）
function stripUserPrefixByTarget(text, targetUser) {
  // 先去掉常见零宽字符（避免“看不到的冒号/空格”干扰规则）
  let t = (text ?? "")
    .toString()
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .trim();

  const un = (targetUser ?? "").toString().trim();
  if (!un || !t) return t;

  const esc = un.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // 1) 系统前缀（中/英）
  t = t.replace(new RegExp(`^最初在六度聊天区中发送。\\s*${esc}\\s*`, "u"), "");
  t = t.replace(new RegExp(`^Originally\\s+sent\\s+in\\s*[^\\s]+\\s*${esc}\\s*`, "iu"), "");

  // 2) 连续的 “用户名 + 冒号/空格”（例：程大厨: 程大厨： …）
  t = t.replace(new RegExp(`^(?:\\s*${esc}\\s*[：: ]\\s*)+`, "u"), "");

  // 3) “用户名 说：”
  t = t.replace(new RegExp(`^${esc}\\s*说\\s*[：:]\\s*`, "u"), "");

  // 4) ✅ 裸名字紧跟正文（无冒号/空格）
  //    例如：“程大厨以后叫我大儒，别叫大厨”“程大厨我看行…”
  t = t.replace(
    new RegExp(
      `^${esc}(?=[\\u4e00-\\u9fffA-Za-z0-9“”"‘’()（）\\[\\]{}【】\\-—_…,.!！?？；;：:、\\s])`,
      "u"
    ),
    ""
  );

  // 5) 兜底：开头“用户名 ”（有空格但没冒号）
  t = t.replace(new RegExp(`^${esc}\\s+`, "u"), "");

  return t.trim();
}

// 相邻合并（同用户且时间很近/相同 → 合并为一条，用换行拼接）
function mergeAdjacent(list) {
  if (list.length <= 1) return list;
  const out = [];
  let buf = { ...list[0] }; // { username, content, created_at(UTC) }

  for (let i = 1; i < list.length; i++) {
    const cur = list[i];
    const sameUser = trim(buf.username) === trim(cur.username);
    const a = dayjs.utc(buf.created_at);
    const b = dayjs.utc(cur.created_at);
    const close = Math.abs(b.diff(a, "second")) <= MERGE_WINDOW_SECONDS;
    const sameTs = MERGE_IF_SAME_TIMESTAMP && a.valueOf() === b.valueOf();

    if (sameUser && (close || sameTs)) {
      if (cur.content) buf.content = `${buf.content}\n${cur.content}`;
    } else {
      out.push(buf);
      buf = { ...cur };
    }
  }
  out.push(buf);
  return out;
}

// ------------ 统一处理函数（忽略频道；清洗前缀；相邻合并）------------
async function handleExportPdf(req, res) {
  try {
    const { user, from, to } = req.body || {};

    // 1) 读取“全量 CSV”（不传 channel），仅用 from/to 限制时间范围
    const rows = await loadChatRecords({ from, to });

    // 2) 只按“用户名 + 时间”过滤
    const filtered = filterByUserAndTime(rows, { user, from, to });

    // 3) 规范化：清洗前缀（基于目标用户名）→ UTC 标注 → 时间升序
    const normalized = filtered
      .map(r => ({
        username: trim(r.username),
        content: stripUserPrefixByTarget(r.content ?? "", user).replace(/\r\n/g, "\n"),
        created_at: toUTCLabel(r.created_at),
      }))
      .sort((a, b) => dayjs.utc(a.created_at).valueOf() - dayjs.utc(b.created_at).valueOf());

    // 4) 相邻合并（更贴近你本地终端长段输出）
    const records = mergeAdjacent(normalized);

    // 5) 生成 PDF
    if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });
    const outFile = path.join(EXPORT_DIR, `export_${Date.now()}.pdf`);

    const { digest = "", title = "" } = req.body || {};
    await generatePDF(records, {
      filePath: outFile,
      username: trim(user),
      channelName: "六度世界聊天区",
      digest,   // ★ 关键：写入 PDF 首页
      digestTitle: "AI 摘要 / Digest",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(path.basename(outFile))}"`
    );
    fs.createReadStream(outFile).pipe(res);
  } catch (e) {
    console.error("[BACK] 导出失败：", e);
    res.status(500).json({ error: e?.message || String(e) });
  }
}

// server.js 挂载为 app.use('/api/export', exportRouter)
// → 主路径 '/pdf' 就是 /api/export/pdf
router.post("/pdf", handleExportPdf);

// 兼容旧路径：/api/export/export/pdf 也放行
router.post("/export/pdf", handleExportPdf);

export default router;
