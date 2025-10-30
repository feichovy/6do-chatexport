// frontend/app/export/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import ExportForm from '../../components/ExportModal';

export default function ExportPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-slate-200">
            {/* 蒙层 + 居中弹窗（Flask/Bootstrap 模态风） */}
            <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
                    {/* 头部 */}
                    <div className="flex items-center justify-between px-5 py-4">
                        <h2 className="text-[18px] font-semibold text-slate-800">导出聊天记录</h2>
                        <button
                            aria-label="关闭"
                            onClick={() => router.back()}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-600 transition hover:bg-slate-100"
                            title="关闭"
                        >
                            ×
                        </button>
                    </div>

                    {/* 分割线 */}
                    <div className="h-px w-full bg-slate-200" />

                    {/* 内容区：表单（不再在表单内部放卡片容器） */}
                    <div className="px-5 py-4">
                        <ExportForm />
                    </div>
                </div>
            </div>
        </div>
    );
}
