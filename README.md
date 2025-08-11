# 六度世界聊天记录处理工具

## 工作流概述

本工具集包含三个Python脚本，用于从6do.world论坛抓取聊天记录、按用户整理数据并生成PDF文件。完整工作流如下：

1. **数据抓取**：`extract_chat_from_forum.py` - 从指定论坛帖子抓取聊天记录
2. **用户筛选**：`extract_multi_user.py` - 按用户筛选并合并聊天记录
3. **PDF生成**：`format_final.py` - 为每个用户生成PDF格式的聊天记录

## 文件结构
G:\6do项目
├── CSV输入/ # 原始抓取的聊天记录CSV
├── CSV合并输出/ # 按用户合并后的CSV
├── PDF输出/ # 最终生成的PDF文件
├── fonts/ # 字体文件目录
│ └── NotoSansSC-Regular.ttf
├── extract_chat_from_forum.py
├── extract_multi_user.py
└── format_final.py

实际目录可以根据使用情况修改，但是必须保证结构如上，并且同步修改3个py文件里面的路径

## 使用说明

### 1. 数据抓取工具 (extract_chat_from_forum.py)

**功能**：从6do.world论坛抓取聊天记录并保存为CSV

**使用方法**：
 
 请先根据实际帖子修改BASE_URL和MAX_PAGES，然后Ctrl+S保存运行

 python extract_chat_from_forum.py

 输出：

 文件保存到 CSV输入 目录

 文件名格式：六度世界聊天区YYYYMM.csv（单月情况） 或 六度世界聊天区YYYYMM-YYYYMM.csv（跨月情况）

 特点：

 自动识别多种日期格式（年月、季度、中文月份等）

 多线程抓取提高效率

 自动去重处理

### 2. 用户筛选工具 (extract_multi_user.py)

**功能**：从原始CSV中筛选指定用户的聊天记录

**使用方法**：

 python extract_multi_user.py 用户名1 用户名2 ...

 文件保存到 CSV合并输出 目录

 文件名格式：用户名聊天记录YYYYMMDD-YYYYMMDD.csv

 特点：

 支持多用户同时处理

 自动合并多个输入文件

 保留原始用户名大小写

 按时间排序记录

### 3. PDF生成工具 (format_final.py)

**功能**：将用户聊天记录CSV转换为PDF

**使用方法**：

 python format_final.py

 输出：

 文件保存到 PDF输出 目录

 文件名格式：用户名聊天记录_YYYYMMDD_HHMMSS.pdf

 特点：

 自动分页处理长内容

 支持中文和特殊字符

 包含时间戳和页码

 批量处理所有用户

## 配置说明

 所有脚本共享以下基础配置（位于各文件顶部）：

 BASE_DIR = r"G:\6do项目"  # 项目根目录，根据情况修改

 各脚本独立配置：

 MAX_WORKERS：线程池大小（数据抓取）

 FONT_PATH：PDF使用字体路径（PDF生成）

## 常见问题解决

 编码问题：

 确保CSV文件使用UTF-8 BOM编码

 如果遇到乱码，尝试修改safe_read_csv中的编码顺序

 PDF生成问题：

 确认已安装正确字体文件

 卸载冲突的PyFPDF包：pip uninstall PyFPDF

 更新fpdf2：pip install --upgrade fpdf2

 抓取失败：

 检查网络连接

 调整请求超时时间（默认15秒）

 验证论坛页面结构是否变化

## 依赖安装

 pip install requests beautifulsoup4 pandas fpdf2

## 注意事项

 首次使用前请创建所需目录结构

 确保字体文件已放置在正确位置

 大量数据抓取时请合理设置线程数(MAX_WORKERS)


 建议定期清理中间文件(CSV输入和CSV合并输出)



