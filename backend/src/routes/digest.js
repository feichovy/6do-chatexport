import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { digestChatRows } from "../services/digestService.js";
import { loadChatRecords } from "../utils/csvLoader.js";

const router = express.Router();

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
});

const RequestSchema = z.object({
    rows: z.array(z.object({
        timestamp: z.string().optional(),
        created_at: z.string().optional(),
        username: z.string().optional(),
        content: z.string(),
    })).optional(),
    user: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    channel: z.string().optional(),
    topic: z.string().optional(),
    language: z.enum(["zh", "en"]).default("zh"),
    style: z.enum(["concise", "bulleted", "executive"]).default("executive"),
});

router.post("/digest", limiter, async (req, res) => {
    try {
        const parsed = RequestSchema.parse(req.body);

        let rows = parsed.rows;
        if (!rows || rows.length === 0) {
            const records = await loadChatRecords({
                user: parsed.user,
                from: parsed.from,
                to: parsed.to,
                channel: parsed.channel,
            });

            rows = records.map(r => ({
                timestamp: r.created_at,
                username: r.username,
                content: r.content,
            }));
        }

        if (!rows || rows.length === 0)
            return res.status(400).json({ ok: false, error: "没有可摘要的聊天记录。" });

        const result = await digestChatRows(rows, {
            topic: parsed.topic,
            language: parsed.language,
            style: parsed.style,
        });

        res.json({ ok: true, ...result });
    } catch (err) {
        console.error("[/digest] error:", err);
        res.status(400).json({ ok: false, error: err?.message || "请求错误" });
    }
});

export default router;
