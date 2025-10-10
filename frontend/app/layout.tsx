export const metadata = {
    title: 'Chat PDF Export',
    description: 'Export forum chats to PDF',
};

export default function RootLayout({
    children,
}: { children: React.ReactNode }) {
    return (
        <html lang="zh-CN">
            <body>{children}</body>
        </html>
    );
}
