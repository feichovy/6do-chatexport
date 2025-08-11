import os, requests, csv, time, re
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

# ===== 配置区域 =====
BASE_DIR = r"G:\6do项目"
INPUT_DIR = os.path.join(BASE_DIR, "CSV输入")  # 输出到CSV输入文件夹

BASE_URL = "https://6do.world/t/topic/119089"  # 论坛备份帖的网址可替换
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/115.0.0.0 Safari/537.36"
}
MAX_PAGES = 112  # 需要手动修改备份帖的楼层
MAX_WORKERS = 10  # 并发线程数，可调节
# ====================

def fetch_page(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"请求失败: {url}，原因: {e}")
        return None

def extract_post_title_and_yyyymm(html):
    """
    从帖子标题提取时间信息，支持多种日期格式：
    1. 基础格式：202306, 2023-06, 2023年6月, 2023.06
    2. 范围格式：2023年6月至8月, 2023.06-2023.08
    3. 季度格式：2023年Q2, 2023年第二季度
    4. 中文月份：2023年六月, 2023年6月
    5. 跨年范围：2023年12月-2024年1月
    """
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.string if soup.title else ""
    # print(f"原始标题: {title}")  # 可开启调试
    
    yyyymm_list = []
    month_map = {
        '一月': '01', '二月': '02', '三月': '03', '四月': '04',
        '五月': '05', '六月': '06', '七月': '07', '八月': '08',
        '九月': '09', '十月': '10', '十一月': '11', '十二月': '12',
        '1月': '01', '2月': '02', '3月': '03', '4月': '04',
        '5月': '05', '6月': '06', '7月': '07', '8月': '08',
        '9月': '09', '10月': '10', '11月': '11', '12月': '12'
    }
    
    # 1. 匹配连续6位数字格式 (202306)
    yyyymm_list += re.findall(r"(?<!\d)(\d{6})(?!\d)", title)
    
    # 2. 匹配带分隔符的年月 (2023-06, 2023.06, 2023/06, 2023年06月)
    separators = r"[年\-./]"
    pattern = fr"(?<!\d)(\d{{4}}){separators}(\d{{1,2}})(?:月)?(?!\d)"
    matches = re.findall(pattern, title)
    for year, month in matches:
        yyyymm_list.append(f"{year}{month.zfill(2)}")
    
    # 3. 匹配中文月份 (2023年六月)
    # 优化正则，严格匹配月份词
    cn_pattern = r"(?<!\d)(\d{4})年(十?一?二?月|一月|二月|三月|四月|五月|六月|七月|八月|九月|十月|十一月|十二月)"
    cn_matches = re.findall(cn_pattern, title)
    for year, cn_month in cn_matches:
        if cn_month in month_map:
            yyyymm_list.append(f"{year}{month_map[cn_month]}")
    
    # 4. 处理月份范围
    range_patterns = [
        fr"(\d{{4}}){separators}(\d{{1,2}})(?:月)?至(\d{{1,2}})月",
        fr"(\d{{4}}){separators}(\d{{1,2}})(?:月)?-(\d{{1,2}})(?:月)?",
        fr"(\d{{4}}){separators}(\d{{1,2}})(?:月)?到(\d{{1,2}})(?:月)?",
        fr"(\d{{4}})(\d{{2}})-(\d{{4}})(\d{{2}})",
        fr"(\d{{4}}){separators}(\d{{1,2}})(?:月)?\s*[-~]\s*(\d{{4}}){separators}(\d{{1,2}})(?:月)?"
    ]
    for pattern in range_patterns:
        range_matches = re.findall(pattern, title)
        for match in range_matches:
            if len(match) == 3:
                year, start_month, end_month = match
                for m in range(int(start_month), int(end_month) + 1):
                    yyyymm_list.append(f"{year}{str(m).zfill(2)}")
            elif len(match) == 4:
                start_year, start_month, end_year, end_month = match
                start_date = pd.to_datetime(f"{start_year}{start_month.zfill(2)}", format="%Y%m")
                end_date = pd.to_datetime(f"{end_year}{end_month.zfill(2)}", format="%Y%m")
                current = start_date
                while current <= end_date:
                    yyyymm_list.append(current.strftime("%Y%m"))
                    current += pd.DateOffset(months=1)
    
    # 5. 处理季度格式
    quarter_patterns = [
        r"(\d{4})年[第]?([一二三四1234])季度",
        r"(\d{4})年[Qq]([1234])"
    ]
    quarter_map = {'一': '1', '二': '2', '三': '3', '四': '4'}
    quarters = {
        '1': ['01', '02', '03'],
        '2': ['04', '05', '06'],
        '3': ['07', '08', '09'],
        '4': ['10', '11', '12']
    }
    for pattern in quarter_patterns:
        q_matches = re.findall(pattern, title)
        for year, q in q_matches:
            quarter_num = quarter_map.get(q, q)
            for month in quarters.get(quarter_num, []):
                yyyymm_list.append(f"{year}{month}")
    
    # 去重并排序
    yyyymm_list = sorted(list(set(yyyymm_list)))
    
    if not yyyymm_list:
        yyyymm = "未知时间"
    elif len(yyyymm_list) == 1:
        yyyymm = yyyymm_list[0]
    else:
        # 用月份差判断连续性
        def month_diff(d1, d2):
            return (d2.year - d1.year) * 12 + (d2.month - d1.month)
        
        is_continuous = True
        dates = [pd.to_datetime(x, format="%Y%m") for x in yyyymm_list]
        for i in range(1, len(dates)):
            if month_diff(dates[i-1], dates[i]) > 1:
                is_continuous = False
                break
        
        if is_continuous:
            yyyymm = f"{yyyymm_list[0]}-{yyyymm_list[-1]}"
        else:
            yyyymm = f"{yyyymm_list[0]}_等多个月份"
    
    # print(f"提取的时间信息: {yyyymm}")  # 可开启调试
    return title, yyyymm


