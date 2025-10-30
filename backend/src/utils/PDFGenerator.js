// backend/src/utils/PDFGenerator.js
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import customParse from "dayjs/plugin/customParseFormat.js";

dayjs.extend(utc);
dayjs.extend(customParse);

// ---------- 时间与标题 ----------
function parseUTC(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (/[zZ]$/.test(s)) return dayjs.utc(s);
    if (/UTC$/i.test(s)) return dayjs.utc(s.replace(/\s*UTC$/i, ""), "YYYY-MM-DD HH:mm:ss", true);
    return dayjs.utc(s);
}
function fmtUTC(v) {
    const d = parseUTC(v);
    return d?.isValid() ? `${d.format("YYYY-MM-DD HH:mm:ss")} UTC` : "";
}
function ym(v) {
    const d = parseUTC(v);
    return d?.isValid() ? d.format("YYYYMM") : null;
}
function buildTitle({ username, records, channelName = "六度世界聊天区" }) {
    let s = null, e = null;
    for (const r of records || []) {
        const y = ym(r?.created_at);
        if (!y) continue;
        if (!s || y < s) s = y;
        if (!e || y > e) e = y;
    }
    const range = s && e ? `（${s}-${e}）` : "";
    const who = (username && String(username).trim()) || "聊天记录";
    return `${who}聊天记录 - ${channelName}${range}`;
}

