/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:5001/api/:path*', // 反向代理到后端
            },
        ];
    },
};

module.exports = nextConfig;