def parse_chat_transcripts(html):
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")
    chat_divs = soup.find_all("div", class_="chat-transcript")
    records = []
    for chat in chat_divs:
        message_id = chat.get("data-message-id", "")
        username = chat.get("data-username", "")
        datetime = chat.get("data-datetime", "")
        messages_div = chat.find("div", class_="chat-transcript-messages")
        content = messages_div.get_text(separator="\n", strip=True) if messages_div else ""
        records.append({
            "message_id": message_id,
            "username": username,
            "channel_name": "",
            "content": content,
            "created_at": datetime.replace("T", " ").replace("Z", " UTC")
        })
    return records

def deduplicate_records(records):
    seen = set()
    unique = []
    for r in records:
        mid = r["message_id"]
        if mid and mid not in seen:
            seen.add(mid)
            unique.append(r)
    return unique

def fetch_and_parse_page(floor):
    url = BASE_URL if floor == 1 else f"{BASE_URL}/{floor}"
    print(f"开始抓取楼层 {floor}: {url}")
    html = fetch_page(url)
    records = parse_chat_transcripts(html)
    print(f"楼层 {floor} 抓取到 {len(records)} 条聊天消息")
    return records

def main():
    print(f"开始抓取首页以获取标题和时间信息: {BASE_URL}")
    first_page_html = fetch_page(BASE_URL)
    if not first_page_html:
        print("首页请求失败，无法继续")
        return

    title, yyyymm = extract_post_title_and_yyyymm(first_page_html)
    print(f"帖子标题: {title}")
    print(f"提取时间: {yyyymm}")

    # 确保输出目录存在
    os.makedirs(INPUT_DIR, exist_ok=True)
    output_file = os.path.join(INPUT_DIR, f"六度世界聊天区{yyyymm}.csv")

    all_records = []
    # 先解析首页
    all_records.extend(parse_chat_transcripts(first_page_html))

    # 多线程抓取剩余楼层
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(fetch_and_parse_page, floor) for floor in range(2, MAX_PAGES + 1)]
        for future in as_completed(futures):
            floor_records = future.result()
            all_records.extend(floor_records)

    print(f"抓取总计 {len(all_records)} 条消息，开始去重...")
    all_records = deduplicate_records(all_records)
    print(f"去重后剩余 {len(all_records)} 条消息，保存到CSV...")

    with open(output_file, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["message_id", "username", "channel_name", "content", "created_at"])
        writer.writeheader()
        writer.writerows(all_records)

    print(f"✅ 文件已保存：{output_file}")

if __name__ == "__main__":
    main()