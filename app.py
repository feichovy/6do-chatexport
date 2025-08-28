from flask import Flask, render_template, request, send_from_directory, redirect, url_for
from werkzeug.utils import secure_filename
from pathlib import Path
import os
import pandas as pd
from config import get_user_config, OUTPUT_DIR, DATA_DIR
from export_utils import PDFGenerator
from datetime import datetime

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = Path(__file__).parent / 'temp'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB限制
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

@app.route('/')
def index():
    csv_files = [f.name for f in DATA_DIR.glob("*.csv") if f.is_file()]
    default_config = get_user_config()
    return render_template("index.html", csv_files=csv_files, default_config=default_config)

@app.route('/export', methods=['POST'])
def export():
    try:
        selected_file = request.form.get('csv_file')
        custom_title = request.form.get('custom_title', '').strip()
        
        if not selected_file:
            raise ValueError("请选择CSV文件")
        
        csv_path = DATA_DIR / selected_file
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV文件不存在: {csv_path}")
        
        username = Path(selected_file).stem
        
        # 加载数据以获取channel_name
        df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
        df.columns = df.columns.str.strip().str.lower()
        
        # 获取频道名称（从第一行获取）
        channel_name = df['channel_name'].iloc[0] if 'channel_name' in df.columns else ''
        
        config = get_user_config(username)
        config['csv_path'] = str(csv_path)
        config['channel_name'] = channel_name  # 添加频道名称到配置
        
        if custom_title:
            config['display_name'] = custom_title
        
        generator = PDFGenerator(config)
        
        # 处理时间字段
        if 'created_at' in df.columns:
            try:
                df['created_at'] = pd.to_datetime(df['created_at']).dt.strftime('%Y-%m-%d %H:%M:%S')
            except Exception as e:
                app.logger.warning(f"时间格式转换失败: {str(e)}")
                df['created_at'] = df['created_at'].astype(str)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_filename = f"{username}_chat_export_{timestamp}.pdf"
        output_path = OUTPUT_DIR / output_filename
        
        # 生成PDF并保存
        pdf = generator.generate(df)
        pdf.output(str(output_path))
        
        return send_from_directory(
            directory=OUTPUT_DIR,
            path=output_filename,
            as_attachment=True,
            mimetype='application/pdf'
        )
        
    except Exception as e:
        app.logger.error(f"导出失败: {str(e)}", exc_info=True)
        return render_template("error.html", error=str(e)), 400

if __name__ == '__main__':
    app.run(debug=True)
