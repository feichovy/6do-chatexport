"use client";

import { useState } from "react";

export default function CrawlerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleCrawl = async () => {
    if (!url.trim()) {
      setMessage("请输入要抓取的帖子链接");
      return;
    }
    setLoading(true);
    setMessage("正在启动爬虫，请稍候...");

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.ok) setMessage("✅ 爬虫已启动，请等待 CSV 文件生成");
      else setMessage("❌ 启动失败：" + data.error);
    } catch (err) {
      setMessage("❌ 请求失败：" + err);
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 shadow-lg w-[500px]">
        <h2 className="text-xl font-semibold mb-4">爬取论坛聊天记录</h2>
        <input
          type="text"
          placeholder="请输入帖子链接。"
          className="w-full border rounded-lg px-3 py-2 mb-4"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg">取消</button>
          <button onClick={handleCrawl} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            {loading ? "执行中..." : "开始爬取"}
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
}
