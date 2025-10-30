// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Chat PDF Export",
    description: "Export forum chats to PDF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="zh-CN">
            <body>{children}</body>
        </html>
    );
}
