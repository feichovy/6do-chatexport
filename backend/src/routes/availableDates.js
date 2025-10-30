// backend/src/routes/availableDates.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import customParse from 'dayjs/plugin/customParseFormat.js';
import { DATA_DIR } from '../config.js';

dayjs.extend(utc);
dayjs.extend(customParse);

function parseToUtc(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (/[zZ]$/.test(s) || /[+\-]\d{2}:\d{2}$/.test(s)) {
        const d = dayjs.utc(s); return d.isValid() ? d : null;
    }
    if (/UTC$/i.test(s)) {
        const stripped = s.replace(/\s*UTC$/i, '');
        const d = dayjs.utc(stripped, 'YYYY-MM-DD HH:mm:ss', true);
        return d.isValid() ? d : null;
    }
    const d1 = dayjs.utc(s, 'YYYY-MM-DD HH:mm:ss', true);
    if (d1.isValid()) return d1;
    const d2 = dayjs(s);
    return d2.isValid() ? dayjs.utc(d2) : null;
}

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            return res.json({ min_date: null, max_date: null });
        }
        const files = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.csv'));
        let min = null; let max = null;

        for (const file of files) {
            const filePath = path.join(DATA_DIR, file);
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row) => {
                        const raw = (row.created_at ?? row.timestamp ?? row.date ?? '').toString();
                        const t = parseToUtc(raw);
                        if (!t) return;
                        if (!min || t.isBefore(min)) min = t;
                        if (!max || t.isAfter(max)) max = t;
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });
        }

        res.json({
            min_date: min ? min.toISOString() : null,
            max_date: max ? max.toISOString() : null
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '获取日期范围失败' });
    }
});

export default router;
