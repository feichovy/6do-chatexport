'use client';

import React from 'react';

type State = {
    user: string;
    from: string;
    to: string;
    loading: boolean;
    error?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function fmt(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export default function ExportForm() {
    // 默认最近 60 天
    const today = React.useMemo(() => new Date(), []);
    const fromDefault = React.useMemo(() => {
        const d = new Date(today);
        d.setDate(d.getDate() - 60);
        return fmt(d);
    }, [today]);
    const toDefault = React.useMemo(() => fmt(today), [today]);

    const [state, setState] = React.useState<State>({
        user: '',
        from: fromDefault,
        to: toDefault,
        loading: false,
    });

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setState((s) => ({ ...s, error: undefined }));

        if (!state.user.trim()) {
            setState((s) => ({ ...s, error: '请填写用户名', loading: false }));
            return;
        }
        if (state.from && state.to && state.from > state.to) {
            setState((s) => ({ ...s, error: '开始日期需早于结束日期', loading: false }));
            return;
        }

        try {
            setState((s) => ({ ...s, loading: true }));

            const res = await fetch(`${API_BASE}/api/export/pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: state.user.trim(),
                    from: state.from || undefined,
                    to: state.to || undefined,
                }),
            });

            if (!res.ok) {
                const msg = await safeReadError(res);
                throw new Error(msg || `导出失败(${res.status})`);
            }

            const filename = parseFilename(
                res.headers.get('Content-Disposition'),
                `聊天记录_${state.user}_${state.from || 'start'}_${state.to || 'end'}.pdf`
            );

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err: any) {
            setState((s) => ({ ...s, error: err?.message || '导出失败' }));
        } finally {
            setState((s) => ({ ...s, loading: false }));
        }
    }

    function onCancel() {
        window.history.back();
    }

    return (
        <form onSubmit={onSubmit} className="grid gap-5">
            {/* 用户名 */}
            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">用户名</label>
                <input
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-600"
                    placeholder="请输入要导出的用户名"
                    value={state.user}
                    onChange={(e) => setState((s) => ({ ...s, user: e.target.value }))}
                />
            </div>

            {/* 日期范围 */}
            <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">日期范围</label>
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-600"
                        value={state.from}
                        onChange={(e) => setState((s) => ({ ...s, from: e.target.value }))}
                    />
                    <span className="text-slate-500">至</span>
                    <input
                        type="date"
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-600"
                        value={state.to}
                        onChange={(e) => setState((s) => ({ ...s, to: e.target.value }))}
                    />
                </div>
                <p className="mt-1 text-xs text-slate-500">默认最近 60 天，可留空表示不限制。</p>
            </div>

            {/* 错误提示 */}
            {state.error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {state.error}
                </div>
            )}

            {/* ✅ ✅ ✅ 底部操作按钮（主按钮在右，取消在左） */}
            <div className="mt-4 flex justify-end space-x-3">
                {/* 先导出按钮 */}
                <button
                    type="submit"
                    disabled={state.loading || !state.user.trim()}
                    className={`inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed`}
                >
                    {state.loading && (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                    )}
                    {state.loading ? '正在导出…' : '导出PDF'}
                </button>

                {/* 再取消按钮（在左） */}
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                    取消
                </button>
            </div>

        </form>
    );
}

async function safeReadError(res: Response) {
    try { return (await res.json())?.error; } catch { }
    try { return await res.text(); } catch { return ''; }
}

function parseFilename(cd: string | null, fallback: string) {
    if (!cd) return fallback;
    const m1 = /filename\*?=(?:UTF-8''|")(.*?)(?:\"|$)/i.exec(cd);
    if (m1 && m1[1]) { try { return decodeURIComponent(m1[1]); } catch { return m1[1]; } }
    const m2 = /filename=([^;]+)/i.exec(cd);
    if (m2 && m2[1]) return m2[1].replace(/^\"|\"$/g, '');
    return fallback;
}
