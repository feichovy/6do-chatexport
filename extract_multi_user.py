# -*- coding: utf-8 -*-
import pandas as pd
import os
import glob
import sys
from datetime import datetime

# ===== 配置区域 =====
BASE_DIR = r"G:\6do项目"
INPUT_DIR = os.path.join(BASE_DIR, "CSV输入")       # 备份CSV所在文件夹
OUTPUT_DIR = os.path.join(BASE_DIR, "CSV合并输出")  # 用户独立CSV输出文件夹
FILE_PATTERN = "六度世界聊天区*.csv"       # 备份文件名匹配模式
# ====================

def safe_read_csv(file_path):
    """安全读取CSV文件，自动检测常见编码"""
    encodings = ['utf-8', 'utf-8-sig', 'gbk', 'gb18030', 'big5']
    for encoding in encodings:
        try:
            df = pd.read_csv(file_path, encoding=encoding)
            print(f"✅ 成功读取: {os.path.basename(file_path)} (编码: {encoding}, {len(df)} 条)")
            return df
        except UnicodeDecodeError:
            continue
    raise ValueError(f"❌ 无法解码文件: {file_path}")

def merge_all_csv(input_dir, pattern):
    """批量读取并合并所有CSV"""
    csv_files = glob.glob(os.path.join(input_dir, pattern))
    if not csv_files:
        raise FileNotFoundError(f"目录 {input_dir} 中没有匹配 {pattern} 的CSV文件")

    dfs = []
    for file in csv_files:
        try:
            df = safe_read_csv(file)
            df.columns = df.columns.str.strip()
            df = df.applymap(lambda x: x.strip() if isinstance(x, str) else x)
            dfs.append(df)
        except Exception as e:
            print(f"⚠ 跳过 {file} - {e}")

    if not dfs:
        raise ValueError("没有有效的CSV文件可合并")

    merged_df = pd.concat(dfs, ignore_index=True)

    # 去重
    if 'message_id' in merged_df.columns:
        before = len(merged_df)
        merged_df = merged_df.drop_duplicates(subset=['message_id'], keep='first')
        print(f"🔍 去重完成: 删除 {before - len(merged_df)} 条重复记录")

    # 排序
    if 'created_at' in merged_df.columns:
        merged_df['created_at'] = pd.to_datetime(merged_df['created_at'], errors='coerce')
        merged_df = merged_df.sort_values('created_at')

    return merged_df

def extract_users(df, users, output_dir):
    """按用户提取并保存CSV（匹配忽略大小写，但文件名保留原大小写）"""
    os.makedirs(output_dir, exist_ok=True)

    # === 大小写统一用于匹配 ===
    if 'username' in df.columns:
        df['username'] = df['username'].str.lower()

    # 循环处理用户
    for original_user in users:  # original_user 保留原大小写
        user_lower = original_user.lower()  # 转小写用于匹配

        user_df = df[df['username'] == user_lower].copy()

        if user_df.empty:
            print(f"⚠ 用户 {original_user} 没有找到记录")
            continue

        if 'created_at' in user_df.columns:
            user_df.sort_values('created_at', inplace=True)

        # 自动加时间范围
        date_min = user_df['created_at'].min().strftime('%Y%m%d') if 'created_at' in user_df else ''
        date_max = user_df['created_at'].max().strftime('%Y%m%d') if 'created_at' in user_df else ''

        # === 修改点：输出文件名用 original_user 保留原大小写 ===
        output_file = os.path.join(output_dir, f"{original_user}聊天记录{date_min}-{date_max}.csv")

        user_df.to_csv(output_file, index=False, encoding='utf-8-sig')
        print(f"📄 用户 {original_user} 已导出 -> {output_file} ({len(user_df)} 条)")

if __name__ == "__main__":
    print("=== 批量合并 + 按用户提取工具 ===")
    print(f"📂 输入目录: {INPUT_DIR}")
    print(f"📂 输出目录: {OUTPUT_DIR}")

    # 从命令行读取用户名
    if len(sys.argv) < 2:
        print("\n❌ 请输入至少一个用户名，例如：")
        print(f"python {os.path.basename(__file__)} 用户1 用户2")
        sys.exit(1)

    target_users = sys.argv[1:]  # 获取所有参数作为用户名列表
    print(f"🎯 目标用户: {', '.join(target_users)}")

    try:
        merged_df = merge_all_csv(INPUT_DIR, FILE_PATTERN)
        extract_users(merged_df, target_users, OUTPUT_DIR)
    except Exception as e:
        print(f"❌ 出错: {e}")

    input("\n按 Enter 退出...")
