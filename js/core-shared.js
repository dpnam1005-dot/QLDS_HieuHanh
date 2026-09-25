// ========== CẤU HÌNH VÀ TIỆN ÍCH DÙNG CHUNG ==========
// Chỉ cung cấp hằng số/tiện ích dùng chung; không ghi database và không sửa dữ liệu.

// Escape data values before placing them inside an HTML template.
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

// Giữ nguyên cấu hình giao diện hiện tại để không đổi hành vi ứng dụng.
const APP_CONFIG = Object.freeze({
    supabaseTable: 'Quan ly ban hang',
    fetchTimeoutMs: 10000,
    storageKeys: Object.freeze({
        customersCache: 'qlds_customers_cache_v3',
        currentPage: 'qlds_current_page'
    })
});

const SB_URL = 'https://ozpaslchfhcdechmrhlv.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cGFzbGNoZmhjZGVjaG1yaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMTQxMDUsImV4cCI6MjA5ODY5MDEwNX0.Ekzyal8ona_CjoBkHV19iaDm20DXqCV4MJanSseZ1lo';

function parseJsonArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}