// ---------- 主函数 ----------
export async function generatePDF(
    records,
    {
        filePath,
        username,
        channelName = "六度世界聊天区",
        // ★ 新增：将 Digest 文本直接写入 PDF（可为 Markdown 文本；本实现按纯文本换行渲染）
        digest = "",
        digestTitle = "AI 摘要 / Digest",
    } = {}
) {
    return new Promise((resolve, reject) => {
        try {
            // —— 版式常量（保持你当前调校）——
            const M = { top: 60, bottom: 60, left: 48, right: 48 };
            const TITLE_ALIGN = "center";
            const TITLE_FS = 13;
            const TITLE_OFFSET_X = 0;
            const TITLE_OFFSET_Y = 0;
            const TH_FS = 11;
            const TXT_FS = 10;
            const DIGEST_TITLE_FS = 14;   // ★ 新增：摘要区标题字号
            const DIGEST_TEXT_FS = 10;    // ★ 新增：摘要区正文字号
            const FOOTER_FS = 9;
            const TIME_W = 120;
            const LINE_GAP = 1;
            const CELL_PAD_X = 3;
            const CELL_PAD_Y = 3;
            const HEADER_H = 20;
            const HEADER_PAD_X = 8;
            const FOOTER_H = 18;

            // 中文字体（任一存在即可）
            const scFontCandidates = [
                path.join(process.cwd(), "backend", "fonts", "NotoSansSC-Regular.ttf"),
                path.join(process.cwd(), "fonts", "NotoSansSC-Regular.ttf"),
                path.join(process.cwd(), "frontend", "public", "NotoSansSC-Regular.ttf"),
            ];
            const scFont = scFontCandidates.find((p) => fs.existsSync(p));
            if (!scFont) console.warn("[PDF] ⚠️ 未找到中文字体，将退回 Helvetica（中文可能乱码）");
            else console.log("[PDF] ✅ 使用字体:", scFont);

            const applyFont = (doc, size) => {
                if (scFont) doc.font(scFont).fontSize(size);
                else doc.font("Helvetica").fontSize(size);
            };
            const measure = (doc, text, width, size) => {
                applyFont(doc, size);
                return doc.heightOfString(text, { width, lineGap: LINE_GAP });
            };

            // 启用页面缓冲：便于最后逐页回填页脚
            const doc = new PDFDocument({
                size: "A4",
                margins: { top: M.top, bottom: M.bottom, left: M.left, right: M.right },
                autoFirstPage: false,
                bufferPages: true,
            });

            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            const titleText = buildTitle({ username, records, channelName });

            let pageNum = 0;
            let yPos = 0;
            let CONTENT_W = 0;
            let contentBottom = 0;

            // 计算列宽（每页都可调用，避免依赖表头）
            const computeLayout = () => {
                const usableW = doc.page.width - M.left - M.right;
                CONTENT_W = usableW - TIME_W;
            };

            // —— 抽出：绘制大标题（返回标题下方的 Y 坐标基线）——
            const drawTitle = () => {
                doc.lineWidth(0.5);
                computeLayout();

                const titleY = M.top - 22 + TITLE_OFFSET_Y;
                applyFont(doc, TITLE_FS);
                doc.fillColor("#000");

                const titleWidth = doc.widthOfString(titleText);
                let titleX;
                if (TITLE_ALIGN === "center") {
                    titleX = (doc.page.width - titleWidth) / 2 + TITLE_OFFSET_X;
                } else if (TITLE_ALIGN === "content-left") {
                    titleX = M.left + TITLE_OFFSET_X;
                } else {
                    titleX = M.left + TITLE_OFFSET_X;
                }
                doc.text(titleText, titleX, titleY, { lineBreak: false });
                return titleY + 24; // 原先表头的起始 Y
            };

            // —— 抽出：绘制表头（可以在任意 Y 位置绘制），返回正文起点 Y —— //
            const drawTableHeaderAt = (thY) => {
                applyFont(doc, TH_FS);

                // 左列表头框
                doc.rect(M.left, thY, CONTENT_W, HEADER_H).stroke();
                const contentHeaderH = doc.heightOfString("内容", {
                    width: CONTENT_W - HEADER_PAD_X * 2,
                });
                const contentHeaderY = thY + (HEADER_H - contentHeaderH) / 2;
                doc.text("内容", M.left + HEADER_PAD_X, contentHeaderY, {
                    width: CONTENT_W - HEADER_PAD_X * 2,
                    align: "center",
                    lineBreak: false,
                });

                // 右列表头框
                const timeX = M.left + CONTENT_W;
                doc.rect(timeX, thY, TIME_W, HEADER_H).stroke();
                const timeHeaderH = doc.heightOfString("时间", {
                    width: TIME_W - HEADER_PAD_X * 2,
                });
                const timeHeaderY = thY + (HEADER_H - timeHeaderH) / 2;
                doc.text("时间", timeX + HEADER_PAD_X, timeHeaderY, {
                    width: TIME_W - HEADER_PAD_X * 2,
                    align: "center",
                    lineBreak: false,
                });

                // 底线
                doc.moveTo(M.left, thY + HEADER_H)
                    .lineTo(M.left + CONTENT_W + TIME_W, thY + HEADER_H)
                    .stroke();

                // 正文起点
                return thY + HEADER_H + 0.3;
            };

            // —— 摘要块（可跨页；结束后返回当前页的 doc.y）——
            // —— 摘要块（可跨页；结束后返回当前页的 doc.y）——
            const drawDigestBlock = (startY, rawText) => {
                if (!rawText || !String(rawText).trim()) return startY;

                const textStr = String(rawText).replace(/\r\n/g, "\n");

                // 1) 识别是否更像“AI 摘要”
                //    - 常见标记：TL;DR / Key Points / 关键要点 / AI / LLM / 本地降级(local-fallback) / 总结 / 分析 等
                const looksAIDigest = /(^|\n)\s{0,3}(##\s*TL;DR|###\s*(关键要点|Key\s*Points)|AI|LLM|本地降级|local[-\s]?fallback|总结|分析)/i.test(textStr);

                // 2) 决定标题：
                //    - 若用户未显式自定义（或仍使用默认值），则自动切换
                //    - 若外部传了自定义 digestTitle（且不等于默认值），则优先使用自定义
                const DEFAULT_TITLE = "AI 摘要 / Digest";
                const autoTitle = looksAIDigest ? "AI 摘要 / Digest" : "摘要 / Summary";
                const titleToUse = (digestTitle && digestTitle !== DEFAULT_TITLE) ? digestTitle : autoTitle;

                // 整体宽度使用全宽（内容列 + 时间列）
                const usableW = CONTENT_W + TIME_W;

                // 标题
                applyFont(doc, DIGEST_TITLE_FS);
                doc.fillColor("#000");
                const titleH = doc.heightOfString(titleToUse, { width: usableW });
                const pageBottomForDigest = () => doc.page.height - M.bottom - FOOTER_H - 4;

                // 如空间不足，换页后再画
                if (startY + titleH > pageBottomForDigest()) {
                    doc.addPage();
                    pageNum += 1;
                    computeLayout();
                    startY = M.top;
                }
                doc.text(titleToUse, M.left, startY, {
                    width: usableW,
                    underline: true,
                });
                let y = startY + titleH + 6;

                // 正文（让 PDFKit 自动分页；我们只在开始前做一次“是否立即换页”的判断）
                applyFont(doc, DIGEST_TEXT_FS);
                doc.fillColor("#000");
                doc.text(textStr, M.left, y, {
                    width: usableW,
                    lineGap: LINE_GAP,
                });

                // 返回当前 y
                return doc.y + 8;
            };


            // 首页：打开页面 + 大标题
            const openFirstPage = () => {
                doc.addPage();
                pageNum += 1;
                computeLayout();
                const afterTitleY = drawTitle();
                contentBottom = doc.page.height - M.bottom - FOOTER_H - 4;
                return afterTitleY;
            };

            // 后续页：不画表头（与终端版一致），直接从上边距开始（用于表格分页）
            const openNextPageNoHeader = () => {
                doc.addPage();
                pageNum += 1;
                doc.lineWidth(0.5);
                computeLayout();
                yPos = M.top;
                contentBottom = doc.page.height - M.bottom - FOOTER_H - 4;
            };

            const renderRow = (leftText, rightText) => {
                const leftH = Math.ceil(
                    measure(doc, leftText, CONTENT_W - CELL_PAD_X * 2, TXT_FS)
                );
                const rowH = Math.max(18, leftH + CELL_PAD_Y * 2);

                if (yPos + rowH > contentBottom) {
                    // 第二页起不绘制表头
                    openNextPageNoHeader();
                }

                // 边框
                doc.rect(M.left, yPos, CONTENT_W, rowH).stroke();
                doc.rect(M.left + CONTENT_W, yPos, TIME_W, rowH).stroke();

                // 左列
                applyFont(doc, TXT_FS);
                doc.fillColor("#000").text(leftText, M.left + CELL_PAD_X, yPos + CELL_PAD_Y, {
                    width: CONTENT_W - CELL_PAD_X * 2,
                    lineGap: LINE_GAP,
                });

                // 右列（垂直居中）
                const tH = Math.ceil(measure(doc, rightText, TIME_W - 4, TXT_FS));
                const tY = yPos + (rowH - tH) / 2;
                doc.text(rightText, M.left + CONTENT_W, tY, { width: TIME_W, align: "center" });

                yPos += rowH;
            };

            // —— 开始生成 —— //
            // 1) 首页：标题
            let cursorY = openFirstPage();

            // 2) 如果有摘要，先写摘要块（自动跨页）
            if (digest && String(digest).trim()) {
                cursorY = drawDigestBlock(cursorY, digest);

                // 摘要结束后，准备进入表格：
                // 若当前页剩余空间不足以放下表头 + 少量内容，就换到新页再起表头
                const needSpace = HEADER_H + 10;
                const currentBottom = doc.page.height - M.bottom - FOOTER_H - 4;
                if (cursorY + needSpace > currentBottom) {
                    doc.addPage();
                    pageNum += 1;
                    computeLayout();
                    cursorY = M.top;
                }
            }

            // 3) 绘制表头（无摘要时也会直接绘制）
            yPos = drawTableHeaderAt(cursorY);
            contentBottom = doc.page.height - M.bottom - FOOTER_H - 4;

            // 4) 表格正文
            // 注意：这里去掉“用户名: ”前缀，直接输出内容本身（与本地终端版一致）
            for (const r of records || []) {
                const c = (r.content ?? "").replace(/\r\n/g, "\n").trim();
                if (!c) continue;
                renderRow(c, fmtUTC(r.created_at));
            }

            // ★ 完成后逐页回填“第 N 页”
            const range = doc.bufferedPageRange(); // { start, count }
            for (let idx = 0; idx < range.count; idx++) {
                const i = range.start + idx;
                doc.switchToPage(i);

                const text = `第 ${idx + 1} 页`;
                applyFont(doc, FOOTER_FS);
                doc.fillColor("#666");

                const textWidth = doc.widthOfString(text);
                const centerX = (doc.page.width - textWidth) / 2;
                const y = doc.page.height - M.bottom + 5;

                doc.text(text, centerX, y, { lineBreak: false, continued: false });
            }

            doc.end();
            stream.on("finish", resolve);
            stream.on("error", reject);
        } catch (err) {
            reject(err);
        }
    });
}
