import requests, time, re, os, csv, random
import pandas as pd
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque


# ===== 配置区域 =====

# --- 基础路径设置 ---
BASE_URL = "https://6do.world/t/topic/754330"  # 论坛帖子 URL，可修改
BASE_DIR = r"G:\6do项目"
INPUT_DIR = os.path.join(BASE_DIR, "CSV输入")       # CSV 输出目录
os.makedirs(INPUT_DIR, exist_ok=True)

# --- 请求相关设置 ---
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/115.0.0.0 Safari/537.36"
}
TIMEOUT = 15                # 单次请求超时时间（秒）
REQUEST_INTERVAL = 2.0      # 正常请求间隔（秒）
MAX_RETRIES = 3             # 单个楼层请求最大重试次数
MAX_WORKERS = 8             # 并发线程数（抓取楼层时使用）

# --- 限速与退避策略 ---
BACKOFF_BASE_DELAY = 5      # 触发 429 时的基准退避时间（秒）
BACKOFF_MAX_DELAY = 60      # 动态退避最大时间（秒）
RETRY_EXTRA_DELAY = 10      # 补抓时的额外延迟（秒），避免和正常抓取冲突

# --- 自动补抓 ---
MAX_SUPPLEMENT_ROUNDS = 3   # 自动补抓的最大轮数

# --- 楼层自动探测参数 ---
STAGE1_MAX = 1000           # Stage1 顺序探测最大楼层数
STOP_ON_EMPTY = 5           # Stage1 连续空页数阈值
TAIL_MAX = 100              # Stage2 尾部确认最大检查页数
TAIL_STOP_EMPTY = 5         # Stage2 连续空页数阈值
PROGRESS_EVERY = 10         # 每 N 页输出一次进度
MIN_ACCEPT = 10             # 检测结果小于此值 → 提示人工确认
MAX_ACCEPT = 2000           # 检测结果大于此值 → 提示人工确认

# ====================

def sanitize_filename(name: str) -> str:
    """清理文件名中不合法或多余字符，只保留中英文、数字和部分符号"""
    # 去除 emoji 等非 BMP 字符
    name = re.sub(r"[\U00010000-\U0010ffff]", "", name)
    # 去掉不需要的符号
    name = re.sub(r"[\\/:*?\"<>|]", "", name)
    # 去掉多余空格
    name = re.sub(r"\s+", "", name)
    # 可选：只保留中英文、数字、横线、下划线
    name = re.sub(r"[^0-9A-Za-z\u4e00-\u9fa5\-_]", "", name)
    return name

def simplify_title_for_filename(title: str) -> str:
    """
    从帖子标题提取主要部分，生成标准化文件名
    例如：
    六度世界聊天区202508 总备份 - 🧗🏻‍♀️资深网友讨论区 - 六度世界
    → 六度世界聊天区202508
    """
    # 先清理 emoji 和特殊符号
    title = re.sub(r"[\U00010000-\U0010ffff]", "", title)
    title = re.sub(r"[\\/:*?\"<>|]", "", title)
    title = re.sub(r"\s+", " ", title).strip()

    # 如果标题里有“六度世界聊天区”，优先提取它及后面的年月
    m = re.search(r"(六度世界聊天区\s*\d{6}(?:[-–]\d{6})?)", title)
    if m:
        return m.group(1).replace(" ", "")

    # 如果找不到，则退化为前20个字符
    return title[:20].replace(" ", "")


def fetch_page(url, session=None, is_retry=False):
    """
    抓取页面，支持限流动态退避 + 多次重试
    """
    if session is None:
        session = requests.Session()
    delay = REQUEST_INTERVAL
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            time.sleep(delay)
            response = session.get(url, timeout=TIMEOUT, headers=HEADERS)

            if response.status_code == 200:
                return response.text

            if response.status_code == 429:
                backoff_time = min(BACKOFF_BASE_DELAY * (2 ** (attempt - 1)), BACKOFF_MAX_DELAY)
                print(f"请求失败({attempt}/{MAX_RETRIES}): {url}，原因: 429 Too Many Requests，退避 {backoff_time} 秒")
                time.sleep(backoff_time)
                continue

            response.raise_for_status()
            return response.text

        except Exception as e:
            print(f"请求失败({attempt}/{MAX_RETRIES}): {url}，原因: {e}")
            backoff_time = min(BACKOFF_BASE_DELAY * (2 ** (attempt - 1)), BACKOFF_MAX_DELAY)
            time.sleep(backoff_time)

    if not is_retry:
        print(f"⚠️ {url} 多次失败，交给补抓处理")
    return None

