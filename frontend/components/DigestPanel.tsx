// frontend/components/DigestPanel.tsx
"use client";

import { useState } from "react";

type Row = { timestamp?: string; username?: string; content: string };

export default function DigestPanel() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";

    const [rowsJson, setRowsJson] = useState<string>("");
    const [language, setLanguage] = useState<"zh" | "en">("zh");
    const [style, setStyle] = useState<"concise" | "bulleted" | "executive">("concise");
    const [topic, setTopic] = useState<string>("聊天记录");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string>("");
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        setError(null);
        setResult("");
        let rows: Row[] = [];

        try {
            rows = JSON.parse(rowsJson);
            if (!Array.isArray(rows)) throw new Error("rows 必须是数组");
        } catch (e: any) {
            setError("rows JSON 解析失败：" + (e?.message || ""));
            return;
        }

        setLoading(true);
        try {
            const resp = await fetch(`${apiBase}/digest`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows, language, style, topic }),
            });
            const data = await resp.json();
            if (!resp.ok || !data.ok) throw new Error(data.error || "digest 失败");
            setResult(data.merged);
        } catch (e: any) {
            setError(e?.message || "请求失败");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid gap-4 p-4">
            <div className="grid gap-2">
                <label className="font-medium">主题（可选）</label>
                <input
                    className="border rounded p-2"
                    placeholder="聊天记录 / 需求讨论 / Sprint 回顾 ..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                    <label className="font-medium">语言</label>
                    <select className="border rounded p-2" value={language} onChange={(e) => setLanguage(e.target.value as any)}>
                        <option value="zh">中文</option>
                        <option value="en">English</option>
                    </select>
                </div>
                <div className="grid gap-2">
                    <label className="font-medium">风格</label>
                    <select className="border rounded p-2" value={style} onChange={(e) => setStyle(e.target.value as any)}>
                        <option value="concise">简洁</option>
                        <option value="bulleted">项目符号</option>
                        <option value="executive">管理者摘要</option>
                    </select>
                </div>
                <div className="grid gap-2">
                    <label className="font-medium">操作</label>
                    <button
                        className="rounded-2xl shadow px-4 py-2 border disabled:opacity-50"
                        disabled={loading}
                        onClick={run}
                    >
                        {loading ? "生成中..." : "生成 Digest"}
                    </button>
                </div>
            </div>

            <div className="grid gap-2">
                <label className="font-medium">
                    rows（JSON 数组：[{`{ created_at/timestamp, username, content }`}]）
                </label>
                <textarea
                    className="border rounded p-2 h-48 font-mono text-sm"
                    placeholder='[{"created_at":"2025-08-03 10:01","username":"A","content":"..."}]'
                    value={rowsJson}
                    onChange={(e) => setRowsJson(e.target.value)}
                />
            </div>

            {error && <div className="text-red-600">错误：{error}</div>}

            <div className="grid gap-2">
                <label className="font-medium">生成结果（Markdown）</label>
                <textarea
                    className="border rounded p-2 h-64 font-mono text-sm"
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                />
            </div>
        </div>
    );
}
