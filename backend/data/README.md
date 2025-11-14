## 请在此文件夹存放爬虫导出的csv

# 爬虫脚本：extract_chat_from_forum.py
使用方法：
1. 用IDE打开该脚本，修改"BASE_URL"的值，将需要的聊天记录备份贴网址复制进去
2. 修改基本路径"BASE_DIR"为后端文件夹backend和文档输出路径"INPUT_DIR"内的...为data，即：INPUT_DIR = os.path.join(BASE_DIR, "...") （推荐）
3. 保存并使用IDE运行

稍等片刻，爬虫会自动爬取对应网址备份的聊天记录并且生成csv文件
