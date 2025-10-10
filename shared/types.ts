export interface ExportRequest {
    username: string;
    start_date: string;
    end_date: string;
    channel_name?: string;
}

export interface ExportResponse {
    status: 'success' | 'error';
    message?: string;
    download_url?: string;
}

export interface DateRangeResponse {
    status: 'success' | 'error';
    min_date?: string;
    max_date?: string;
    message?: string;
}

export interface PDFConfig {
    display_name: string;
    description: string;
    font_path: string;
    columns: Array<{
        name: string;
        width: number;
        title: string;
        align: 'L' | 'C' | 'R';
        date_format?: string;
    }>;
    pdf_settings: {
        font_size: number;
        line_height: number;
        header_font_size: number;
        footer_font_size: number;
        margin: number;
        page_width: number;
        page_height: number;
    };
    channel_name?: string;
}