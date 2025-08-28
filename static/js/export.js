class ChatExport {
    constructor() {
        this.modal = null;
        this.init();
    }

    init() {
        // 创建导出按钮
        this.createExportButton();
        
        // 监听Discourse用户登录状态变化
        this.observeUserState();
    }

    createExportButton() {
        // 在用户菜单中添加导出按钮
        const observer = new MutationObserver(() => {
            const userMenu = document.querySelector('.user-menu');
            if (userMenu && !userMenu.querySelector('.chat-export-btn')) {
                const exportBtn = document.createElement('li');
                exportBtn.className = 'chat-export-btn';
                exportBtn.innerHTML = `
                    <a href="#" class="btn">
                        <span class="d-icon d-icon-download"></span>
                        ${I18n.t('export_chat.title')}
                    </a>
                `;
                exportBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showExportModal();
                });
                userMenu.appendChild(exportBtn);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    observeUserState() {
        // 监听用户登录状态
        const appEvents = require('discourse-common/lib/app-events').default;
        appEvents.on('current-user:changed', (user) => {
            if (user) {
                this.currentUser = user;
            }
        });
    }

    async showExportModal() {
        if (!this.currentUser) {
            this.showError('请先登录');
            return;
        }

        // 获取可用日期范围
        try {
            const response = await fetch('/api/available-dates');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.renderModal(data.min_date, data.max_date);
            } else {
                this.showError('无法获取日期范围: ' + data.message);
            }
        } catch (error) {
            this.showError('网络错误: ' + error.message);
        }
    }

    renderModal(minDate, maxDate) {
        // 创建模态框
        this.modal = document.createElement('div');
        this.modal.className = 'chat-export-modal';
        this.modal.innerHTML = `
            <div class="modal-container">
                <div class="modal-header">
                    <h3>${I18n.t('export_chat.title')}</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>${I18n.t('export_chat.date_range')}</label>
                        <div class="date-range">
                            <input type="date" id="start-date" min="${minDate}" max="${maxDate}" value="${minDate}">
                            <span>至</span>
                            <input type="date" id="end-date" min="${minDate}" max="${maxDate}" value="${maxDate}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>${I18n.t('export_chat.channel')}</label>
                        <input type="text" id="channel-name" value="六度世界聊天区">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="export-submit">${I18n.t('export_chat.export_btn')}</button>
                    <button class="btn btn-cancel">${I18n.t('cancel')}</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);

        // 添加事件监听
        this.modal.querySelector('.close-btn').addEventListener('click', () => this.hideModal());
        this.modal.querySelector('.btn-cancel').addEventListener('click', () => this.hideModal());
        this.modal.querySelector('#export-submit').addEventListener('click', () => this.submitExport());
    }

    hideModal() {
        if (this.modal) {
            document.body.removeChild(this.modal);
            this.modal = null;
        }
    }

    async submitExport() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const channelName = document.getElementById('channel-name').value;

        if (!startDate || !endDate) {
            this.showError('请选择日期范围');
            return;
        }

        try {
            const response = await fetch('/api/export-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: this.currentUser.username,
                    start_date: startDate,
                    end_date: endDate,
                    channel_name: channelName
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.hideModal();
                this.downloadPDF(data.download_url);
            } else {
                this.showError('导出失败: ' + data.message);
            }
        } catch (error) {
            this.showError('网络错误: ' + error.message);
        }
    }

    downloadPDF(url) {
        // 创建隐藏的iframe来触发下载
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        
        // 清理iframe
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    }

    showError(message) {
        // 使用Discourse的通知系统显示错误
        if (window.Discourse) {
            window.Discourse.__container__.lookup('service:app-events').trigger('modal-body:flash', {
                message: message,
                type: 'error'
            });
        } else {
            alert(message);
        }
    }
}

// 初始化导出功能
document.addEventListener('DOMContentLoaded', () => {
    new ChatExport();
});