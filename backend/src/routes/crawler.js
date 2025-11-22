// backend/src/routes/crawler.js
import express from "express";
import { spawn } from "child_process";
import path from "path";

const router = express.Router();

// POST /api/crawl
router.post("/", async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ ok: false, error: "缺少 URL 参数" });
    }

    // 你的爬虫脚本路径
    const scriptPath = path.join(process.cwd(), "src", "scripts", "extract_chat_from_forum.py");

    console.log(`[Crawler] 启动爬虫: ${url}`);
    const pythonProcess = spawn("python", [scriptPath, url]);

    let logs = [];
    pythonProcess.stdout.on("data", (data) => {
        const msg = data.toString();
        logs.push(msg);
        console.log(`[Crawler] ${msg.trim()}`);
    });

    pythonProcess.stderr.on("data", (data) => {
        const msg = data.toString();
        logs.push(msg);
        console.error(`[Crawler ERR] ${msg.trim()}`);
    });

    pythonProcess.on("close", (code) => {
        console.log(`[Crawler] 爬虫进程退出，代码: ${code}`);
    });

    res.json({ ok: true, message: "爬虫已启动，日志将在控制台输出", logs });
});

export default router;
