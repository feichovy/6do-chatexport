from fpdf import FPDF
import pandas as pd
from datetime import datetime
import unicodedata
from io import StringIO
import re

class PDFGenerator(FPDF):
    def __init__(self, config):
        super().__init__()
        self.config = config
        self._setup_pdf()
        
    def _setup_pdf(self):
        """初始化PDF设置"""
        self.add_font("NotoSans", "", self.config['font_path'], uni=True)
        self.set_font("NotoSans", "", self.config['pdf_settings']['font_size'])
        self.set_auto_page_break(auto=True, margin=self.config['pdf_settings']['margin'])
        self.line_height = self.config['pdf_settings']['line_height']
        self.set_margins(left=15, top=15, right=15)
        self.set_display_mode(zoom="default", layout="continuous")
        
    def header(self):
        """自定义页眉 - 添加频道名称"""
        if self.page_no() == 1:
            self.set_font("NotoSans", "", 14)
            title = f"{self.config['display_name']} - {self.config.get('channel_name', '')}"
            self.cell(0, 10, title, 0, 1, 'C')
            self.ln(5)

    def footer(self):
        """自定义页脚"""
        self.set_y(-15)
        self.set_font("NotoSans", "", self.config['pdf_settings']['footer_font_size'])
        self.cell(0, 10, f'第 {self.page_no()} 页', 0, 0, 'C')

    def generate(self, df):
        """生成PDF主逻辑"""
        self.add_page()
        
        # 计算列宽（毫米）
        total_width = self.w - self.l_margin - self.r_margin
        col_widths = [col['width'] / 100 * total_width for col in self.config['columns']]
        
        # 绘制表头
        self._draw_table_header(col_widths)
        
        # 绘制表格内容
        self._draw_table_content(df, col_widths)
        
        return self

    def _draw_table_header(self, col_widths):
        """绘制表头"""
        self.set_font("NotoSans", "", 12)
        self.set_fill_color(240, 240, 240)
        for col, width in zip(self.config['columns'], col_widths):
            self.cell(width, 10, col['title'], border=1, align=col['align'], fill=True)
        self.ln()
        self.set_font("NotoSans", "", 10)
        self.set_fill_color(255, 255, 255)

    def _draw_table_content(self, df, col_widths):
        """绘制表格内容"""
        for _, row in df.iterrows():
            self._draw_row(row, col_widths)

    def _draw_row(self, row, col_widths):
        """绘制单行数据"""
        x_start = self.get_x()
        y_start = self.get_y()
        
        # 计算行高
        max_lines = 1
        for col in self.config['columns']:
            text = self._normalize_text(row.get(col['name'], ''))
            lines = len(self.multi_cell(
                col['width'] / 100 * (self.w - self.l_margin - self.r_margin),
                self.line_height,
                text,
                split_only=True
            ))
            max_lines = max(max_lines, lines)
        
        row_height = max_lines * self.line_height
        
        # 检查分页
        if self.get_y() + row_height > self.page_break_trigger:
            self.add_page()
            self._draw_table_header(col_widths)
            y_start = self.get_y()
        
        # 绘制单元格
        for i, (col, width) in enumerate(zip(self.config['columns'], col_widths)):
            text = self._normalize_text(row.get(col['name'], ''))
            self.set_xy(x_start + sum(col_widths[:i]), y_start)
            self.multi_cell(
                width, self.line_height,
                text,
                border=1,
                align=col['align'],
                fill=False
            )
        
        self.set_xy(x_start, y_start + row_height)