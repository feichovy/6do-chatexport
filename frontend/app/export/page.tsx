'use client';

import ExportForm from '../../components/ExportModal';

function TopNav() {
    // 深色导航条，模拟 Flask/Bootstrap 的 navbar-dark bg-dark
    return (
        <header className="w-full bg-[#343a40]">
            <div className="mx-auto flex h-12 max-w-5xl items-center px-4">
                <span className="text-sm font-medium text-white">六度世界聊天区 · 导出工具</span>
            </div>
        </header>
    );
}

export default function ExportPage() {
    return (
        <div className="min-h-screen bg-slate-50">
            <TopNav />
            <main className="mx-auto max-w-5xl px-4 py-6">
                {/* 页面标题 + 副标题（Bootstrap 容器标题风格） */}
                <div className="mb-4">
                    <h1 className="text-[20px] font-semibold text-slate-800">导出聊天记录</h1>
                    <p className="mt-1 text-[13px] text-slate-600">
                        选择<strong className="font-medium">用户名</strong>与<strong className="font-medium">日期范围</strong>，系统将从所有 CSV 中筛选、清洗并导出 PDF。
                    </p>
                </div>

                <ExportForm />
            </main>
            <footer className="border-t border-slate-200 py-4">
                <div className="mx-auto max-w-5xl px-4 text-[12px] text-slate-500">
                    © {new Date().getFullYear()} 六度世界 · 导出工具
                </div>
            </footer>
        </div>
    );
}
