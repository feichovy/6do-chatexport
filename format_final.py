# -*- coding: utf-8 -*-
import os
import pandas as pd
from fpdf import FPDF
from datetime import datetime
import unicodedata
from io import StringIO
from fpdf.enums import XPos, YPos
import glob

# 配置路径
BASE_DIR = r"G:\6do项目"
INPUT_DIR = os.path.join(BASE_DIR, "CSV合并输出")  # 合并后的CSV目录
OUTPUT_DIR = os.path.join(BASE_DIR, "PDF输出")    # PDF输出目录
FONT_PATH = os.path.join(BASE_DIR, "fonts", "NotoSansSC-Regular.ttf")  # 字体路径

class ChatPDF(FPDF):
    def __init__(self, username):
        super().__init__()
        self.username = username
        self.add_font("NotoSans", "", FONT_PATH)
        self.set_font("NotoSans", "", 10)
        self.set_auto_page_break(auto=True, margin=15)
        self.line_height = 6
        self.left_margin = 15
        self.right_margin = 15
        self.usable_width = 210 - self.left_margin - self.right_margin
        self.min_cell_height = 8
    
    def header(self):
        self.set_font("NotoSans", "", 14)
        title = self.dynamic_title if hasattr(self, "dynamic_title") else f"{self.username}聊天记录"
        self.cell(0, 10, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
    
    def footer(self):
        self.set_y(-15)
        self.set_font("NotoSans", "", 8)
        self.cell(0, 10, f"第 {self.page_no()} 页", align="C")
    
    def safe_multi_cell(self, w, h, txt, border=0, align='L', fill=False, split_only=False):
        """安全处理多语言和emoji的多行文本输出"""
        try:
            txt = unicodedata.normalize('NFKC', str(txt))
            if split_only:
                return self.multi_cell(w, h, txt, split_only=True)
            return self.multi_cell(w, h, txt, border, align, fill)
        except:
            safe_text = ''.join(c if ord(c) < 65536 else '�' for c in str(txt))
            if split_only:
                return self.multi_cell(w, h, safe_text, split_only=True)
            return self.multi_cell(w, h, safe_text, border, align, fill)

def load_clean_data(csv_path):
    """带emoji处理的CSV加载"""
    with open(csv_path, 'rb') as f:
        raw = f.read()
    
    for encoding in ['utf-8-sig', 'gb18030', 'big5']:
        try:
            df = pd.read_csv(StringIO(raw.decode(encoding)), dtype=str, keep_default_na=False)
            df.columns = df.columns.str.strip().str.lower()
            if 'created_at' in df.columns:
                df['created_at'] = pd.to_datetime(df['created_at']).dt.strftime('%Y-%m-%d %H:%M:%S UTC')
            return df
        except UnicodeDecodeError:
            continue
    raise ValueError("无法解码CSV文件")

def generate_user_pdf(username, user_data):
    """为单个用户生成PDF"""
    pdf = ChatPDF(username)
    if "created_at" in user_data.columns and not user_data.empty:
        try:
            dates = pd.to_datetime(user_data["created_at"], errors="coerce").dropna()
            if not dates.empty:
                start = dates.min().strftime("%Y%m")
                end = dates.max().strftime("%Y%m")
                pdf.dynamic_title = f"{username}聊天记录 - 六度世界聊天区（{start}-{end}）"
        except Exception:
            pass
    pdf.add_page()
    
    # 列配置
    content_width = pdf.usable_width * 0.72
    time_width = pdf.usable_width * 0.28
    
    # 表头
    pdf.set_font("NotoSans", "", 12)
    pdf.set_x(pdf.left_margin)
    pdf.cell(content_width, 8, "内容", border=1, align="C")
    pdf.cell(time_width, 8, "时间", border=1, align="C")
    pdf.ln()
    
    # 数据行处理
    pdf.set_font("NotoSans", "", 10)
    
    for _, row in user_data.iterrows():
        content = str(row.get("content", "")).strip() or ""
        time_str = str(row.get("created_at", ""))
        
        # 初始位置
        start_x = pdf.left_margin
        start_y = pdf.get_y()
        
        # 预先计算内容总行数
        lines = pdf.safe_multi_cell(content_width, pdf.line_height, content, split_only=True)
        total_lines = len(lines)
        remaining_lines = total_lines
        
        # 循环处理每一页的内容
        while remaining_lines > 0:
            # 检查是否需要新页
            if pdf.get_y() > pdf.h - 30:  # 增加底部边距预留
                pdf.add_page()
                start_y = pdf.get_y()
            
            # 计算当前页能显示的行数
            available_height = pdf.h - pdf.b_margin - start_y - 10
            lines_per_page = min(remaining_lines, int(available_height // pdf.line_height))
            
            # 提取当前页内容
            current_content = "\n".join(lines[total_lines - remaining_lines : total_lines - remaining_lines + lines_per_page])
            remaining_lines -= lines_per_page
            
            # 计算实际高度
            actual_height = max(lines_per_page * pdf.line_height, pdf.min_cell_height)
            
            # 绘制内容单元格
            pdf.set_xy(start_x, start_y)
            y_before = pdf.get_y()
            pdf.safe_multi_cell(content_width, pdf.line_height, current_content, border=1)
            y_after = pdf.get_y()
            actual_used_height = y_after - y_before
            
            # 绘制时间单元格（每页都显示完整时间）
            pdf.set_xy(start_x + content_width, start_y)
            pdf.cell(time_width, actual_used_height, time_str, border=1, align="C")
            
            # 更新位置
            start_y = y_after
            pdf.set_xy(start_x, start_y)
    
    # 保存PDF
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, f"{username}聊天记录_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf")
    pdf.output(output_path)
    return output_path

def batch_generate_pdfs():
    """批量处理所有合并后的CSV文件"""
    # 获取所有合并后的CSV文件
    csv_files = glob.glob(os.path.join(INPUT_DIR, "*.csv"))
    
    if not csv_files:
        raise FileNotFoundError(f"合并后的CSV目录中没有找到文件: {INPUT_DIR}")
    
    for csv_file in csv_files:
        try:
            print(f"\n处理文件: {os.path.basename(csv_file)}")
            df = load_clean_data(csv_file)
            
            # 按用户名分组生成PDF
            if 'username' not in df.columns:
                print("警告: CSV中缺少username列，将生成单个PDF")
                pdf_path = generate_user_pdf("合并聊天记录", df)
                print(f"生成PDF: {pdf_path}")
                continue
                
            # 获取所有用户
            users = df['username'].unique()
            print(f"找到 {len(users)} 个用户")
            
            for user in users:
                user_data = df[df['username'] == user]
                pdf_path = generate_user_pdf(user, user_data)
                print(f"已生成 {user} 的PDF: {os.path.basename(pdf_path)}")
                
        except Exception as e:
            print(f"处理文件 {os.path.basename(csv_file)} 时出错: {str(e)}")
            continue

if __name__ == "__main__":
    try:
        # 检查并提示PyFPDF冲突
        try:
            import PyFPDF
            print("警告: 检测到PyFPDF和fpdf2同时安装，建议运行以下命令解决冲突:")
            print("pip uninstall --yes pypdf && pip install --upgrade fpdf2")
            print("继续执行可能会遇到问题...\n")
        except ImportError:
            pass
        
        print("=== 批量聊天记录PDF生成 ===")
        print(f"输入目录: {INPUT_DIR}")
        print(f"输出目录: {OUTPUT_DIR}")
        
        batch_generate_pdfs()
        
        print("\n所有PDF生成完成！")
        if os.name == 'nt':  # Windows
            os.startfile(OUTPUT_DIR)
        
    except Exception as e:
        print("\n错误:", str(e))
        print("\n解决方案:")
        print("1. 确认已下载Noto字体并放在正确位置")
        print("2. 检查CSV文件是否损坏（用记事本打开确认能正常显示）")
        print("3. 尝试将CSV另存为UTF-8 BOM格式")
        print("4. 确保已卸载PyFPDF: pip uninstall PyFPDF")
        print("5. 升级fpdf2: pip install --upgrade fpdf2")
    input("\n按Enter键退出...")