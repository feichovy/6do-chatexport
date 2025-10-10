'use client';

import React from 'react';

type State = {
    user: string;
    from: string;
    to: string;
    loading: boolean;
    error?: string;
};

type DateRange = { min?: string; max?: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''; // 有值→直连；无值→走 Next rewrites

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

    const [range, setRange] = React.useState<DateRange>({});

    // 可选：仿照 Flask 的 /api/available-dates，自动设置日期 min/max
    React.useEffect(() => {
        (async () => {
            try {
                const r = await fetch(`${API_BASE}/api/available-dates`);
                if (!r.ok) return;
                const data = await r.json();
                if (data?.min_date || data?.max_date) {
                    setRange({ min: data.min_date, max: data.max_date });
                }
            } catch {
                // 后端没有该接口也不报错，保持静默
            }
        })();
    }, []);

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

    return (
        <div className="mx-auto w-full max-w-3xl">
            {/* 顶部淡色提示条（模仿 Flask 页的轻提示） */}
            <div className="mb-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                无需选择频道或 CSV，系统会自动遍历所有数据（均属于「六度世界聊天区」）。
            </div>

            {/* 卡片（Bootstrap 风） */}
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {/* 卡片头 */}
                <div className="border-b border-slate-200 px-5 py-3">
                    <h2 className="text-[15px] font-medium text-slate-800">导出参数</h2>
                    <p className="mt-1 text-xs text-slate-500">
                        仅输入<strong className="font-medium">用户名</strong>与<strong className="font-medium">日期范围</strong>即可导出 PDF。
                    </p>
                </div>

                {/* 表单体 */}
                <form onSubmit={onSubmit} className="px-5 py-4">
                    {/* 表单组：用户名 */}
                    <div className="mb-4">
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                            用户名 <span className="text-rose-500">*</span>
                        </label>
                        <input
                            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-600"
                            placeholder="请输入用户名"
                            value={state.user}
                            onChange={(e) => setState((s) => ({ ...s, user: e.target.value }))}
                        />
                    </div>

                    {/* 表单组：日期范围（两列） */}
                    <div className="mb-4 grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-700">开始日期</label>
                            <input
                                type="date"
                                min={range.min}
                                max={range.max}
                                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-600"
                                value={state.from}
                                onChange={(e) => setState((s) => ({ ...s, from: e.target.value }))}
                            />
                            <p className="mt-1 text-[11px] text-slate-400">默认最近 60 天</p>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-700">结束日期</label>
                            <input
                                type="date"
                                min={range.min}
                                max={range.max}
                                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-600"
                                value={state.to}
                                onChange={(e) => setState((s) => ({ ...s, to: e.target.value }))}
                            />
                            <p className="mt-1 text-[11px] text-slate-400">可留空代表无上限</p>
                        </div>
                    </div>

                    {/* 错误提示条（淡红） */}
                    {state.error && (
                        <div className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                            {state.error}
                        </div>
                    )}

                    {/* 动作区 */}
                    <div className="flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={state.loading || !state.user.trim()}
                            className={`inline-flex items-center gap-2 rounded bg-[#0d6efd] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0b5ed7] disabled:cursor-not-allowed disabled:bg-slate-300`}
                        >
                            {state.loading && (
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                            )}
                            {state.loading ? '正在导出…' : '导出 PDF'}
                        </button>

                        <span className="text-[12px] text-slate-500">
                            PDF 将自动清理用户名冗余并合并相邻短分片。
                        </span>
                    </div>
                </form>

                {/* 卡片脚（说明） */}
                <div className="border-t border-slate-200 px-5 py-3">
                    <p className="text-[11px] leading-relaxed text-slate-500">
                        若后端提供 <code className="rounded bg-slate-100 px-1">/api/available-dates</code>，日期控件会自动设置可选范围；
                        否则仍可手动输入日期。
                    </p>
                </div>
            </div>
        </div>
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
