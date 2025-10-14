// frontend/postcss.config.js
module.exports = {
    plugins: {
        "@tailwindcss/postcss": {},   // ← v4 新写法（替代 tailwindcss: {}）
        autoprefixer: {},
    },
};
