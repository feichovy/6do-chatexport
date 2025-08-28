from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
import os
import pandas as pd
from datetime import datetime
from export_utils import PDFGenerator
from config import get_user_config
import json

app = Flask(__name__)
CORS(app)

# 配置
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB限制
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
EXPORT_DIR = os.path.join(BASE_DIR, "exports")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

@app.route('/api/export-chat', methods=['POST'])
def export_chat():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "请求体为空"}), 400

        username = data.get("username")
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        channel_name = data.get("channel_name", "六度世界聊天区")

        if not all([username, start_date, end_date]):
            return jsonify({"status": "error", "message": "缺少参数"}), 400

        # 查找所有CSV文件
        csv_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.csv')]
        if not csv_files:
            return jsonify({"status": "error", "message": "没有可用的聊天记录数据"}), 404

        # 合并CSV文件
        dfs = []
        for csv_file in csv_files:
            try:
                df = pd.read_csv(os.path.join(DATA_DIR, csv_file), encoding='utf-8-sig')
                df.columns = df.columns.str.strip().str.lower()
                dfs.append(df)
            except Exception as e:
                print(f"读取文件 {csv_file} 时出错: {str(e)}")
                continue

        if not dfs:
            return jsonify({"status": "error", "message": "无法读取任何CSV文件"}), 500

        merged_df = pd.concat(dfs, ignore_index=True)
        
        # 筛选指定用户的数据
        user_df = merged_df[merged_df['username'].str.lower() == username.lower()]
        if user_df.empty:
            return jsonify({"status": "error", "message": "该用户没有聊天记录"}), 404

        # 转换日期格式并筛选日期范围
        user_df['created_at'] = pd.to_datetime(user_df['created_at'], errors='coerce')
        user_df = user_df.dropna(subset=['created_at'])
        
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        user_df = user_df[(user_df['created_at'] >= start_dt) & 
                         (user_df['created_at'] <= end_dt)]
        
        if user_df.empty:
            return jsonify({"status": "error", "message": "指定日期范围内无记录"}), 404

        # 生成PDF
        config = get_user_config(username)
        config['channel_name'] = channel_name
        
        pdf_generator = PDFGenerator(config)
        pdf = pdf_generator.generate(user_df)
        
        # 保存PDF文件
        filename = f"{username}_chat_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        filepath = os.path.join(EXPORT_DIR, filename)
        pdf.output(filepath)
        
        return jsonify({
            "status": "success",
            "message": "PDF生成成功",
            "download_url": f"/api/download/{filename}"
        })
        
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/download/<filename>')
def download_file(filename):
    try:
        return send_file(
            os.path.join(EXPORT_DIR, filename),
            as_attachment=True,
            download_name=filename
        )
    except FileNotFoundError:
        return jsonify({"status": "error", "message": "文件不存在"}), 404

@app.route('/api/available-dates')
def get_available_dates():
    """获取数据中可用的日期范围"""
    try:
        csv_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.csv')]
        if not csv_files:
            return jsonify({"status": "error", "message": "没有可用的数据"}), 404
            
        # 读取第一个CSV文件获取日期范围
        df = pd.read_csv(os.path.join(DATA_DIR, csv_files[0]), encoding='utf-8-sig')
        df.columns = df.columns.str.strip().str.lower()
        
        if 'created_at' not in df.columns:
            return jsonify({"status": "error", "message": "CSV文件格式不正确"}), 500
            
        df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
        df = df.dropna(subset=['created_at'])
        
        min_date = df['created_at'].min().strftime('%Y-%m-%d')
        max_date = df['created_at'].max().strftime('%Y-%m-%d')
        
        return jsonify({
            "status": "success",
            "min_date": min_date,
            "max_date": max_date
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)