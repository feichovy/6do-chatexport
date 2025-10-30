// backend/src/utils/csvLoader.js
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import customParse from 'dayjs/plugin/customParseFormat.js';
import { DATA_DIR } from '../config.js';

dayjs.extend(utc);
dayjs.extend(customParse);

/** 将任意原始时间字符串解析为 dayjs.utc() 对象 */
function parseToUtc(raw) {
    if (!raw) return null;
    const s = String(raw).trim();

    // 1) 标准 ISO（含 Z 或时区）
    if (/[zZ]$/.test(s) || /[+\-]\d{2}:\d{2}$/.test(s)) {
        const d = dayjs.utc(s);
        return d.isValid() ? d : null;
    }

    // 2) "YYYY-MM-DD HH:mm:ss UTC"
    if (/UTC$/i.test(s)) {
        const stripped = s.replace(/\s*UTC$/i, '');
        const d = dayjs.utc(stripped, 'YYYY-MM-DD HH:mm:ss', true);
        return d.isValid() ? d : null;
    }

    // 3) 严格按 "YYYY-MM-DD HH:mm:ss" 作为 UTC
    const d1 = dayjs.utc(s, 'YYYY-MM-DD HH:mm:ss', true);
    if (d1.isValid()) return d1;

    // 4) 兜底：让 dayjs 自判再转 utc
    const d2 = dayjs(s);
    return d2.isValid() ? dayjs.utc(d2) : null;
}

/**
 * @param {Object} options
 * @param {string} [options.channel]  包含匹配（仅当 CSV 有频道列时）
 * @param {string} [options.user]     精确匹配
 * @param {string} [options.from]     YYYY-MM-DD（UTC起始日）
 * @param {string} [options.to]       YYYY-MM-DD（UTC结束日）
 */
export async function loadChatRecords({ channel, user, from, to } = {}) {
    if (!fs.existsSync(DATA_DIR)) return [];

    const files = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.csv'));

    const fromUtc = from ? dayjs.utc(from, 'YYYY-MM-DD', true).startOf('day') : null;
    const toUtc = to ? dayjs.utc(to, 'YYYY-MM-DD', true).endOf('day') : null;

    const results = [];

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (row) => {
                    try {
                        const message_id = String(row.message_id ?? row.id ?? '').trim();
                        const username = String(row.username ?? row.user ?? row.nickname ?? '').trim();
                        const channel_name = String(row.channel_name ?? row.channel ?? '').trim();
                        const content = String(row.content ?? row.message ?? row.text ?? '').toString();

                        const rawTime = String(row.created_at ?? row.timestamp ?? row.date ?? '').trim();
                        const t = parseToUtc(rawTime);
                        if (!t) return; // 不可解析 → 跳过

                        // 过滤条件
                        if (user && username !== user) return;
                        if (fromUtc && t.isBefore(fromUtc)) return;
                        if (toUtc && t.isAfter(toUtc)) return;
                        if (channel && channel_name && !channel_name.includes(channel)) return;

                        results.push({
                            message_id,
                            username,
                            channel_name,
                            content,
                            // 统一为 UTC 标准格式（无时区后缀）；PDF 层会再显示为 "… UTC"
                            created_at: t.format('YYYY-MM-DD HH:mm:ss')
                        });
                    } catch { /* 忽略异常行 */ }
                })
                .on('end', resolve)
                .on('error', reject);
        });
    }

    // 按 UTC 时间排序
    results.sort(
        (a, b) =>
            dayjs.utc(a.created_at, 'YYYY-MM-DD HH:mm:ss').valueOf() -
            dayjs.utc(b.created_at, 'YYYY-MM-DD HH:mm:ss').valueOf()
    );

    return results;
}