def fetch_all_floors(base_url, max_floor):
    pending = deque(range(1, max_floor+1))
    results = {}

    while pending:
        floor = pending.popleft()
        url = f"{base_url}/{floor}"
        html = fetch_page(url)

        if html:
            results[floor] = parse_chat_transcripts(html)
        else:
            print(f"❌ 楼层 {floor} 抓取失败，将稍后重试")
            pending.append(floor)   # 加回队列尾部

        time.sleep(REQUEST_INTERVAL)  # 控制间隔

    return results

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
    """解析聊天消息（自动清理用户名前缀）"""
    soup = BeautifulSoup(html, "html.parser")
    records = []

    for div in soup.find_all("div", class_="chat-transcript"):
        mid = div.get("data-message-id")
        username = div.get("data-username", "").strip()
        created_at = div.get("data-datetime")
        channel = div.get("data-channel-name", "未知频道")

        # 尝试获取纯消息内容
        # 优先找 message 区块，否则取整个文本
        msg_div = div.find("div", class_="chat-transcript-message")
        if msg_div:
            content = msg_div.get_text(separator="", strip=True)
        else:
            content = div.get_text(separator="", strip=True)

        # 清理与用户名重复的前缀
        if username and content.startswith(username):
            content = content[len(username):].lstrip(" ：: ")  # 去掉全角/半角冒号与空格

        # 去掉空消息
        if not content:
            continue

        records.append({
            "message_id": mid,
            "username": username,
            "channel_name": channel,
            "content": content,
            "created_at": created_at
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

def get_max_floors(base_url):
    print("正在自动检测最大楼层数（Stage1）...")
    seen_ids = set()
    last_floor_with_new_ids = 1
    floor = 1
    consecutive_empty = 0

    # Stage 1
    while True:
        test_url = base_url if floor == 1 else f"{base_url}/{floor}"
        html = fetch_page(test_url)
        if not html:
            print(f"探测中断：第 {floor} 页无法获取或返回空内容，停止 Stage1")
            break
        records = parse_chat_transcripts(html)
        ids = {r["message_id"] for r in records if r.get("message_id")}
        if not ids:
            consecutive_empty += 1
            if consecutive_empty >= STOP_ON_EMPTY:
                print(f"Stage1: 连续 {STOP_ON_EMPTY} 页无有效消息，停止 Stage1 探测")
                break
        else:
            consecutive_empty = 0
            new_ids = ids - seen_ids
            if new_ids:
                last_floor_with_new_ids = floor
            seen_ids.update(ids)
        if floor % PROGRESS_EVERY == 0:
            print(f"Stage1 已探测到第 {floor} 页，当前 last_new_floor={last_floor_with_new_ids}")
        floor += 1
        if floor > STAGE1_MAX:
            print(f"达到 Stage1 上限 {STAGE1_MAX}，停止 Stage1")
            break

    print(f"Stage1 完成，记录到最后出现新消息的楼层: {last_floor_with_new_ids}")

    # Stage 2
    print("开始尾部确认（Stage2）...")
    consecutive_no_new = 0
    check_floor = last_floor_with_new_ids + 1
    tail_checked = 0
    while tail_checked < TAIL_MAX:
        test_url = f"{base_url}/{check_floor}"
        html = fetch_page(test_url)
        if not html:
            consecutive_no_new += 1
            if consecutive_no_new >= TAIL_STOP_EMPTY:
                print(f"Stage2: 连续 {TAIL_STOP_EMPTY} 页无法获取或无新数据，停止")
                break
        else:
            records = parse_chat_transcripts(html)
            ids = {r["message_id"] for r in records if r.get("message_id")}
            new_ids = ids - seen_ids if ids else set()
            if new_ids:
                last_floor_with_new_ids = check_floor
                seen_ids.update(ids)
                consecutive_no_new = 0
                print(f"Stage2: 在第 {check_floor} 页发现新消息，更新 last_floor={last_floor_with_new_ids}")
            else:
                consecutive_no_new += 1
                if consecutive_no_new >= TAIL_STOP_EMPTY:
                    print(f"Stage2: 连续 {TAIL_STOP_EMPTY} 页无新数据，停止")
                    break
        check_floor += 1
        tail_checked += 1

    print(f"Stage2 完成，最终检测到最大楼层: {last_floor_with_new_ids}")

    if last_floor_with_new_ids < MIN_ACCEPT or last_floor_with_new_ids > MAX_ACCEPT:
        try:
            user_input = input(f"检测结果可能异常（{last_floor_with_new_ids}），请输入楼层数或回车接受自动结果: ").strip()
            if user_input:
                manual_val = int(user_input)
                print(f"使用人工输入楼层数: {manual_val}")
                return manual_val
        except Exception:
            pass

    return last_floor_with_new_ids

def crawl_post(base_url):
    print(f"开始抓取首页以获取标题和时间信息: {base_url}")
    first_page_html = fetch_page(base_url)
    if not first_page_html:
        print(f"[{base_url}] 首页请求失败，跳过")
        return

    soup = BeautifulSoup(first_page_html, "html.parser")
    title = soup.title.string if soup.title else "未命名"

    # 生成标准格式文件名
    clean_title = simplify_title_for_filename(title)
    output_name = sanitize_filename(clean_title) + ".csv"
    output_file = os.path.join(INPUT_DIR, output_name)

    # 自动探测楼层
    max_floors = get_max_floors(base_url)

    # 第一次抓取
    all_records = parse_chat_transcripts(first_page_html)
    fetched_floors = {1} if all_records else set()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_and_parse_page, base_url, floor): floor
                   for floor in range(2, max_floors + 1)}
        for future in as_completed(futures):
            floor = futures[future]
            floor_records = future.result()
            if floor_records:
                fetched_floors.add(floor)
                all_records.extend(floor_records)

    # 自动补抓缺失楼层
    missing_floors = set(range(1, max_floors + 1)) - fetched_floors
    round_num = 1
    while missing_floors and round_num <= MAX_SUPPLEMENT_ROUNDS:
        print(f"开始第 {round_num} 轮补抓，缺失楼层数: {len(missing_floors)}")
        new_fetched = set()
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(fetch_and_parse_page, base_url, floor): floor
                       for floor in missing_floors}
            for future in as_completed(futures):
                floor = futures[future]
                floor_records = future.result()
                if floor_records:
                    new_fetched.add(floor)
                    all_records.extend(floor_records)
        missing_floors -= new_fetched
        print(f"第 {round_num} 轮补抓完成，剩余缺失楼层: {len(missing_floors)}")
        round_num += 1

    if missing_floors:
        print(f"⚠️ 最终仍有 {len(missing_floors)} 个楼层缺失: {sorted(missing_floors)}")

    # 去重
    all_records = deduplicate_records(all_records)

    # 输出
    with open(output_file, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["message_id", "username", "channel_name", "content", "created_at"])
        writer.writeheader()
        writer.writerows(all_records)

    print(f"[{title}] 抓取完成，共 {len(all_records)} 条消息，已保存到 {output_file}")

def fetch_and_parse_page(base_url, floor, session=None, is_retry=False):
    """抓取并解析单个楼层"""
    url = base_url if floor == 1 else f"{base_url}/{floor}"
    html = fetch_page(url, session=session, is_retry=is_retry)
    return parse_chat_transcripts(html) if html else []

if __name__ == "__main__":
    crawl_post(BASE_URL)
