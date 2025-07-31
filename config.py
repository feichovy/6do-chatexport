import os
from pathlib import Path
from datetime import datetime

# 基础路径配置
BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "exports"  # 修改为直接放在项目根目录下
DATA_DIR = BASE_DIR / "data"
FONT_PATH = str(BASE_DIR / "static" / "fonts" / "NotoSansSC-Regular.ttf")

# 默认配置
DEFAULT_CONFIG = {
    "display_name": "聊天记录",
    "description": datetime.now().strftime("%Y年%m月聊天记录"),
    "font_path": FONT_PATH,
    "columns": [
        {"name": "content", "width": 70, "title": "内容", "align": "L"},
        {"name": "created_at", "width": 30, "title": "时间", "align": "C", "date_format": "%Y-%m-%d %H:%M:%S"}
    ],
    "pdf_settings": {
        "font_size": 10,
        "line_height": 6,
        "header_font_size": 14,
        "footer_font_size": 8,
        "margin": 15,
        "page_width": 210,  # A4宽度(mm)
        "page_height": 297   # A4高度(mm)
    }
}

def get_user_config(username=None):
    """获取用户配置"""
    config = DEFAULT_CONFIG.copy()
    if username:
        config["display_name"] = f"{username}的聊天记录"
    return config