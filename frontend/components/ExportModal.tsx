'use client';

import React from 'react';

// --------------- 辅助函数：自动拼接 API URL -----------------
const RAW_API =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_API_URL ||
    '';

function apiUrl(path: string) {
    const base = RAW_API.replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    if (base.endsWith('/api')) return `${base}${p.replace(/^\/api/, '')}`;
    return `${base}${p}`;
}
// -----------------------------------------------------------

type State = {
    user: string;
    from: string;
    to: string;
    loading: boolean;
    error?: string;
    manualDigest: string;
};

function fmt(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export default function ExportForm() {
    const today = new Date();
    const fromDefault = fmt(new Date(today.getFullYear(), today.getMonth() - 2, today.getDate()));
    const toDefault = fmt(today);

    const [state, setState] = React.useState<State>({
        user: '',
        from: fromDefault,
        to: toDefault,
        loading: false,
        manualDigest: '',
    });

    // ---------- 仅导出 PDF ----------
    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setState((s) => ({ ...s, error: undefined }));

        const err = validateBasic();
        if (err) return setState((s) => ({ ...s, error: err }));

        try {
            setState((s) => ({ ...s, loading: true }));

            const res = await fetch(apiUrl('/api/export/pdf'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: state.user.trim(),
                    from: state.from || undefined,
                    to: state.to || undefined,
                    digest: '',
                }),
            });

            await handleFileResponse(res, defaultFilename());
        } catch (err: any) {
            setState((s) => ({ ...s, error: err?.message || '导出失败' }));
        } finally {
            setState((s) => ({ ...s, loading: false }));
        }
    }

    // ---------- 生成摘要并导出 ----------
    async function onDigestAndExport() {
        setState((s) => ({ ...s, error: undefined }));

        const err = validateBasic();
        if (err) return setState((s) => ({ ...s, error: err }));

        try {
            setState((s) => ({ ...s, loading: true }));

            let digestToUse = state.manualDigest.trim();

            // 如果为空 → 自动调用后端 AI 摘要
            if (!digestToUse) {
                const dResp = await fetch(apiUrl('/api/digest'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user: state.user.trim(),
                        from: state.from || undefined,
                        to: state.to || undefined,
                        language: 'zh',
                        style: 'executive',
                        topic: `用户 ${state.user} 的聊天记录摘要`,
                    }),
                });

                const text = await dResp.text();
                let dJson: any;
                try {
                    dJson = JSON.parse(text);
                } catch {
                    throw new Error('AI 摘要接口返回异常：' + text.slice(0, 100));
                }

                if (!dResp.ok || !dJson.ok) throw new Error(dJson.error || 'AI 摘要生成失败');
                digestToUse = dJson.merged || '';
            }

            // 带摘要导出
            const res = await fetch(apiUrl('/api/export/pdf'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: state.user.trim(),
                    from: state.from || undefined,
                    to: state.to || undefined,
                    digest: digestToUse,
                }),
            });

            await handleFileResponse(res, defaultFilename());
        } catch (err: any) {
            setState((s) => ({ ...s, error: err?.message || '导出失败' }));
        } finally {
            setState((s) => ({ ...s, loading: false }));
        }
    }

    function validateBasic() {
        if (!state.user.trim()) return '请填写用户名';
        if (state.from && state.to && state.from > state.to)
            return '开始日期需早于结束日期';
        return '';
    }

    function defaultFilename() {
        return `聊天记录_${state.user}_${state.from || 'start'}_${state.to || 'end'}.pdf`;
    }

    function onCancel() {
        window.history.back();
    }

    return (
        <form onSubmit={onSubmit} className="grid gap-5">
            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                    用户名
                </label>
                <input
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-blue-600"
                    placeholder="请输入要导出的用户名"
                    value={state.user}
                    onChange={(e) => setState({ ...state, user: e.target.value })}
                />
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                    日期范围
                </label>
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-600"
                        value={state.from}
                        onChange={(e) => setState({ ...state, from: e.target.value })}
                    />
                    <span className="text-slate-500">至</span>
                    <input
                        type="date"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-600"
                        value={state.to}
                        onChange={(e) => setState({ ...state, to: e.target.value })}
                    />
                </div>
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                    （可选）摘要
                </label>
                <textarea
                    className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 h-24 font-mono text-sm shadow-sm outline-none transition focus:border-blue-600 placeholder-slate-400 ${state.manualDigest ? 'text-black' : 'text-gray-500'
                        }`}
                    placeholder="若留空，则自动调用 AI 生成摘要"
                    value={state.manualDigest}
                    onChange={(e) => setState({ ...state, manualDigest: e.target.value })}
                />
            </div>

            {state.error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {state.error}
                </div>
            )}

            <div className="mt-4 flex justify-end space-x-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                    取消
                </button>

                <button
                    type="submit"
                    disabled={state.loading || !state.user.trim()}
                    className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-700 disabled:bg-slate-300"
                >
                    {state.loading ? '正在导出…' : '仅导出 PDF'}
                </button>

                <button
                    type="button"
                    onClick={onDigestAndExport}
                    disabled={state.loading || !state.user.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:bg-slate-300"
                >
                    {state.loading ? '生成中…' : '生成摘要并导出 PDF'}
                </button>
            </div>
        </form>
    );
}

// ------------------- 工具函数 -------------------
async function handleFileResponse(res: Response, fallbackName: string) {
    if (!res.ok) {
        const msg = await safeReadError(res);
        throw new Error(msg || `导出失败(${res.status})`);
    }

    const filename = parseFilename(res.headers.get('Content-Disposition'), fallbackName);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

async function safeReadError(res: Response) {
    try { return (await res.json())?.error; } catch { }
    try { return await res.text(); } catch { return ''; }
}

function parseFilename(cd: string | null, fallback: string) {
    if (!cd) return fallback;
    const m = /filename\*?=(?:UTF-8''|")(.*?)(?:\"|$)/i.exec(cd);
    if (m && m[1]) { try { return decodeURIComponent(m[1]); } catch { return m[1]; } }
    return fallback;
}
