// frontend/app/digest/page.tsx
import DigestPanel from "../../components/DigestPanel";

export default function DigestPage() {
    return (
        <main className="max-w-4xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-4">AI 摘要 / Digest</h1>
            <p className="text-sm text-gray-600 mb-6">
                粘贴从 CSV/后端解析后的 rows（JSON 数组），选择语言与风格，一键生成 Digest。
            </p>
            <DigestPanel />
        </main>
    );
}
