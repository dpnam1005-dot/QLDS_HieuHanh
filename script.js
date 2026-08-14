// Bắt lỗi toàn hệ thống và hiển thị trực tiếp lên giao diện để dễ debug
window.onerror = function (message, source, lineno, colno, error) {
    console.error("Lỗi hệ thống:", message, source, lineno, colno, error);
    if (message === 'Script error.' || message === 'Script error') {
        return false;
    }
    const authErrorMsg = document.getElementById('authErrorMsg');
    const authContainer = document.getElementById('authContainer');
    if (authErrorMsg && authContainer && authContainer.style.display !== 'none') {
        authErrorMsg.innerHTML = `<span style="color: #ef4444; font-weight: bold;">Lỗi hệ thống (JS):</span> ${message}<br><small style="color: var(--text-muted); font-size: 11px;">Tại: ${source ? source.split('/').pop() : 'unknown'}:${lineno}</small>`;
        authErrorMsg.style.display = 'block';
        const btnSubmit = document.getElementById('btnAuthSubmit');
        if (btnSubmit) {
            btnSubmit.innerText = 'Đăng nhập';
            btnSubmit.disabled = false;
        }
    } else {
        alert("Lỗi hệ thống (JS Error):\n" + message + "\n\nTại: " + (source ? source.split('/').pop() : 'unknown') + " (Dòng " + lineno + ")");
        const tableBody = document.getElementById('tableBody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: #ef4444; padding: 30px; line-height: 1.6;">
                <b>Lỗi hệ thống (JavaScript Error):</b> ${message}<br>
                <small style="color: var(--text-muted);">Tại: ${source ? source.split('/').pop() : 'unknown'}:${lineno}:${colno}</small>
            </td></tr>`;
        }
    }
    return false;
};

// ========== CONFIG ==========
const SB_URL = 'https://ozpaslchfhcdechmrhlv.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96cGFzbGNoZmhjZGVjaG1yaGx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMTQxMDUsImV4cCI6MjA5ODY5MDEwNX0.Ekzyal8ona_CjoBkHV19iaDm20DXqCV4MJanSseZ1lo';

let supabaseClient;
try {
    if (!window.supabase) {
        throw new Error("Không thể tải thư viện Supabase từ CDN (jsDelivr / UNPKG). Vui lòng kiểm tra lại kết nối Internet.");
    }
    supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);
} catch (e) {
    console.error(e);
    document.addEventListener("DOMContentLoaded", () => {
        const tableBody = document.getElementById('tableBody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: #ef4444; padding: 30px; line-height: 1.6;">
                <b>Lỗi khởi tạo ứng dụng:</b> ${e.message}<br>
                <span style="color: var(--text-muted); font-size: 13px;">Vui lòng thử đổi DNS hoặc bật VPN, rồi tải lại trang (F5).</span>
            </td></tr>`;
        }
    });
}

let customers = [];
const classificationColors = {
    "Khách mới": "#2563EB",            // màu xanh dương - #2563EB
    "Thường xuyên": "#16A34A",         // màu xanh lá - #16A34A
    "Không thường xuyên": "#F97316",    // màu cam - #F97316
    "Chưa liên hệ được": "#D97706",    // màu vàng - #D97706
    "Không nhu cầu": "#DC2626",          // màu đỏ - #DC2626
    "Chưa phân loại": "#64748B"
};

function showNotification(title, msg, titleColor = '#d97706') {
    const titleEl = document.getElementById('notificationTitle');
    const msgEl = document.getElementById('notificationMessage');
    const modalEl = document.getElementById('notificationModal');
    if (titleEl && msgEl && modalEl) {
        titleEl.innerText = title;
        titleEl.style.color = titleColor;
        msgEl.innerHTML = msg;
        modalEl.style.display = 'flex';
    }
}
window.showNotification = showNotification;

let currentUserEmail = null;
let isEditing = false;
let pendingCustomerData = null;
let pendingActionData = null;
let pendingNotification = null;
let currentPage = 1;
const itemsPerPage = 10;

// Elements cho chức năng Đăng nhập / Đăng xuất
const authContainer = document.getElementById('authContainer');
const mainContainer = document.getElementById('mainContainer');
const authForm = document.getElementById('authForm');
const authId = document.getElementById('authId');
const authPassword = document.getElementById('authPassword');
const authErrorMsg = document.getElementById('authErrorMsg');
const btnLogout = document.getElementById('btnLogout');

// Xử lý gửi form Đăng nhập bằng Supabase Authentication
if (authForm) {
    authForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const id = authId ? authId.value.trim() : '';
        const password = authPassword ? authPassword.value.trim() : '';
        const btnSubmit = document.getElementById('btnAuthSubmit');

        if (!id || !password) {
            authErrorMsg.innerText = "Vui lòng nhập đầy đủ ID Đăng nhập và Mật khẩu!";
            authErrorMsg.style.display = 'block';
            return;
        }

        if (btnSubmit) {
            btnSubmit.innerText = 'Đang đăng nhập...';
            btnSubmit.disabled = true;
        }
        authErrorMsg.style.display = 'none';

        try {
            if (!supabaseClient) {
                throw new Error("Không có kết nối đến cơ sở dữ liệu Supabase. Vui lòng kiểm tra mạng hoặc DNS!");
            }

            // Tự động map ID thành định dạng Email cho Supabase Auth (ví dụ: hieuhanh -> hieuhanh@daisylam.id.vn)
            const email = id.includes('@') ? id : `${id}@daisylam.id.vn`;

            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            // Xử lý cập nhật UI trực tiếp khi Đăng nhập thành công
            if (data && data.session) {
                currentUserEmail = data.session.user?.email || null;
                if (authContainer) authContainer.style.display = 'none';
                if (mainContainer) mainContainer.style.display = 'block';
                if (btnLogout) btnLogout.style.display = 'block';
                fetchCustomers();
            }
        } catch (err) {
            console.error("Lỗi đăng nhập chi tiết:", err);
            const errDetail = err.message || err.error_description || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            const errCode = err.code || err.status || '';

            let rawErrorBox = `
                <div style="background: #FEF2F2; border: 1px solid #FCA5A5; padding: 14px; border-radius: 10px; text-align: left; margin-top: 12px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.08);">
                    <div style="font-size: 14px; font-weight: 800; color: #DC2626; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                        <span>❌</span> <span>Đăng Nhập Thất Bại</span>
                    </div>
                    <div style="font-size: 12px; color: #7F1D1D; margin-bottom: 4px; font-weight: bold;">Thông điệp lỗi từ hệ thống Supabase:</div>
                    <div style="background: #FFFFFF; border: 1px solid #FECACA; border-radius: 6px; padding: 8px 10px; font-family: monospace; font-size: 12px; color: #B91C1C; word-break: break-all; margin-bottom: 8px;">
                        ${errCode ? '<strong>[' + errCode + ']</strong> ' : ''}${errDetail}
                    </div>
                    <div style="font-size: 11px; color: #64748B; line-height: 1.5;">
                        💡 <strong>Gợi ý khắc phục:</strong><br>
                        • Nếu lỗi <i>Invalid login credentials</i>: Vui lòng kiểm tra lại ID/Email và Mật khẩu (chú ý gõ chữ hoa/thường).<br>
                        • Nếu lỗi <i>Failed to fetch</i>: Do kết nối mạng bị chặn, thử chuyển sang 4G hoặc đổi DNS.
                    </div>
                </div>
            `;

            authErrorMsg.innerHTML = rawErrorBox;
            authErrorMsg.style.display = 'block';
            if (btnSubmit) {
                btnSubmit.innerText = 'Đăng nhập';
                btnSubmit.disabled = false;
            }
        }
    });
}

// Xử lý nút Đăng xuất bằng Supabase Auth
if (btnLogout) {
    btnLogout.addEventListener('click', async function () {
        if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?")) {
            try {
                if (supabaseClient) {
                    await supabaseClient.auth.signOut();
                    currentUserEmail = null;
                    if (authContainer) authContainer.style.display = 'flex';
                    if (mainContainer) mainContainer.style.display = 'none';
                    if (btnLogout) btnLogout.style.display = 'none';
                    if (authForm) authForm.reset();
                    const btnSubmit = document.getElementById('btnAuthSubmit');
                    if (btnSubmit) {
                        btnSubmit.innerText = 'Đăng nhập';
                        btnSubmit.disabled = false;
                    }
                }
            } catch (err) {
                console.error("Lỗi đăng xuất:", err);
            }
        }
    });
}

// Lắng nghe và quản lý trạng thái Đăng nhập tự động bằng Supabase Auth
function initAuthListener() {
    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            console.log("Sự kiện Auth:", event, session);
            if (session) {
                // Đã đăng nhập thành công
                currentUserEmail = session.user?.email || null;
                if (authContainer) authContainer.style.display = 'none';
                if (mainContainer) mainContainer.style.display = 'block';
                if (btnLogout) btnLogout.style.display = 'block';

                // Tải dữ liệu khách hàng
                fetchCustomers();
            } else {
                // Chưa đăng nhập / Đăng xuất
                currentUserEmail = null;
                if (authContainer) authContainer.style.display = 'flex';
                if (mainContainer) mainContainer.style.display = 'none';
                if (btnLogout) btnLogout.style.display = 'none';

                // Reset biểu mẫu đăng nhập
                if (authForm) authForm.reset();
                const btnSubmit = document.getElementById('btnAuthSubmit');
                if (btnSubmit) {
                    btnSubmit.innerText = 'Đăng nhập';
                    btnSubmit.disabled = false;
                }
            }
        });

        // Kiểm tra phiên đăng nhập hiện tại ngay khi mở trang
        supabaseClient.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                currentUserEmail = session.user?.email || null;
                if (authContainer) authContainer.style.display = 'none';
                if (mainContainer) mainContainer.style.display = 'block';
                if (btnLogout) btnLogout.style.display = 'block';
                fetchCustomers();
            }
        });
    } else {
        if (authContainer) authContainer.style.display = 'flex';
        if (mainContainer) mainContainer.style.display = 'none';
    }
}

// TỰ ĐỘNG KÍCH HOẠT LISTENER AUTH KHI SCRIPT TẢI
initAuthListener();


function mapFromSupabase(row) {
    let parsedHistory = [];
    if (typeof row.history === 'string') {
        try {
            parsedHistory = JSON.parse(row.history);
        } catch {
            parsedHistory = [];
        }
    } else if (Array.isArray(row.history)) {
        parsedHistory = row.history;
    }

    const topCategory = row.product_name || '';
    const topProductDesc = row.product_description || '';

    // Ưu tiên lấy giá trị product_name và product_description mới nhất vừa chỉnh sửa trên Supabase DB
    parsedHistory = (parsedHistory || []).map(tx => ({
        ...tx,
        category: topCategory || tx.category || '',
        productDesc: topProductDesc || tx.productDesc || ''
    }));

    return {
        customerId: row.customer_id || '',
        taxId: row.tax_id || '',
        companyName: row.company_name || '',
        classification: row.classification || '',
        category: topCategory,
        productDesc: topProductDesc,
        contactName: row.contact_name || '',
        phone: row.phone || '',
        sales: Number(row.sales) || 0,
        notes: row.notes || '',
        lastUpdated: row.updated_at || '',
        updatedBy: row.updated_by || '',
        history: parsedHistory
    };
}

function mapToSupabase(c) {
    const taxVal = c.taxId?.toString().trim();
    const phoneVal = c.phone?.toString().trim();
    const salesVal = c.sales?.toString().trim();

    let formattedPhone = phoneVal || null;
    if (phoneVal && /^\d+$/.test(phoneVal) && !phoneVal.startsWith('0') && !phoneVal.startsWith('+')) {
        formattedPhone = '0' + phoneVal;
    }

    return {
        customer_id: c.customerId?.trim() || '',
        tax_id: taxVal || null,
        company_name: c.companyName?.trim() || '',
        classification: c.classification || '',
        product_name: c.category?.trim() || null,
        product_description: c.productDesc?.trim() || null,
        contact_name: c.contactName?.trim() || '',
        phone: formattedPhone,
        sales: salesVal && !isNaN(Number(salesVal)) ? Number(salesVal) : null,
        notes: c.notes?.trim() || null,
        updated_at: c.lastUpdated || new Date().toISOString(),
        updated_by: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống',
        history: Array.isArray(c.history) ? c.history : []
    };
}

// ========== KPI FUNCTIONS ==========
const KPI_TARGET = 650000000; // KPI 1 tháng: 650 triệu VNĐ

function getCurrentMonthSales() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    let monthSales = 0;

    if (Array.isArray(customers)) {
        customers.forEach(c => {
            if (c.history && Array.isArray(c.history) && c.history.length > 0) {
                c.history.forEach(tx => {
                    if (tx.date) {
                        const txDate = new Date(tx.date);
                        if (txDate >= start && txDate <= end && tx.amount) {
                            monthSales += Number(tx.amount || 0);
                        }
                    }
                });
            }
        });
    }

    return monthSales;
}

function updateKPIBar() {
    const kpiValue = document.getElementById('kpiValue');
    const kpiPercent = document.getElementById('kpiPercent');
    const kpiProgressFill = document.getElementById('kpiProgressFill');

    if (!kpiValue || !kpiPercent || !kpiProgressFill) return;

    // Tính tổng doanh số phát sinh TRONG THÁNG HIỆN TẠI (chuẩn theo chỉ tiêu tháng)
    const monthSales = getCurrentMonthSales();

    // Tính phần trăm hoàn thành chỉ tiêu KPI tháng
    const percentage = (monthSales / KPI_TARGET) * 100;
    const displayPercentage = Math.round(percentage);

    // Cập nhật hiển thị giá trị doanh số tháng và phần trăm KPI
    kpiValue.textContent = formatCurrency(monthSales);
    kpiPercent.textContent = displayPercentage + '%';

    // Cập nhật độ rộng thanh progress bar (tối đa 100%)
    const barWidth = Math.min(percentage, 100);
    kpiProgressFill.style.width = barWidth + '%';

    // Kiểm tra và hiển thị popup chúc mừng mốc KPI (50%, 70%, 90%, 100%)
    checkKPIMilestones(monthSales, displayPercentage);
}

// Cấu hình nội dung chúc mừng các mốc KPI tháng (50%, 70%, 90%, 100%)
const milestoneConfig = {
    50: {
        badge: '🎉 BỨT PHÁ 50% CHỈ TIÊU KPI 🎉',
        title: 'Cố gắng lên nhé Hiếu Hạnh! 💕',
        desc: (salesText) => `Hiếu Hạnh đã xuất sắc chinh phục <strong>50% chỉ tiêu KPI tháng</strong> (<span id="kpi50SalesVal" style="color: #d97706; font-weight: 800;">${salesText}</span>)!<br>Chỉ còn một nửa chặng đường nữa thôi, Mochi và mọi người tin chắc Hiếu Hạnh sẽ bứt phá cán đích 100% rực rỡ! 🚀🔥`,
        btnText: 'Cố gắng lên nhé Hiếu Hạnh! 🔥',
        btnBg: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
        badgeBg: 'linear-gradient(90deg, #D97706, #F59E0B)',
        borderColor: '#FCD34D',
        contentBg: 'linear-gradient(180deg, #FFFFFF 0%, #FFFBEB 100%)'
    },
    70: {
        badge: '🚀 VƯỢT MỐC 70% CHỈ TIÊU KPI 🚀',
        title: 'Xuất sắc lắm Hiếu Hạnh ơi! 🌟',
        desc: (salesText) => `Hiếu Hạnh đã ấn tượng vượt mốc <strong>70% chỉ tiêu KPI tháng</strong> (<span id="kpi50SalesVal" style="color: #2563eb; font-weight: 800;">${salesText}</span>)!<br>Đã rất gần đích 650M rồi, tiếp tục tăng tốc bứt phá nhé Hiếu Hạnh ơi! 💥💪`,
        btnText: 'Tiếp tục tăng tốc thôi nào! 🚀',
        btnBg: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
        badgeBg: 'linear-gradient(90deg, #2563EB, #3B82F6)',
        borderColor: '#93C5FD',
        contentBg: 'linear-gradient(180deg, #FFFFFF 0%, #EFF6FF 100%)'
    },
    90: {
        badge: '🔥 CHẠM MỐC 90% KPI - SẮP CÁN ĐÍCH 🔥',
        title: 'Siêu đỉnh Hiếu Hạnh ơi! 🏆',
        desc: (salesText) => `Hiếu Hạnh đã cán mốc ngoạn mục <strong>90% chỉ tiêu KPI tháng</strong> (<span id="kpi50SalesVal" style="color: #7c3aed; font-weight: 800;">${salesText}</span>)!<br>Chỉ còn 10% nữa thôi là hoàn thành target 650M! Về đích rực rỡ nào! 🎉✨`,
        btnText: 'Cùng Mochi về đích rực rỡ! 🏁',
        btnBg: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
        badgeBg: 'linear-gradient(90deg, #7C3AED, #8B5CF6)',
        borderColor: '#C4B5FD',
        contentBg: 'linear-gradient(180deg, #FFFFFF 0%, #F5F3FF 100%)'
    },
    100: {
        badge: '🏆 CHÍNH THỨC CÁN ĐÍCH 100% KPI 🏆',
        title: 'HOÀN THÀNH 100% KPI XUẤT SẮC! 🎉',
        desc: (salesText) => `Chúc mừng Hiếu Hạnh đã xuất sắc chinh phục trọn vẹn <strong>100% chỉ tiêu KPI tháng (650M)</strong> với doanh số <span id="kpi50SalesVal" style="color: #10b981; font-weight: 800;">${salesText}</span>!<br>Bạn thật sự là một ngôi sao bán hàng tỏa sáng rực rỡ nhất! 🥳💖👑`,
        btnText: 'Tuyệt vời số 1 Hiếu Hạnh ơi! 💖',
        btnBg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        badgeBg: 'linear-gradient(90deg, #10B981, #34D399)',
        borderColor: '#6EE7B7',
        contentBg: 'linear-gradient(180deg, #FFFFFF 0%, #ECFDF5 100%)'
    }
};

function showKPIMilestoneModal(milestoneLevel, salesVal) {
    const modal = document.getElementById('kpi50MilestoneModal');
    const badge = document.getElementById('kpiMilestoneBadge');
    const title = document.getElementById('kpiMilestoneTitle');
    const desc = document.getElementById('kpiMilestoneDesc');
    const btn = document.getElementById('btnCloseKpi50Modal');
    const content = modal?.querySelector('.kpi-milestone-content');

    if (!modal || !milestoneConfig[milestoneLevel]) return;

    const config = milestoneConfig[milestoneLevel];
    const formattedSales = formatCurrency(salesVal !== undefined ? salesVal : getCurrentMonthSales());

    if (badge) {
        badge.innerHTML = config.badge;
        badge.style.background = config.badgeBg;
    }
    if (title) title.innerHTML = config.title;
    if (desc) desc.innerHTML = config.desc(formattedSales);
    if (btn) {
        btn.innerHTML = config.btnText;
        btn.style.background = config.btnBg;
    }
    if (content) {
        content.style.background = config.contentBg;
        content.style.borderColor = config.borderColor;
    }

    modal.style.display = 'flex';
    triggerFireworks();
}

// Hàm bắn PHÁO GIẤY TRÀN MÀN HÌNH SIÊU HOÀNH TRÁNG + Icon Trái tim bay ngợp trời
function triggerFireworks() {
    if (typeof confetti === 'function') {
        try {
            // Bắn đại bác pháo giấy từ 2 bên sườn và giữa tràn ngập màn hình
            confetti({ particleCount: 140, spread: 90, origin: { x: 0.1, y: 0.75 } });
            confetti({ particleCount: 140, spread: 90, origin: { x: 0.9, y: 0.75 } });

            setTimeout(() => {
                confetti({ particleCount: 180, spread: 120, origin: { x: 0.5, y: 0.5 } });
            }, 400);

            setTimeout(() => {
                confetti({ particleCount: 120, spread: 80, origin: { x: 0.25, y: 0.6 } });
                confetti({ particleCount: 120, spread: 80, origin: { x: 0.75, y: 0.6 } });
            }, 800);
        } catch (e) { console.warn("Lỗi hiệu ứng confetti:", e); }
    }

    let canvas = document.getElementById('kpiFireworksCanvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'kpiFireworksCanvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '999999';
        document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const paperColors = [
        '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
        '#ec4899', '#facc15', '#06b6d4', '#ff007f', '#a855f7', '#ff69b4', '#38bdf8'
    ];
    const heartEmojis = ['💖', '💕', '✨', '🌸', '👑', '💖', '🥰', '✨', '🏆', '🎉'];

    let allParticles = [];
    let floatingEmojis = [];

    // Tạo 50 Icon Trái tim & Ngôi sao phủ tràn cạnh dưới bay lên
    for (let i = 0; i < 50; i++) {
        floatingEmojis.push({
            x: Math.random() * canvas.width,
            y: canvas.height + Math.random() * 250,
            vy: -(Math.random() * 2.8 + 1.2),
            vx: (Math.random() - 0.5) * 1.5,
            swing: Math.random() * Math.PI * 2,
            swingSpeed: Math.random() * 0.05 + 0.02,
            size: Math.floor(Math.random() * 18 + 16),
            emoji: heartEmojis[Math.floor(Math.random() * heartEmojis.length)],
            alpha: 1,
            decay: Math.random() * 0.004 + 0.002
        });
    }

    // Hàm tạo pháo giấy bắn từ các súng đại bác góc nghiêng tràn màn hình
    function launchCannonBurst(startX, startY, angleDegrees, pieceCount = 80) {
        const baseAngle = (angleDegrees * Math.PI) / 180;
        for (let i = 0; i < pieceCount; i++) {
            const spreadAngle = baseAngle + (Math.random() - 0.5) * 0.9;
            const speed = Math.random() * 14 + 5;
            allParticles.push({
                x: startX,
                y: startY,
                vx: Math.cos(spreadAngle) * speed,
                vy: Math.sin(spreadAngle) * speed,
                width: Math.random() * 7 + 8,
                height: Math.random() * 5 + 6,
                color: paperColors[Math.floor(Math.random() * paperColors.length)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.22,
                tilt: Math.random() * Math.PI * 2,
                tiltSpeed: Math.random() * 0.14 + 0.05,
                alpha: 1,
                decay: Math.random() * 0.007 + 0.003,
                gravity: 0.1,
                drag: 0.968
            });
        }
    }

    // Tạo đợt mưa pháo giấy rơi từ đỉnh màn hình xuống tràn 100% chiều rộng
    function launchTopRain(pieceCount = 100) {
        for (let i = 0; i < pieceCount; i++) {
            allParticles.push({
                x: Math.random() * canvas.width,
                y: -Math.random() * 100,
                vx: (Math.random() - 0.5) * 2,
                vy: Math.random() * 3 + 2,
                width: Math.random() * 8 + 8,
                height: Math.random() * 6 + 6,
                color: paperColors[Math.floor(Math.random() * paperColors.length)],
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                tilt: Math.random() * Math.PI * 2,
                tiltSpeed: Math.random() * 0.12 + 0.04,
                alpha: 1,
                decay: Math.random() * 0.006 + 0.003,
                gravity: 0.06,
                drag: 0.98
            });
        }
    }

    // Kịch bản 4 đợt bắn pháo ngợp trời 100% toàn màn hình
    // Đợt 1 (0ms): Đột kích từ 2 góc dưới bên trái (bắn chéo lên phải) và bên phải (bắn chéo lên trái)
    launchCannonBurst(canvas.width * 0.05, canvas.height * 0.85, -55, 90);
    launchCannonBurst(canvas.width * 0.95, canvas.height * 0.85, -125, 90);

    // Đợt 2 (400ms): Bùng nổ 3 chùm trung tâm và 2 cánh
    setTimeout(() => {
        launchCannonBurst(canvas.width * 0.5, canvas.height * 0.6, -90, 100);
        launchCannonBurst(canvas.width * 0.25, canvas.height * 0.7, -70, 70);
        launchCannonBurst(canvas.width * 0.75, canvas.height * 0.7, -110, 70);
    }, 400);

    // Đợt 3 (800ms): Cơn mưa pháo giấy rơi từ trần màn hình tràn 100% chiều rộng
    setTimeout(() => {
        launchTopRain(120);
    }, 800);

    // Đợt 4 (1200ms): Đại tiệc bùng nổ cuối cùng bao trùm 4 góc
    setTimeout(() => {
        launchCannonBurst(canvas.width * 0.15, canvas.height * 0.9, -60, 80);
        launchCannonBurst(canvas.width * 0.85, canvas.height * 0.9, -120, 80);
        launchCannonBurst(canvas.width * 0.5, canvas.height * 0.5, -90, 90);
    }, 1200);

    const startTime = Date.now();
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let activeCount = 0;

        // 1. Vẽ các Icon Emoji Trái tim/Ngôi sao tràn ngợp bay lên
        floatingEmojis.forEach(fe => {
            if (fe.alpha > 0) {
                activeCount++;
                fe.y += fe.vy;
                fe.swing += fe.swingSpeed;
                fe.x += Math.sin(fe.swing) * fe.vx;
                fe.alpha -= fe.decay;

                ctx.save();
                ctx.globalAlpha = Math.max(0, fe.alpha);
                ctx.font = `${fe.size}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(236, 72, 153, 0.5)';
                ctx.fillText(fe.emoji, fe.x, fe.y);
                ctx.restore();
            }
        });

        // 2. Vẽ các mảnh pháo giấy chữ nhật lật xoay 3D tràn ngợp màn hình
        allParticles.forEach(p => {
            if (p.alpha > 0) {
                activeCount++;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.gravity;
                p.vx *= p.drag;
                p.vy *= p.drag;
                p.rotation += p.rotationSpeed;
                p.tilt += p.tiltSpeed;
                p.alpha -= p.decay;

                ctx.save();
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);

                const tiltScale = Math.cos(p.tilt);
                ctx.scale(1, tiltScale);

                ctx.fillStyle = p.color;
                ctx.shadowBlur = 6;
                ctx.shadowColor = p.color;
                ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
                ctx.restore();
            }
        });

        if (activeCount > 0 && Date.now() - startTime < 6000) {
            requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    animate();
}

function closeKpiMilestoneModal() {
    const modal = document.getElementById('kpi50MilestoneModal');
    if (modal) modal.style.display = 'none';
}

function checkKPIMilestones(monthSales, percentage) {
    const milestones = [100, 90, 70, 50]; // Ưu tiên mốc cao nhất đạt được
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}_${now.getMonth() + 1}`;
    const storageKey = `kpi_milestones_shown_${currentMonthKey}`;

    let shownMilestones = [];
    try {
        shownMilestones = JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (e) {
        shownMilestones = [];
    }

    const reached = milestones.filter(m => percentage >= m);
    if (reached.length === 0) return;

    // Tìm mốc cao nhất đã đạt được mà CHƯA từng hiển thị thông báo chúc mừng trong tháng này
    const milestoneToShow = reached.find(m => !shownMilestones.includes(m));

    if (milestoneToShow) {
        // Đánh dấu tất cả mốc <= milestoneToShow là đã ghi nhận để không lặp lại
        reached.forEach(m => {
            if (!shownMilestones.includes(m)) {
                shownMilestones.push(m);
            }
        });
        try {
            localStorage.setItem(storageKey, JSON.stringify(shownMilestones));
        } catch (e) {
            console.warn("Không thể lưu trạng thái mốc KPI:", e);
        }

        // Bật popup chúc mừng cho mốc này
        showKPIMilestoneModal(milestoneToShow, monthSales);
    }
}

// Quản lý bóng thoại Mochi nhắn các câu chúc cổ vũ Hiếu Hạnh
const mochiQuotes = [
    "Anh iu bé nhiềuuu 💕",
    "Hiếu Hạnh của anh là giỏi nhất ✨🥰",
    "Uống thêm nước nhoa bé 🥛💕",
    "Nghỉ tay nhắm mắt nghỉ ngơi một xíu nhoa bé 😴💖",
    "Hiếu Hạnh cố lên nhé 🐾🔥",
    "Mochi luôn đồng hành cùng Hiếu Hạnh ✨",
    "Quyết tâm cán đích 650M rực rỡ 🚀💰",
    "Hiếu Hạnh tuyệt vời số 1! 🏆💖"
];

let mochiBubbleTimer = null;
function showMochiBubble(customMsg) {
    const bubble = document.getElementById('kpiCatSpeech');
    if (!bubble) return;

    if (mochiBubbleTimer) clearTimeout(mochiBubbleTimer);

    const msg = customMsg || mochiQuotes[Math.floor(Math.random() * mochiQuotes.length)];
    bubble.innerText = msg;
    bubble.classList.add('show');

    mochiBubbleTimer = setTimeout(() => {
        bubble.classList.remove('show');
    }, 4000);
}

// Tự động bật bóng thoại Mochi nhắn tin nhắn ngẫu nhiên mỗi 7 giây
setInterval(() => {
    const bubble = document.getElementById('kpiCatSpeech');
    if (bubble && !bubble.classList.contains('show')) {
        showMochiBubble();
    }
}, 7000);

// Hiện bóng thoại đầu tiên sau 2 giây khi vừa mở trang
setTimeout(() => {
    showMochiBubble("Anh iu bé nhiềuuu 💕");
}, 2000);

document.getElementById('kpiCatRunner')?.addEventListener('click', () => {
    showMochiBubble("Anh iu bé nhiềuuu 💕");
    const monthSales = getCurrentMonthSales();
    const pct = Math.round((monthSales / KPI_TARGET) * 100);

    const milestones = [100, 90, 70, 50];
    const currentMilestone = milestones.find(m => pct >= m);

    if (currentMilestone) {
        showKPIMilestoneModal(currentMilestone, monthSales);
    } else {
        let msg = `<strong style="font-size: 15px; color: #d97706;">Hiếu Hạnh cố lên nhé! 💕</strong><br><br>Mochi đang chạy đua để cùng bạn đạt mốc KPI 650M tháng này! Hiện tại đã chạy đạt <strong style="color: #10b981;">${pct}%</strong> rồi nè! 🚀🔥`;
        showNotification("Mochi Cổ Vũ KPI 🐾", msg);
    }
});

// ========== LOADING BAR FUNCTIONS ==========
function showLoadingBar() {
    const loadingBar = document.getElementById('loadingBar');
    const loadingFill = document.querySelector('.loading-progress-fill');
    const loadingPercent = document.getElementById('loadingPercent');

    if (loadingBar) {
        loadingBar.style.display = 'flex';
        loadingFill.style.width = '0%';
        loadingPercent.textContent = '0%';

        // Simulate progress - chậm hơn để người dùng nhìn thấy
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 8; // Giảm tốc độ tăng
            if (progress > 85) progress = 85; // Dừng ở 85% đợi data thực
            loadingFill.style.width = progress + '%';
            loadingPercent.textContent = Math.round(progress) + '%';
        }, 150); // Tăng thời gian interval

        loadingBar.dataset.interval = interval;
        loadingBar.dataset.startTime = Date.now(); // Lưu thời điểm bắt đầu
    }
}

async function hideLoadingBar() {
    const loadingBar = document.getElementById('loadingBar');
    const loadingFill = document.querySelector('.loading-progress-fill');
    const loadingPercent = document.getElementById('loadingPercent');

    if (loadingBar) {
        const interval = loadingBar.dataset.interval;
        if (interval) clearInterval(parseInt(interval));

        // Hoàn tất 100% nhanh chóng không tạo độ trễ ảo
        loadingFill.style.width = '100%';
        loadingPercent.textContent = '100%';

        setTimeout(() => {
            loadingBar.style.display = 'none';
        }, 150);
    }
}

// Bộ nhớ đệm LocalStorage giúp nạp ứng dụng tức thì 0ms mà không phải chờ mạng
const LOCAL_CACHE_KEY = 'qlds_customers_cache_v3';

function loadCachedCustomers() {
    try {
        const cached = localStorage.getItem(LOCAL_CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                customers = parsed;
                renderTable();
                updateCategoryDatalist();
                updateKPIBar();
                return true;
            }
        }
    } catch (e) {
        console.warn("Lỗi đọc cache local:", e);
    }
    return false;
}

function saveCachedCustomers(data) {
    try {
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn("Lỗi lưu cache local:", e);
    }
}

async function fetchCustomers() {
    const tableBody = document.getElementById('tableBody');
    
    // Nạp ngay dữ liệu từ Cache LocalStorage nếu có (Hiển thị tức thì 0ms)
    const hasCache = loadCachedCustomers();

    try {
        if (!hasCache) {
            showLoadingBar(); // Chỉ hiện loading bar khi chưa có cache
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: var(--primary-color); padding: 30px;">Đang tải dữ liệu từ máy chủ Supabase...</td></tr>`;
        }

        if (!supabaseClient) {
            throw new Error("Kết nối Supabase chưa được thiết lập. Hãy kiểm tra lỗi khởi tạo ở trên.");
        }

        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Quá thời gian 10 giây. Hãy kiểm tra lại kết nối mạng!")), 10000));
        const fetchPromise = supabaseClient.from('Quan ly ban hang').select('*').order('sales', { ascending: false });

        const { data, error } = await Promise.race([fetchPromise, timeout]);

        if (error) {
            console.error("Lỗi từ Supabase:", error);
            await hideLoadingBar();
            if (!hasCache) {
                tableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: #ef4444; padding: 30px; line-height: 1.6;">
                    <b>Lỗi máy chủ:</b> ${error.message} <br>
                </td></tr>`;
            }
            return;
        }

        customers = (data || []).map(mapFromSupabase);
        saveCachedCustomers(customers); // Lưu lại bản mới nhất vào Cache LocalStorage
        renderTable();
        updateCategoryDatalist(); // Cập nhật danh sách thể loại
        updateKPIBar(); // Cập nhật thanh KPI

        await hideLoadingBar(); // Ẩn loading bar khi hoàn thành

        // Khởi tạo custom autocomplete cho tất cả các input
        setTimeout(() => {
            initCustomAutocomplete('category', 'categoryDatalist');
            initCustomAutocomplete('productDesc', 'productDescDatalist');
            initCustomAutocomplete('editCategory', 'editCategoryDatalist');
            initCustomAutocomplete('editProductDesc', 'editProductDescDatalist');
            initCustomAutocomplete('salesCategorySelect', 'salesCategoryDatalist');
            initCustomAutocomplete('salesProductDescInput', 'salesProductDescDatalist');
        }, 100);
    } catch (e) {
        console.error("Lỗi hệ thống:", e);
        await hideLoadingBar(); // Ẩn loading bar khi có lỗi (có await)
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: #ef4444; padding: 30px; line-height: 1.6;">
            <b>Lỗi kết nối mạng:</b> ${e.message}
        </td></tr>`;
    }
}

const form = document.getElementById('customerForm');
const searchInput = document.getElementById('searchInput');
const btnClearSearch = document.getElementById('btnClearSearch');
const filterClassification = document.getElementById('filterClassification');
const tableBodyElement = document.getElementById('tableBody');
const paginationContainer = document.getElementById('pagination');

// Thêm sự kiện tìm kiếm & nút X xóa nhanh từ khóa
if (searchInput) {
    searchInput.addEventListener('input', function () {
        if (btnClearSearch) {
            btnClearSearch.style.display = this.value.trim() ? 'flex' : 'none';
        }
        currentPage = 1; // Reset về trang 1 khi tìm kiếm
        renderTable();
    });
}

if (btnClearSearch) {
    btnClearSearch.addEventListener('click', function () {
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        this.style.display = 'none';
        currentPage = 1;
        renderTable();
    });
}

// Thêm sự kiện filter phân loại
if (filterClassification) {
    filterClassification.addEventListener('change', function () {
        currentPage = 1; // Reset về trang 1 khi filter
        renderTable();
    });
}

const modal = document.getElementById('duplicateModal');
const modalMessage = document.getElementById('modalMessage');
const deleteModal = document.getElementById('deleteModal');
const deleteModalMessage = document.getElementById('deleteModalMessage');
const warningModal = document.getElementById('warningModal');
const warningModalMessage = document.getElementById('warningModalMessage');
const notificationModal = document.getElementById('notificationModal');
const notificationTitle = document.getElementById('notificationTitle');
const notificationMessage = document.getElementById('notificationMessage');

const idInput = document.getElementById('customerId');
if (idInput) {
    idInput.addEventListener('input', function () {
        const errorEl = document.getElementById('customerIdError');
        const val = this.value.trim();
        if (!val) {
            if (errorEl) errorEl.style.display = 'none';
            this.style.borderColor = 'var(--border-color)';
            return;
        }
        const exists = customers.some(c => String(c.customerId || '').trim().toLowerCase() === val.toLowerCase());
        if (exists) {
            if (errorEl) {
                errorEl.innerText = `⚠️ Mã khách hàng "${val}" đã tồn tại trên hệ thống!`;
                errorEl.style.display = 'block';
            }
            this.style.borderColor = '#ef4444';
        } else {
            if (errorEl) errorEl.style.display = 'none';
            this.style.borderColor = 'var(--border-color)';
        }
    });
}
const taxIdInput = document.getElementById('taxId');
const companyInput = document.getElementById('companyName');
const classificationInput = document.getElementById('classification');
const contactInput = document.getElementById('contactName');
const phoneInput = document.getElementById('phone');

const salesLabel = document.getElementById('salesLabel');
const salesInput = document.getElementById('sales');
const addSalesContainer = document.getElementById('addSalesContainer');
const addSalesInput = document.getElementById('addSales');
const salesAmountInput = document.getElementById('salesAmountInput');
const notesInput = document.getElementById('notes');

const btnSubmit = document.getElementById('btnSubmit');
const editActions = document.getElementById('editActions');
const btnCancelEdit = document.getElementById('btnCancelEdit');
const btnUpdate = document.getElementById('btnUpdate');
const btnDelete = document.getElementById('btnDelete');

const reportMonthSelect = document.getElementById('reportMonthSelect');

const fileInputExcel = document.getElementById('fileInputExcel');
let customerToDelete = null;

function formatInputWithCommas(e) {
    let isNegative = this.value.startsWith('-');
    let rawValue = this.value.replace(/\D/g, '');
    let formatted = rawValue ? parseInt(rawValue, 10).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '';
    if (isNegative && formatted) this.value = '-' + formatted;
    else if (isNegative && !formatted) this.value = '-';
    else this.value = formatted;

    if (this.id === 'addSales' || this.id === 'salesAmountInput') {
        if (isNegative && formatted) { this.style.borderColor = '#ef4444'; this.style.color = '#ef4444'; }
        else if (!isNegative && formatted) { this.style.borderColor = '#10b981'; this.style.color = '#10b981'; }
        else { this.style.borderColor = 'var(--border-color)'; this.style.color = 'var(--text-main)'; }
    }
}

if (salesInput) salesInput.addEventListener('input', formatInputWithCommas);
if (addSalesInput) addSalesInput.addEventListener('input', formatInputWithCommas);
if (salesAmountInput) salesAmountInput.addEventListener('input', formatInputWithCommas);

function formatCurrency(amount) { return Number(amount).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' }); }

function formatSalesScaledByMagnitude(amount) {
    const val = Number(amount) || 0;
    const formattedText = formatCurrency(val);
    const monoStyle = "font-family: 'Roboto Mono', 'SFMono-Regular', Consolas, 'Courier New', monospace; font-variant-numeric: tabular-nums lining-nums;";

    if (val < 0) {
        return `<span style="color: #ef4444; font-weight: 700; font-size: 13.5px; ${monoStyle}">${formattedText}</span>`;
    }
    if (val === 0) {
        return `<span style="color: #94a3b8; font-weight: 500; font-size: 13.5px; ${monoStyle}">0 ₫</span>`;
    }

    // Tất cả các số dùng font monospaced Roboto Mono / Consolas để 100% chữ số có độ rộng bằng nhau tăm tắp
    if (val >= 100000000) {
        return `<span style="font-size: 13.5px; font-weight: 800; color: #047857; ${monoStyle}">${formattedText}</span>`;
    }

    if (val >= 10000000) {
        const color = val >= 50000000 ? '#059669' : '#C2410C';
        return `<span style="font-size: 13.5px; font-weight: 700; color: ${color}; ${monoStyle}">${formattedText}</span>`;
    }

    if (val >= 1000000) {
        return `<span style="font-size: 13.5px; font-weight: 600; color: #C2410C; ${monoStyle}">${formattedText}</span>`;
    }

    return `<span style="font-size: 13.5px; font-weight: 600; color: #475569; ${monoStyle}">${formattedText}</span>`;
}
function formatPhoneNumber(phoneVal) {
    if (!phoneVal) return '-';
    let str = phoneVal.toString().trim();
    if (!str || str === '-') return '-';
    // Nếu là số thuần túy và không bắt đầu bằng '0' hoặc '+', tự động thêm '0' ở đầu
    if (/^\d+$/.test(str) && !str.startsWith('0') && !str.startsWith('+')) {
        return '0' + str;
    }
    return str;
}

function showHistoryModal(customerId) {
    const customer = customers.find(c => String(c.customerId).toLowerCase() === String(customerId).toLowerCase());
    if (!customer) return;

    const metaContainer = document.getElementById('historyModalMeta');
    metaContainer.innerHTML = `
        <strong>Mã khách hàng:</strong> ${customer.customerId} <br>
        <strong>Tên Công ty:</strong> ${customer.companyName || '-'}
    `;

    const timelineContainer = document.getElementById('historyTimelineContainer');
    timelineContainer.innerHTML = '';

    let history = [...(customer.history || [])];

    // Tự động kiểm tra và đồng bộ nếu người dùng sửa trực tiếp giá trị Doanh số (sales) trên bảng điều khiển Supabase DB
    let historySum = history.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const targetSales = Number(customer.sales) || 0;

    if (history.length === 0 && targetSales !== 0) {
        history.push({
            date: customer.lastUpdated || new Date().toISOString(),
            amount: targetSales,
            note: 'Cập nhật từ Supabase Database',
            category: customer.category || '',
            productDesc: customer.productDesc || '',
            updated_by: 'Supabase DB Admin'
        });
    } else if (history.length > 0 && Math.abs(historySum - targetSales) > 1) {
        // Tự động chèn dòng điều chỉnh cân bằng doanh số mới nhất sửa từ Supabase
        const diffAmount = targetSales - historySum;
        history.unshift({
            date: customer.lastUpdated || new Date().toISOString(),
            amount: diffAmount,
            note: 'Điều chỉnh trực tiếp trên Supabase Database',
            category: customer.category || '',
            productDesc: customer.productDesc || '',
            updated_by: 'Supabase DB Admin'
        });
    }

    if (history.length === 0) {
        timelineContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Chưa có lịch sử cập nhật cho khách hàng này.</div>`;
    } else {
        // Sắp xếp lịch sử theo thời gian mới nhất lên đầu
        const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

        const ul = document.createElement('div');
        ul.style.position = 'relative';
        ul.style.paddingLeft = '24px';
        ul.style.borderLeft = '2px solid #e2e8f0';
        ul.style.marginLeft = '12px';
        ul.style.display = 'flex';
        ul.style.flexDirection = 'column';
        ul.style.gap = '20px';

        sortedHistory.forEach(item => {
            const itemDate = new Date(item.date);
            const formattedDate = itemDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = itemDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const user = item.updated_by || 'hệ thống';

            const itemDiv = document.createElement('div');
            itemDiv.style.position = 'relative';

            // Dot
            const dot = document.createElement('div');
            dot.style.position = 'absolute';
            dot.style.left = '-31px';
            dot.style.top = '4px';
            dot.style.width = '12px';
            dot.style.height = '12px';
            dot.style.borderRadius = '50%';
            dot.style.backgroundColor = 'var(--primary-color)';
            dot.style.border = '2px solid white';
            itemDiv.appendChild(dot);

            // Content card
            const content = document.createElement('div');
            content.style.fontSize = '14px';
            content.style.lineHeight = '1.6';

            // Time header
            const timeHeader = document.createElement('div');
            timeHeader.style.fontSize = '12px';
            timeHeader.style.color = 'var(--text-muted)';
            timeHeader.style.fontWeight = 'bold';
            timeHeader.innerText = `${formattedDate} LÚC ${formattedTime}`;
            content.appendChild(timeHeader);

            // Action title
            const actionTitle = document.createElement('div');
            actionTitle.style.fontWeight = 'bold';
            actionTitle.style.color = 'var(--text-main)';
            actionTitle.style.marginTop = '2px';
            actionTitle.innerText = item.note || 'Cập nhật thông tin';
            content.appendChild(actionTitle);

            // Details box
            const detailsBox = document.createElement('div');
            detailsBox.style.background = '#f8fafc';
            detailsBox.style.border = '1px solid #e2e8f0';
            detailsBox.style.borderRadius = '6px';
            detailsBox.style.padding = '8px 12px';
            detailsBox.style.marginTop = '6px';

            let detailsHtml = `<ul style="margin: 0; padding-left: 15px; list-style-type: disc; color: #475569; font-size: 13px;">`;
            detailsHtml += `<li>Thực hiện bởi: <strong>${user}</strong></li>`;
            if (item.amount !== undefined && item.amount !== null && item.amount !== 0) {
                const amountPrefix = item.amount > 0 ? '+' : '';
                detailsHtml += `<li>Biến động doanh số: <strong style="color: ${item.amount > 0 ? '#10b981' : '#ef4444'}">${amountPrefix}${formatCurrency(item.amount)}</strong></li>`;
            }
            const finalCategory = customer.category || item.category || '';
            const finalProductDesc = customer.productDesc || item.productDesc || '';

            const categoryText = finalCategory ? `<strong style="color: var(--primary-color);">${finalCategory}</strong>` : '<span style="color: #94a3b8;">-</span>';
            detailsHtml += `<li>Tên sản phẩm: ${categoryText}</li>`;

            const productDescText = finalProductDesc ? `<span style="color: #64748b;">${finalProductDesc}</span>` : '<span style="color: #94a3b8;">-</span>';
            detailsHtml += `<li>Mô tả: ${productDescText}</li>`;
            detailsHtml += `</ul>`;

            detailsBox.innerHTML = detailsHtml;
            content.appendChild(detailsBox);

            itemDiv.appendChild(content);
            ul.appendChild(itemDiv);
        });

        timelineContainer.appendChild(ul);
    }

    document.getElementById('historyModal').style.display = 'flex';
}
function formatDateTime(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}



const categoryInput = document.getElementById('category');
const productDescInput = document.getElementById('productDesc');

function getFormData() {
    let rawSales = salesInput ? salesInput.value.replace(/[,.]/g, '') : '0';
    let parsedSales = Number(rawSales);
    if (isNaN(parsedSales)) parsedSales = 0;
    return {
        customerId: idInput ? idInput.value.trim() : '', taxId: taxIdInput ? taxIdInput.value.trim() : '',
        companyName: companyInput ? companyInput.value.trim() : '', classification: classificationInput ? classificationInput.value : '',
        category: categoryInput ? categoryInput.value : '', productDesc: productDescInput ? productDescInput.value.trim() : '',
        contactName: contactInput ? contactInput.value.trim() : '', phone: phoneInput ? phoneInput.value.trim() : '',
        sales: parsedSales, notes: notesInput ? notesInput.value.trim() : ''
    };
}

function setFormData(data) {
    if (idInput) idInput.value = data.customerId || ''; if (taxIdInput) taxIdInput.value = data.taxId || '';
    if (companyInput) companyInput.value = data.companyName || ''; if (classificationInput) classificationInput.value = data.classification || '';
    if (categoryInput) categoryInput.value = data.category || ''; if (productDescInput) productDescInput.value = data.productDesc || '';
    if (contactInput) contactInput.value = data.contactName || ''; if (phoneInput) phoneInput.value = data.phone ? formatPhoneNumber(data.phone) : '';
    if (salesInput) salesInput.value = data.sales || data.sales === 0 ? data.sales.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '';
    if (notesInput) notesInput.value = data.notes || '';
    const addSalesEl = document.getElementById('addSales');
    if (addSalesEl) { addSalesEl.value = ''; addSalesEl.style.borderColor = 'var(--border-color)'; addSalesEl.style.color = 'var(--text-main)'; }
}

function openCustomerFormModal(mode, customer = null) {
    const modalEl = document.getElementById('customerFormModal');
    const titleTextEl = document.getElementById('formModalTitleText');
    const iconEl = document.getElementById('formModalIcon');
    const submitBtn = document.getElementById('btnSubmit');

    setFormData({});
    if (idInput) {
        idInput.readOnly = false;
        idInput.style.backgroundColor = '#FAF7F2';
        idInput.style.borderColor = 'var(--border-color)';
    }
    if (salesInput) {
        salesInput.readOnly = false;
        salesInput.style.backgroundColor = '#FAF7F2';
    }

    // Reset thông báo lỗi trùng mã
    const errorEl = document.getElementById('customerIdError');
    if (errorEl) errorEl.style.display = 'none';

    if (titleTextEl) titleTextEl.innerText = "Thêm Khách Hàng Mới";
    if (iconEl) iconEl.innerText = "➕";
    if (submitBtn) { submitBtn.innerText = "Lưu Khách Hàng"; submitBtn.disabled = false; submitBtn.style.display = 'block'; }

    if (modalEl) modalEl.style.display = 'flex';
}

function closeCustomerFormModal() {
    const modalEl = document.getElementById('customerFormModal');
    if (modalEl) modalEl.style.display = 'none';
}

document.getElementById('btnCloseCustomerFormModal')?.addEventListener('click', closeCustomerFormModal);

function toggleEditMode(editing) {
    isEditing = editing;
    const titleTextEl = document.getElementById('formModalTitleText');
    const editActionsEl = document.getElementById('editActions');
    const addSalesContainerEl = document.getElementById('addSalesContainer');

    if (editing) {
        if (titleTextEl && titleTextEl.innerText === "Thêm Khách Hàng Mới") titleTextEl.innerText = "Chỉnh Sửa Khách Hàng";
        if (btnSubmit) btnSubmit.style.display = 'none';
        if (editActionsEl) editActionsEl.style.display = 'flex';
        if (idInput) { idInput.readOnly = true; idInput.style.backgroundColor = '#f1f5f9'; }
        if (salesInput) { salesInput.readOnly = true; salesInput.style.backgroundColor = '#f1f5f9'; }
        if (addSalesContainerEl) addSalesContainerEl.style.display = 'block';
        if (salesLabel) salesLabel.innerText = "Doanh số gốc (VNĐ)";
    } else {
        if (btnSubmit) btnSubmit.style.display = 'block';
        if (editActionsEl) editActionsEl.style.display = 'none';
        if (idInput) { idInput.readOnly = false; idInput.style.backgroundColor = '#FAF7F2'; }
        if (salesInput) { salesInput.readOnly = false; salesInput.style.backgroundColor = '#FAF7F2'; }
        setFormData({});
        if (addSalesContainerEl) addSalesContainerEl.style.display = 'none';
        if (salesLabel) salesLabel.innerText = "Doanh số ban đầu (VNĐ)";
    }
}

function renderPagination(totalItems) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;
    paginationContainer.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    if (totalPages <= 1) return;
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn'; prevBtn.innerText = 'Trước'; prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); } };
    paginationContainer.appendChild(prevBtn);
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`; pageBtn.innerText = i;
        pageBtn.onclick = () => { currentPage = i; renderTable(); }; paginationContainer.appendChild(pageBtn);
    }
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn'; nextBtn.innerText = 'Sau'; nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); } };
    paginationContainer.appendChild(nextBtn);
}

function renderTable() {
    const searchInput = document.getElementById('searchInput');
    const filterClassification = document.getElementById('filterClassification');
    const tableBodyElement = document.getElementById('tableBody');
    const paginationContainer = document.getElementById('pagination');

    if (!tableBodyElement) return;

    const query = searchInput ? searchInput.value.toLowerCase() : ''; 
    const filterClassVal = filterClassification ? filterClassification.value : '';
    let filtered = customers.filter(c => {
        const matchSearch = String(c.customerId || '').toLowerCase().includes(query) || (c.companyName && String(c.companyName).toLowerCase().includes(query)) ||
            (c.taxId && String(c.taxId).toLowerCase().includes(query)) || (c.contactName && String(c.contactName).toLowerCase().includes(query)) ||
            (c.phone && String(c.phone).includes(query)) || (c.classification && String(c.classification).toLowerCase().includes(query));
        const matchClass = filterClassVal === '' || c.classification === filterClassVal;
        return matchSearch && matchClass;
    });
    filtered.sort((a, b) => b.sales - a.sales);
    const maxSalesInFiltered = filtered.length > 0 ? (filtered[0].sales || 1) : 1;
    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

    tableBodyElement.innerHTML = '';
    if (paginatedItems.length === 0) {
        tableBodyElement.innerHTML = `<tr><td colspan="8" class="text-center" style="color: #94a3b8; padding: 30px;">Không có dữ liệu.</td></tr>`;
        if (paginationContainer) paginationContainer.innerHTML = ''; 
        return;
    }
    paginatedItems.forEach((customer, index) => {
        const tr = document.createElement('tr');
        let maKhColor = (customer.classification && classificationColors[customer.classification]) ? classificationColors[customer.classification] : 'var(--primary-color)';
        let maKhTitle = customer.classification ? `Phân loại: ${customer.classification}` : 'Chưa phân loại';
        tr.innerHTML = `
            <td class="text-center"><strong>${startIndex + index + 1}</strong></td>
            <td class="nowrap customer-id-cell" style="color: ${maKhColor}; font-weight: bold; cursor: pointer;" title="${maKhTitle}" onclick="showCustomerActionModal('${customer.customerId}')">${customer.customerId}</td>
            <td class="nowrap">${customer.taxId || '-'}</td>
            <td><strong>${customer.companyName || '-'}</strong></td>
            <td class="nowrap">${customer.contactName || '-'}</td>
            <td class="nowrap">${formatPhoneNumber(customer.phone)}</td>
            <td class="text-right money nowrap">${formatSalesScaledByMagnitude(customer.sales)}</td>
            <td>${customer.notes || '-'}</td>
        `;
        tableBodyElement.appendChild(tr);
    });
    renderPagination(filtered.length);
    updateKPIBar(); // Cập nhật thanh KPI mỗi khi render table
}
function checkSoftDuplicates(data) {
    let warnings = [];
    customers.forEach(c => {
        if (String(c.customerId || '').toLowerCase() !== String(data.customerId || '').toLowerCase()) {
            if (data.taxId && c.taxId && String(c.taxId).toLowerCase() === String(data.taxId).toLowerCase()) warnings.push(`- <strong>Mã số thuế</strong> trùng với khách hàng <span style="color: var(--primary-color)">${c.customerId}</span>`);
            if (data.companyName && c.companyName && String(c.companyName).toLowerCase() === String(data.companyName).toLowerCase()) warnings.push(`- <strong>Tên công ty</strong> trùng với khách hàng <span style="color: var(--primary-color)">${c.customerId}</span>`);
            if (data.phone && c.phone && String(c.phone) === String(data.phone)) warnings.push(`- <strong>Số điện thoại</strong> trùng với khách hàng <span style="color: var(--primary-color)">${c.customerId}</span>`);
        }
    });
    return [...new Set(warnings)];
}

async function proceedWithSave(data, isUpdating) {
    data.lastUpdated = new Date().toISOString();
    if (btnSubmit) { btnSubmit.innerText = 'Đang lưu...'; btnSubmit.disabled = true; }

    const exists = customers.find(c => String(c.customerId || '').trim().toLowerCase() === String(data.customerId || '').trim().toLowerCase());
    if (exists && !isUpdating) {
        if (btnSubmit) { btnSubmit.innerText = 'Lưu Khách Hàng'; btnSubmit.disabled = false; }

        const errorEl = document.getElementById('customerIdError');
        if (errorEl) {
            errorEl.innerText = `⚠️ Mã khách hàng "${data.customerId}" đã tồn tại trên hệ thống!`;
            errorEl.style.display = 'block';
        }
        if (idInput) {
            idInput.style.borderColor = '#ef4444';
            idInput.focus();
        }

        notificationTitle.innerText = "⚠️ Cảnh Báo Trùng Mã Khách Hàng";
        notificationTitle.style.color = "#d97706";
        notificationMessage.innerHTML = `Mã khách hàng <strong style="color: #ef4444; font-size: 16px;">"${data.customerId}"</strong> đã tồn tại trên hệ thống!<br><br><span style="color: #64748b; font-size: 13px;">Vui lòng kiểm tra lại danh sách hoặc nhập một Mã KH khác.</span>`;
        notificationModal.style.display = 'flex';
        return;
    } else {
        if (!isUpdating) {
            data.history = [{ date: data.lastUpdated, amount: data.sales, note: 'Tạo mới', category: data.category || '', productDesc: data.productDesc || '', updated_by: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống' }];
            const payload = mapToSupabase(data);
            const { error } = await supabaseClient.from('Quan ly ban hang').insert([payload]);
            if (error) alert("Lỗi khi thêm mới dữ liệu: " + error.message);
        } else {
            const payload = mapToSupabase(data);
            const { error } = await supabaseClient.from('Quan ly ban hang').update(payload).eq('customer_id', data.customerId);
            if (error) alert("Lỗi khi cập nhật dữ liệu: " + error.message);
        }
    }

    await fetchCustomers();
    updateCategoryDatalist(); // Cập nhật danh sách thể loại sau khi lưu
    closeCustomerFormModal();
    if (btnSubmit) { btnSubmit.innerText = 'Lưu Khách Hàng'; btnSubmit.disabled = false; }
}

if (form) {
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        proceedWithSave(getFormData(), false);
    });
}

document.getElementById('btnCloseNotification')?.addEventListener('click', function () { notificationModal.style.display = 'none'; });
document.getElementById('btnCloseKpi50Modal')?.addEventListener('click', closeKpiMilestoneModal);
document.getElementById('kpi50MilestoneModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'kpi50MilestoneModal') closeKpiMilestoneModal();
});
document.getElementById('btnCloseHistoryModal')?.addEventListener('click', closeAllModals);
document.getElementById('btnCloseHistoryBtn')?.addEventListener('click', () => {
    document.getElementById('historyModal').style.display = 'none';
    if (currentActionCustomerId) {
        showCustomerActionModal(currentActionCustomerId);
    }
});
document.getElementById('btnCloseAnalysisModal')?.addEventListener('click', () => { document.getElementById('analysisModal').style.display = 'none'; });
document.getElementById('btnCloseAnalysisBtn')?.addEventListener('click', () => { document.getElementById('analysisModal').style.display = 'none'; });
document.getElementById('btnAnalyzeCustomers')?.addEventListener('click', showAnalysisModal);

document.getElementById('btnCloseProductAnalysisModal')?.addEventListener('click', () => { document.getElementById('productAnalysisModal').style.display = 'none'; });
document.getElementById('btnCloseProductAnalysisBtn')?.addEventListener('click', () => { document.getElementById('productAnalysisModal').style.display = 'none'; });
document.getElementById('btnAnalyzeProducts')?.addEventListener('click', showProductAnalysisModal);

// Export PDF cho modal Phân tích Khách hàng
document.getElementById('btnExportAnalysisPDF')?.addEventListener('click', exportAnalysisToPDF);

// Export PDF cho modal Phân tích Sản phẩm
document.getElementById('btnExportProductAnalysisPDF')?.addEventListener('click', exportProductAnalysisToPDF);

document.getElementById('btnConfirmDelete')?.addEventListener('click', async function () {
    if (customerToDelete) {
        document.getElementById('btnConfirmDelete').innerText = 'Đang xóa...';
        document.getElementById('btnConfirmDelete').disabled = true;
        const { error } = await supabaseClient.from('Quan ly ban hang').delete().eq('customer_id', customerToDelete);
        document.getElementById('btnConfirmDelete').innerText = 'Xóa';
        document.getElementById('btnConfirmDelete').disabled = false;

        if (error) alert("Không thể xóa dòng dữ liệu: " + error.message);
        else { await fetchCustomers(); }
    }
    deleteModal.style.display = 'none';
});

document.getElementById('btnAddNewCustomer')?.addEventListener('click', () => {
    if (idInput) {
        idInput.style.borderColor = 'var(--border-color)';
        const errorEl = document.getElementById('customerIdError');
        if (errorEl) errorEl.style.display = 'none';
    }
    openCustomerFormModal('add');
});

// Thêm sự kiện click tương tác cho GIF Mascot Cute Cổ Vũ Sales
function showCheerMotivation(title, msg) {
    if (notificationTitle && notificationMessage && notificationModal) {
        notificationTitle.innerText = title;
        notificationTitle.style.color = '#d97706';
        notificationMessage.innerHTML = msg;
        notificationModal.style.display = 'flex';
    }
}

const cheerQuotes = [
    { title: "🔥 BÙNG CHÁY HẾT MÌNH!", msg: "<strong style='font-size: 16px; color: #ea580c;'>Quyết tâm cháy hết mình cùng mục tiêu sales tháng này!</strong><br><br><span style='color: #64748b;'>Mọi nỗ lực tư vấn và chăm sóc khách hàng của bạn đều sẽ đem lại quả ngọt rực rỡ! 💪🔥</span>" },
    { title: "🚀 BỨT PHÁ DOANH SỐ!", msg: "<strong style='font-size: 16px; color: #2563eb;'>Tăng tốc tối đa - Chinh phục mốc KPI 650 TRIỆU!</strong><br><br><span style='color: #64748b;'>Không gì có thể cản bước bạn vươn lên đỉnh cao doanh số! 🚀✨</span>" },
    { title: "💰 DOANH THU BÙNG NỔ!", msg: "<strong style='font-size: 16px; color: #16a34a;'>Chúc bạn chốt đơn liên tục - Tiền về ngập két!</strong><br><br><span style='color: #64748b;'>Doanh số bùng nổ, hoa hồng ngập tràn, thu nhập đỉnh cao! 💵🎉</span>" },
    { title: "🏆 QUYẾT THẮNG VÔ ĐỊCH!", msg: "<strong style='font-size: 16px; color: #9333ea;'>Bạn chính là Chiến Binh Sales Xuất Sắc Nhất!</strong><br><br><span style='color: #64748b;'>Giữ vững phong độ và luôn dẫn đầu bảng xếp hạng doanh số nhé! 👑🌟</span>" }
];

document.getElementById('cheerGifBadge1')?.addEventListener('click', () => {
    const randomQuote = cheerQuotes[Math.floor(Math.random() * cheerQuotes.length)];
    showCheerMotivation(randomQuote.title, randomQuote.msg);
});

document.getElementById('cheerGifBadge2')?.addEventListener('click', () => {
    const randomQuote = cheerQuotes[Math.floor(Math.random() * cheerQuotes.length)];
    showCheerMotivation(randomQuote.title, randomQuote.msg);
});

document.getElementById('cheerGifBadge3')?.addEventListener('click', () => {
    const randomQuote = cheerQuotes[Math.floor(Math.random() * cheerQuotes.length)];
    showCheerMotivation(randomQuote.title, randomQuote.msg);
});

// Thêm sự kiện kiểm tra trùng mã khách hàng khi người dùng nhập
if (idInput) {
    idInput.addEventListener('input', function () {
        const errorEl = document.getElementById('customerIdError');
        if (!errorEl) return;

        const inputValue = this.value.trim().toLowerCase();
        if (inputValue === '') {
            errorEl.style.display = 'none';
            this.style.borderColor = 'var(--border-color)';
            return;
        }

        // Kiểm tra xem mã KH có trùng không
        const isDuplicate = customers.some(c =>
            String(c.customerId || '').trim().toLowerCase() === inputValue
        );

        if (isDuplicate) {
            errorEl.style.display = 'block';
            this.style.borderColor = '#ef4444';
        } else {
            errorEl.style.display = 'none';
            this.style.borderColor = 'var(--border-color)';
        }
    });
}

document.getElementById('btnCancelDelete')?.addEventListener('click', function () { if (deleteModal) deleteModal.style.display = 'none'; });
document.getElementById('btnCancelEdit')?.addEventListener('click', function () {
    closeCustomerFormModal();
});

// ========== MODAL THAO TÁC KHÁCH HÀNG (3 OPTIONS & CHỨC NĂNG RIÊNG) ==========
let currentActionCustomerId = null;

function closeAllModals() {
    const modalIds = ['customerActionModal', 'editCustomerInfoModal', 'updateSalesModal', 'customerFormModal', 'reportModal', 'analysisModal', 'productAnalysisModal', 'historyModal', 'duplicateModal', 'deleteModal', 'warningModal', 'notificationModal', 'excelImportModal', 'kpi50MilestoneModal'];
    modalIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

// Modal Option 1: Chỉnh sửa thông tin khách hàng
function openEditCustomerInfoModal(customer) {
    if (!customer) return;
    currentActionCustomerId = customer.customerId;

    const idEl = document.getElementById('editCustomerId');
    const taxIdEl = document.getElementById('editTaxId');
    const compNameEl = document.getElementById('editCompanyName');
    const classEl = document.getElementById('editClassification');
    const categoryEl = document.getElementById('editCategory');
    const productDescEl = document.getElementById('editProductDesc');
    const contactEl = document.getElementById('editContactName');
    const phoneEl = document.getElementById('editPhone');
    const salesDisplayEl = document.getElementById('editSalesDisplay');
    const notesEl = document.getElementById('editNotes');

    if (idEl) { idEl.value = customer.customerId || ''; idEl.readOnly = true; idEl.style.backgroundColor = '#f1f5f9'; }
    if (taxIdEl) taxIdEl.value = customer.taxId || '';
    if (compNameEl) compNameEl.value = customer.companyName || '';
    if (classEl) classEl.value = customer.classification || '';
    if (categoryEl) categoryEl.value = customer.category || '';
    if (productDescEl) productDescEl.value = customer.productDesc || '';
    if (contactEl) contactEl.value = customer.contactName || '';
    if (phoneEl) phoneEl.value = customer.phone ? formatPhoneNumber(customer.phone) : '';
    if (salesDisplayEl) { salesDisplayEl.value = (customer.sales || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); salesDisplayEl.readOnly = true; }
    if (notesEl) notesEl.value = customer.notes || '';

    const modalEl = document.getElementById('editCustomerInfoModal');
    if (modalEl) modalEl.style.display = 'flex';
}

function closeEditCustomerInfoModal() {
    const modalEl = document.getElementById('editCustomerInfoModal');
    if (modalEl) modalEl.style.display = 'none';
}

// Modal Option 2: Cập nhật doanh số bán hàng & sản phẩm
function openUpdateSalesModal(customer) {
    if (!customer) return;
    currentActionCustomerId = customer.customerId;

    const subtitleEl = document.getElementById('updateSalesSubtitle');
    if (subtitleEl) subtitleEl.innerText = `${customer.customerId}${customer.companyName ? ' - ' + customer.companyName : ''}`;

    const amountInput = document.getElementById('salesAmountInput');
    const categorySelect = document.getElementById('salesCategorySelect');
    const productDescInput = document.getElementById('salesProductDescInput');
    const txNoteInput = document.getElementById('salesTxNoteInput');

    if (amountInput) {
        amountInput.value = '';
        amountInput.style.borderColor = 'var(--border-color)';
        amountInput.style.color = 'var(--text-main)';
    }
    if (categorySelect) categorySelect.value = '';
    if (productDescInput) productDescInput.value = '';
    if (txNoteInput) txNoteInput.value = '';

    const modalEl = document.getElementById('updateSalesModal');
    if (modalEl) modalEl.style.display = 'flex';

    setTimeout(() => {
        if (amountInput) amountInput.focus();
    }, 300);
}

function closeUpdateSalesModal() {
    const modalEl = document.getElementById('updateSalesModal');
    if (modalEl) modalEl.style.display = 'none';
}

document.getElementById('btnCloseEditInfoModal')?.addEventListener('click', closeAllModals);
document.getElementById('btnCancelEditInfo')?.addEventListener('click', () => {
    closeEditCustomerInfoModal();
    if (currentActionCustomerId) {
        showCustomerActionModal(currentActionCustomerId);
    }
});

document.getElementById('btnCloseUpdateSalesModal')?.addEventListener('click', closeAllModals);
document.getElementById('btnCancelUpdateSales')?.addEventListener('click', () => {
    closeUpdateSalesModal();
    if (currentActionCustomerId) {
        showCustomerActionModal(currentActionCustomerId);
    }
});

document.getElementById('btnDeleteCustomer')?.addEventListener('click', () => {
    closeEditCustomerInfoModal();
    if (currentActionCustomerId) {
        customerToDelete = currentActionCustomerId;
        if (deleteModalMessage) deleteModalMessage.innerHTML = `Bạn có chắc chắn muốn xóa khách hàng <strong>"${currentActionCustomerId}"</strong> không?`;
        if (deleteModal) deleteModal.style.display = 'flex';
    }
});

// Submit Form Option 1: Lưu Thông Tin Khách Hàng (Cập nhật Hồ sơ)
document.getElementById('editCustomerInfoForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const customer = customers.find(c => String(c.customerId).toLowerCase() === String(currentActionCustomerId).toLowerCase());
    if (!customer) return;

    customer.taxId = document.getElementById('editTaxId')?.value.trim() || '';
    customer.companyName = document.getElementById('editCompanyName')?.value.trim() || '';
    customer.classification = document.getElementById('editClassification')?.value || '';
    customer.category = document.getElementById('editCategory')?.value || '';
    customer.productDesc = document.getElementById('editProductDesc')?.value.trim() || '';
    customer.contactName = document.getElementById('editContactName')?.value.trim() || '';
    customer.phone = document.getElementById('editPhone')?.value.trim() || '';
    customer.notes = document.getElementById('editNotes')?.value.trim() || '';
    customer.lastUpdated = new Date().toISOString();

    const saveBtn = document.getElementById('btnSaveEditInfo');
    if (saveBtn) { saveBtn.innerText = 'Đang lưu...'; saveBtn.disabled = true; }

    const payload = mapToSupabase(customer);
    const { error } = await supabaseClient.from('Quan ly ban hang').update(payload).eq('customer_id', customer.customerId);

    if (saveBtn) { saveBtn.innerText = 'Cập nhật Hồ sơ'; saveBtn.disabled = false; }

    if (error) {
        alert("Lỗi khi cập nhật thông tin: " + error.message);
    } else {
        await fetchCustomers();
        updateCategoryDatalist(); // Cập nhật danh sách thể loại
        closeEditCustomerInfoModal();

        if (notificationTitle && notificationMessage && notificationModal) {
            notificationTitle.innerText = 'Thành công!';
            notificationTitle.style.color = '#10b981';
            notificationMessage.innerHTML = `Hồ sơ thông tin của khách hàng <strong>${customer.customerId}</strong> đã được cập nhật thành công!`;
            notificationModal.style.display = 'flex';
        }
    }
});

// Submit Form Option 2: Lưu Doanh Số & Sản Phẩm
document.getElementById('updateSalesForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const customer = customers.find(c => String(c.customerId).toLowerCase() === String(currentActionCustomerId).toLowerCase());
    if (!customer) return;

    const amountStr = document.getElementById('salesAmountInput')?.value.replace(/[,.]/g, '') || '';
    if (amountStr === '' || amountStr === '-') {
        alert("Vui lòng nhập số tiền doanh số phát sinh!");
        return;
    }

    const addedSales = Number(amountStr) || 0;
    if (addedSales === 0) {
        alert("Doanh số phát sinh phải khác 0!");
        return;
    }

    const categoryVal = document.getElementById('salesCategorySelect')?.value || '';
    const productDescVal = document.getElementById('salesProductDescInput')?.value.trim() || '';
    const txNoteVal = document.getElementById('salesTxNoteInput')?.value.trim() || '';

    let fullNoteParts = [];
    if (categoryVal) fullNoteParts.push(`[${categoryVal}]`);
    if (productDescVal) fullNoteParts.push(productDescVal);
    if (txNoteVal) fullNoteParts.push(txNoteVal);

    const historyNote = fullNoteParts.length > 0 ? fullNoteParts.join(' - ') : 'Cập nhật (+/-)';

    customer.sales = (customer.sales || 0) + addedSales;
    if (!Array.isArray(customer.history)) customer.history = [];
    customer.history.push({
        date: new Date().toISOString(),
        amount: addedSales,
        note: historyNote,
        category: categoryVal,
        productDesc: productDescVal,
        updated_by: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống'
    });
    customer.lastUpdated = new Date().toISOString();

    const saveBtn = document.getElementById('btnSaveUpdateSales');
    if (saveBtn) { saveBtn.innerText = 'Đang lưu...'; saveBtn.disabled = true; }

    const payload = mapToSupabase(customer);
    const { error } = await supabaseClient.from('Quan ly ban hang').update(payload).eq('customer_id', customer.customerId);

    if (saveBtn) { saveBtn.innerText = 'Lưu Doanh Số & Sản Phẩm'; saveBtn.disabled = false; }

    if (error) {
        alert("Lỗi khi cập nhật doanh số: " + error.message);
    } else {
        let titleColor = addedSales > 0 ? '#10b981' : '#ef4444';
        let actionText = addedSales > 0 ? `Tăng thêm ${formatCurrency(addedSales)}` : `Giảm đi ${formatCurrency(Math.abs(addedSales))}`;

        await fetchCustomers();
        updateCategoryDatalist(); // Cập nhật danh sách thể loại
        closeUpdateSalesModal();

        if (notificationTitle && notificationMessage && notificationModal) {
            notificationTitle.innerText = 'Thành công!';
            notificationTitle.style.color = titleColor;
            notificationMessage.innerHTML = `Doanh số của khách hàng <strong>${customer.customerId}</strong> đã được <br><strong style="color: ${titleColor}; font-size: 18px;">${actionText}</strong>`;
            notificationModal.style.display = 'flex';
        }
    }
});

function showCustomerActionModal(customerId) {
    if (!customerId) return;
    const customer = customers.find(c => String(c.customerId || '').trim().toLowerCase() === String(customerId || '').trim().toLowerCase());
    if (!customer) return;

    currentActionCustomerId = customer.customerId;
    const custIdEl = document.getElementById('actionModalCustId');
    const compNameEl = document.getElementById('actionModalCompanyName');
    const modalEl = document.getElementById('customerActionModal');

    if (custIdEl) custIdEl.innerText = customer.customerId;
    if (compNameEl) compNameEl.innerText = customer.companyName ? `(${customer.companyName})` : '(Chưa có tên công ty)';

    if (modalEl) modalEl.style.display = 'flex';
}
window.showCustomerActionModal = showCustomerActionModal;

function closeCustomerActionModal() {
    const modalEl = document.getElementById('customerActionModal');
    if (modalEl) modalEl.style.display = 'none';
}

document.getElementById('btnCloseCustomerActionModal')?.addEventListener('click', closeCustomerActionModal);
document.getElementById('btnCloseCustomerActionBtn')?.addEventListener('click', closeCustomerActionModal);

// Lựa chọn 1: Chỉnh sửa thông tin khách hàng
document.getElementById('btnOptEditInfo')?.addEventListener('click', () => {
    closeAllModals();
    const customer = customers.find(c => String(c.customerId).toLowerCase() === String(currentActionCustomerId).toLowerCase());
    if (customer) {
        openEditCustomerInfoModal(customer);
    }
});

// Lựa chọn 2: Cập nhật doanh số bán hàng & sản phẩm
document.getElementById('btnOptUpdateSales')?.addEventListener('click', () => {
    closeAllModals();
    const customer = customers.find(c => String(c.customerId).toLowerCase() === String(currentActionCustomerId).toLowerCase());
    if (customer) {
        openUpdateSalesModal(customer);
    }
});

// Lựa chọn 3: Xem lịch sử cập nhật chi tiết
document.getElementById('btnOptViewHistory')?.addEventListener('click', () => {
    closeCustomerActionModal();
    if (currentActionCustomerId) {
        showHistoryModal(currentActionCustomerId);
    }
});

document.getElementById('btnConfirmModal')?.addEventListener('click', async function () {
    if (!pendingCustomerData) return;
    const index = customers.findIndex(c => String(c.customerId).toLowerCase() === String(pendingCustomerData.customerId).toLowerCase());
    if (index !== -1) {
        pendingCustomerData.history = customers[index].history || [];
        pendingCustomerData.lastUpdated = new Date().toISOString();

        const btn = document.getElementById('btnConfirmModal');
        if (btn) { btn.innerText = 'Đang ghi đè...'; btn.disabled = true; }

        const payload = mapToSupabase(pendingCustomerData);
        const { error } = await supabaseClient.from('Quan ly ban hang').update(payload).eq('customer_id', pendingCustomerData.customerId);

        if (btn) { btn.innerText = 'Có, Cập nhật'; btn.disabled = false; }
        if (error) alert("Gặp lỗi khi ghi đè dữ liệu: " + error.message);
        else await fetchCustomers();
    }
    if (modal) modal.style.display = 'none';
});
document.getElementById('btnCancelModal')?.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });

function getFilteredAndSortedData() {
    const query = searchInput.value.toLowerCase(); const filterClassVal = filterClassification ? filterClassification.value : '';
    let filtered = customers.filter(c => {
        const matchSearch = String(c.customerId || '').toLowerCase().includes(query) || (c.companyName && String(c.companyName).toLowerCase().includes(query)) ||
            (c.taxId && String(c.taxId).toLowerCase().includes(query)) || (c.contactName && String(c.contactName).toLowerCase().includes(query)) ||
            (c.phone && String(c.phone).includes(query)) || (c.classification && String(c.classification).toLowerCase().includes(query));
        const matchClass = filterClassVal === '' || c.classification === filterClassVal;
        return matchSearch && matchClass;
    });
    filtered.sort((a, b) => b.sales - a.sales);
    return filtered;
}

document.getElementById('btnExportExcel').addEventListener('click', function () {
    const data = getFilteredAndSortedData(); if (data.length === 0) return;
    const exportData = data.map((c, index) => ({
        "STT": index + 1, "Mã KH": c.customerId || "", "Phân loại": c.classification || "",
        "MST": c.taxId || "", "Tên Công ty": c.companyName || "", "Người liên hệ": c.contactName || "",
        "Số điện thoại": formatPhoneNumber(c.phone) === '-' ? '' : formatPhoneNumber(c.phone), "Doanh số KH (VNĐ)": c.sales || 0, "Ngày cập nhật": formatDateTime(c.lastUpdated), "Ghi chú": c.notes || ""
    }));
    const ws = XLSX.utils.json_to_sheet(exportData); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Doanh_So_Khach_Hang"); XLSX.writeFile(wb, "Bang_Xep_Hang_Doanh_So.xlsx");
});

document.getElementById('btnExportPDF').addEventListener('click', function () {
    const data = getFilteredAndSortedData(); if (data.length === 0) return;
    const tableBodyData = [];
    tableBodyData.push([{ text: 'STT', style: 'tableHeader', alignment: 'center' }, { text: 'Mã KH', style: 'tableHeader' }, { text: 'MST', style: 'tableHeader' }, { text: 'Tên Công ty', style: 'tableHeader' }, { text: 'Người LH', style: 'tableHeader' }, { text: 'SĐT', style: 'tableHeader' }, { text: 'Doanh số (VNĐ)', style: 'tableHeader', alignment: 'right' }, { text: 'Ngày cập nhật', style: 'tableHeader' }, { text: 'Ghi chú', style: 'tableHeader' }]);
    data.forEach((c, index) => {
        let salesColor = c.sales >= 0 ? '#10b981' : '#ef4444'; let maKhColor = (c.classification && classificationColors[c.classification]) ? classificationColors[c.classification] : '#2563eb';
        tableBodyData.push([
            { text: (index + 1).toString(), alignment: 'center' }, { text: c.customerId || '-', color: maKhColor, bold: true },
            { text: c.taxId || '-' }, { text: c.companyName || '-', bold: true }, { text: c.contactName || '-' }, { text: formatPhoneNumber(c.phone) },
            { text: formatCurrency(c.sales || 0), alignment: 'right', color: salesColor, bold: true },
            { text: formatDateTime(c.lastUpdated), fontSize: 9 }, { text: c.notes || '-' }
        ]);
    });
    const docDefinition = {
        pageOrientation: 'landscape', pageSize: 'A4',
        content: [{ text: 'Bảng Xếp hạng Doanh số Khách hàng', style: 'header' }, { table: { headerRows: 1, widths: ['4%', '11%', '9%', '21%', '11%', '10%', '13%', '12%', '9%'], body: tableBodyData }, layout: { hLineWidth: function (i) { return 1; }, vLineWidth: function (i) { return 1; }, hLineColor: function (i) { return '#e2e8f0'; }, vLineColor: function (i) { return '#e2e8f0'; }, paddingLeft: function (i) { return 6; }, paddingRight: function (i) { return 6; }, paddingTop: function (i) { return 8; }, paddingBottom: function (i) { return 8; } } }],
        styles: { header: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 15], color: '#2563eb' }, tableHeader: { bold: true, fontSize: 11, color: '#475569', fillColor: '#f8fafc' } }, defaultStyle: { fontSize: 10 }
    };
    pdfMake.createPdf(docDefinition).download('Bang_Xep_Hang_Doanh_So.pdf');
});

document.getElementById('btnCloseReport')?.addEventListener('click', () => {
    const reportModal = document.getElementById('reportModal');
    if (reportModal) reportModal.style.display = 'none';
});

function populateMonthSelect() {
    const reportMonthSelect = document.getElementById('reportMonthSelect');
    if (!reportMonthSelect) return;
    reportMonthSelect.innerHTML = '';
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const option = document.createElement('option');
        option.value = `${year}-${month}`;
        option.text = i === 0 ? `Tháng ${month}/${year} (Tháng này)` : `Tháng ${month}/${year}`;
        reportMonthSelect.appendChild(option);
    }
}

function showRevenueReport() {
    const reportMonthSelect = document.getElementById('reportMonthSelect');
    if (!reportMonthSelect) return;

    if (!reportMonthSelect.options || reportMonthSelect.options.length === 0) {
        populateMonthSelect();
    }

    const selectedValue = reportMonthSelect.value;
    let year, monthIndex, monthLabel;
    if (selectedValue && selectedValue.includes('-')) {
        const parts = selectedValue.split('-');
        year = parseInt(parts[0], 10);
        monthIndex = parseInt(parts[1], 10) - 1;
        monthLabel = `${monthIndex + 1}/${year}`;
    } else {
        const now = new Date();
        year = now.getFullYear();
        monthIndex = now.getMonth();
        monthLabel = `${monthIndex + 1}/${year}`;
    }

    let start = new Date(year, monthIndex, 1); start.setHours(0, 0, 0, 0);
    let end = new Date(year, monthIndex + 1, 0); end.setHours(23, 59, 59, 999);

    let totalRevenuePeriod = 0;
    let transactionsInPeriod = [];

    if (Array.isArray(customers)) {
        customers.forEach(c => {
            if (c.history && Array.isArray(c.history) && c.history.length > 0) {
                c.history.forEach(tx => {
                    if (tx.date) {
                        const txDate = new Date(tx.date);
                        if (txDate >= start && txDate <= end && tx.amount !== 0) {
                            transactionsInPeriod.push({ customer: c, tx: tx, date: txDate });
                        }
                    }
                });
            }
        });
    }

    transactionsInPeriod.sort((a, b) => b.date - a.date);

    const reportTableBody = document.getElementById('reportTableBody');
    if (reportTableBody) {
        reportTableBody.innerHTML = '';
        if (transactionsInPeriod.length === 0) {
            reportTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #64748b;">Không có giao dịch/biến động doanh thu nào phát sinh trong <strong>Tháng ${monthLabel}</strong>.</td></tr>`;
            const reportTotalEl = document.getElementById('reportTotalRevenue');
            if (reportTotalEl) {
                reportTotalEl.innerText = "0 đ";
                reportTotalEl.style.color = "#64748b";
            }
        } else {
            transactionsInPeriod.forEach(item => {
                const c = item.customer;
                const tx = item.tx;
                const formattedTime = item.date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                totalRevenuePeriod += Number(tx.amount || 0);
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.onclick = () => { if (c && c.customerId) showCustomerActionModal(c.customerId); };
                tr.innerHTML = `<td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center;">${formattedTime}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: var(--primary-color);" class="customer-id-cell" title="Click để thao tác">${c.customerId || '-'}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${c.companyName || '-'}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; white-space: nowrap;">${formatSalesScaledByMagnitude(tx.amount)}</td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${tx.note || '-'}</td>`;
                reportTableBody.appendChild(tr);
            });
            const reportTotalEl = document.getElementById('reportTotalRevenue');
            if (reportTotalEl) {
                reportTotalEl.innerText = formatCurrency(totalRevenuePeriod);
                reportTotalEl.style.color = totalRevenuePeriod >= 0 ? "#10b981" : "#ef4444";
            }
        }
    }

    const reportModal = document.getElementById('reportModal');
    if (reportModal) reportModal.style.display = 'flex';
}

document.getElementById('reportMonthSelect')?.addEventListener('change', showRevenueReport);
document.getElementById('btnReportMonth')?.addEventListener('click', () => {
    populateMonthSelect();
    showRevenueReport();
});

let chartClassificationInstance = null;
let chartTopCustomersInstance = null;
let chartRevenueTrendInstance = null;
let chartTopProductsInstance = null;
let chartTopRevenueProductsInstance = null;
let chartProductDistributionInstance = null;
let chartTopProductsByCustomersInstance = null;

function showAnalysisModal() {
    const selectedValue = reportMonthSelect.value;
    let year, monthIndex, monthLabel;
    if (selectedValue) {
        const parts = selectedValue.split('-');
        year = parseInt(parts[0], 10);
        monthIndex = parseInt(parts[1], 10) - 1;
        monthLabel = `${monthIndex + 1}/${year}`;
    } else {
        const now = new Date();
        year = now.getFullYear();
        monthIndex = now.getMonth();
        monthLabel = `${monthIndex + 1}/${year}`;
    }

    document.getElementById('analysisTitle').innerText = `Phân Tích Doanh Thu & Khách Hàng - Tháng ${monthLabel}`;

    let start = new Date(year, monthIndex, 1);
    start.setHours(0, 0, 0, 0);
    let end = new Date(year, monthIndex + 1, 0);
    end.setHours(23, 59, 59, 999);

    let totalRevenueMonth = 0;
    let txCountMonth = 0;
    const customerRevenueMap = {};
    const classCountMap = {
        "Khách mới": 0,
        "Thường xuyên": 0,
        "Không thường xuyên": 0,
        "Chưa liên hệ được": 0,
        "Không nhu cầu": 0,
        "Chưa phân loại": 0
    };

    // Xác định khoảng thời gian tháng trước để so sánh tăng trưởng/sụt giảm
    let prevStart = new Date(year, monthIndex - 1, 1);
    prevStart.setHours(0, 0, 0, 0);
    let prevEnd = new Date(year, monthIndex, 0);
    prevEnd.setHours(23, 59, 59, 999);

    let newCustCount = 0;
    let returningCustCount = 0;
    let newCustRevenue = 0;
    let returningCustRevenue = 0;
    let totalActiveCust = 0;

    customers.forEach(c => {
        let customerHasTxInMonth = false;
        let customerRevenueInMonth = 0;

        if (c.history && c.history.length > 0) {
            c.history.forEach(tx => {
                const txDate = new Date(tx.date);
                if (txDate >= start && txDate <= end && tx.amount !== 0) {
                    totalRevenueMonth += tx.amount;
                    txCountMonth++;
                    customerRevenueInMonth += tx.amount;
                    customerHasTxInMonth = true;
                }
            });
        }

        if (customerHasTxInMonth) {
            totalActiveCust++;

            // Xác định khách mới trong tháng (giao dịch đầu tiên nằm trong tháng được chọn)
            const dates = c.history.map(tx => new Date(tx.date).getTime());
            const minDate = new Date(Math.min(...dates));
            const isNewThisMonth = minDate >= start && minDate <= end;

            if (isNewThisMonth) {
                newCustCount++;
                newCustRevenue += customerRevenueInMonth;
            } else {
                returningCustCount++;
                returningCustRevenue += customerRevenueInMonth;
            }

            customerRevenueMap[c.customerId] = {
                customerId: c.customerId,
                companyName: c.companyName || '-',
                classification: c.classification || 'Chưa phân loại',
                amount: customerRevenueInMonth
            };

            const classification = c.classification || 'Chưa phân loại';
            if (classCountMap.hasOwnProperty(classification)) {
                classCountMap[classification]++;
            } else {
                classCountMap["Chưa phân loại"]++;
            }
        }
    });

    // Tính toán so sánh với tháng trước
    let prevRevenueMonth = 0;
    customers.forEach(c => {
        if (c.history && c.history.length > 0) {
            c.history.forEach(tx => {
                const txDate = new Date(tx.date);
                if (txDate >= prevStart && txDate <= prevEnd && tx.amount !== 0) {
                    prevRevenueMonth += tx.amount;
                }
            });
        }
    });

    const revDiff = totalRevenueMonth - prevRevenueMonth;
    let revPctStr = '';
    let compareColor = 'var(--text-muted)';
    if (prevRevenueMonth > 0) {
        const pct = Math.round((revDiff / prevRevenueMonth) * 100);
        const sign = pct >= 0 ? '+' : '';
        revPctStr = `${sign}${pct}% so với tháng trước (${pct >= 0 ? '+' : ''}${formatCurrency(revDiff)})`;
        compareColor = pct >= 0 ? '#10b981' : '#ef4444';
    } else if (totalRevenueMonth > 0) {
        revPctStr = `Mới (+${formatCurrency(totalRevenueMonth)})`;
        compareColor = '#10b981';
    } else {
        revPctStr = `0% so với tháng trước`;
    }

    // Tính toán tổng doanh thu của toàn bộ hệ thống
    const totalWebSales = customers.reduce((sum, c) => sum + (c.sales || 0), 0);

    // Tính toán tỷ lệ phần trăm khách mới/cũ
    const newCustRatio = totalActiveCust > 0 ? Math.round((newCustCount / totalActiveCust) * 100) : 0;
    const newCustRevenueRatio = totalRevenueMonth > 0 ? Math.round((newCustRevenue / totalRevenueMonth) * 100) : 0;

    const returnCustRatio = totalActiveCust > 0 ? Math.round((returningCustCount / totalActiveCust) * 100) : 0;
    const returnCustRevenueRatio = totalRevenueMonth > 0 ? Math.round((returningCustRevenue / totalRevenueMonth) * 100) : 0;

    // Cập nhật thẻ chỉ số KPI chính
    document.getElementById('kpiRevenueAllTime').innerText = formatCurrency(totalWebSales);
    document.getElementById('kpiRevenue').innerText = formatCurrency(totalRevenueMonth);
    document.getElementById('kpiRevenueCompare').innerText = revPctStr;
    document.getElementById('kpiRevenueCompare').style.color = compareColor;
    document.getElementById('kpiTxCount').innerText = txCountMonth;
    document.getElementById('kpiNewCustomers').innerText = newCustCount;

    // Cập nhật các thẻ tỷ lệ mới/cũ
    document.getElementById('kpiNewCustRatio').innerHTML = `${newCustRatio}% <span style="font-size: 12px; font-weight: normal; color: var(--text-muted);">${newCustCount}/${totalActiveCust} KH</span>`;
    document.getElementById('kpiNewCustRevenueRatio').innerText = `Đóng góp: ${newCustRevenueRatio}% doanh số (${formatCurrency(newCustRevenue)})`;

    document.getElementById('kpiReturnCustRatio').innerHTML = `${returnCustRatio}% <span style="font-size: 12px; font-weight: normal; color: var(--text-muted);">${returningCustCount}/${totalActiveCust} KH</span>`;
    document.getElementById('kpiReturnCustRevenueRatio').innerText = `Đóng góp: ${returnCustRevenueRatio}% doanh số (${formatCurrency(returningCustRevenue)})`;

    // Tính xu hướng doanh thu từ tháng 1 đến tháng 12 của năm được chọn (ví dụ năm 2026)
    const last12Months = [];
    for (let i = 0; i < 12; i++) {
        last12Months.push({
            year: year,
            month: i + 1,
            label: `T${String(i + 1).padStart(2, '0')}-${year}`
        });
    }

    const monthlyRevenues = last12Months.map(m => {
        const mStart = new Date(m.year, m.month - 1, 1);
        mStart.setHours(0, 0, 0, 0);
        const mEnd = new Date(m.year, m.month, 0);
        mEnd.setHours(23, 59, 59, 999);

        let rev = 0;
        customers.forEach(c => {
            if (c.history && c.history.length > 0) {
                c.history.forEach(tx => {
                    const txDate = new Date(tx.date);
                    if (txDate >= mStart && txDate <= mEnd && tx.amount !== 0) {
                        rev += tx.amount;
                    }
                });
            }
        });
        return rev;
    });

    // Populate table details
    const analysisTableBody = document.getElementById('analysisTableBody');
    analysisTableBody.innerHTML = '';

    const activeCustomersList = Object.values(customerRevenueMap).sort((a, b) => b.amount - a.amount);
    if (activeCustomersList.length === 0) {
        analysisTableBody.innerHTML = `<tr><td colspan="2" class="text-center" style="color: var(--text-muted); padding: 15px;">Không có dữ liệu giao dịch trong tháng này.</td></tr>`;
    } else {
        activeCustomersList.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';
            tr.style.cursor = 'pointer';
            tr.onclick = () => { if (item && item.customerId) showCustomerActionModal(item.customerId); };
            tr.innerHTML = `
                <td style="width: 75% !important; max-width: 75% !important; padding: 10px 8px; font-weight: bold; color: var(--primary-color); text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" class="customer-id-cell" title="Click để thao tác">${item.customerId}</td>
                <td style="width: 25% !important; max-width: 25% !important; padding: 10px 8px; text-align: right; white-space: nowrap;">${formatSalesScaledByMagnitude(item.amount)}</td>
            `;
            analysisTableBody.appendChild(tr);
        });
    }

    // Create charts
    createAnalysisCharts(classCountMap, activeCustomersList.slice(0, 5), last12Months.map(m => m.label), monthlyRevenues);

    document.getElementById('analysisModal').style.display = 'flex';
}

function showProductAnalysisModal() {
    const selectedValue = reportMonthSelect.value;
    let year, monthIndex, monthLabel;
    if (selectedValue) {
        const parts = selectedValue.split('-');
        year = parseInt(parts[0], 10);
        monthIndex = parseInt(parts[1], 10) - 1;
        monthLabel = `${monthIndex + 1}/${year}`;
    } else {
        const now = new Date();
        year = now.getFullYear();
        monthIndex = now.getMonth();
        monthLabel = `${monthIndex + 1}/${year}`;
    }

    document.getElementById('productAnalysisTitle').innerText = `Phân Tích Sản Phẩm & Doanh Thu - Tháng ${monthLabel}`;

    let start = new Date(year, monthIndex, 1);
    start.setHours(0, 0, 0, 0);
    let end = new Date(year, monthIndex + 1, 0);
    end.setHours(23, 59, 59, 999);

    // Tính thời gian tháng trước
    const prevYear = monthIndex === 0 ? year - 1 : year;
    const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
    let startPrev = new Date(prevYear, prevMonthIndex, 1, 0, 0, 0, 0);
    let endPrev = new Date(prevYear, prevMonthIndex + 1, 0, 23, 59, 59, 999);

    const productStats = {};
    const prevProductCounts = {};
    let totalRevenue = 0;
    let totalPurchases = 0;

    // Thu thập dữ liệu sản phẩm từ lịch sử
    customers.forEach(c => {
        if (c.history && c.history.length > 0) {
            c.history.forEach(tx => {
                const txDate = new Date(tx.date);
                if (tx.amount !== 0) {
                    const productName = tx.category || c.category || 'Không rõ';

                    // Tháng hiện tại
                    if (txDate >= start && txDate <= end) {
                        if (!productStats[productName]) {
                            productStats[productName] = {
                                name: productName,
                                count: 0,
                                revenue: 0,
                                customers: new Set()
                            };
                        }

                        productStats[productName].count++;
                        productStats[productName].revenue += tx.amount;
                        productStats[productName].customers.add(c.customerId);
                        totalRevenue += tx.amount;
                        totalPurchases++;
                    }

                    // Tháng trước
                    if (txDate >= startPrev && txDate <= endPrev) {
                        prevProductCounts[productName] = (prevProductCounts[productName] || 0) + 1;
                    }
                }
            });
        }
    });

    const productsArray = Object.values(productStats).map(p => ({
        name: p.name,
        count: p.count,
        revenue: p.revenue,
        customerCount: p.customers.size
    }));
    const totalProducts = productsArray.length;

    // Cập nhật KPI
    document.getElementById('kpiTotalProducts').innerText = totalProducts;
    document.getElementById('kpiTotalPurchases').innerText = totalPurchases;
    document.getElementById('kpiProductRevenue').innerText = formatCurrency(totalRevenue);

    // Sắp xếp theo số lượt mua
    const topByCount = [...productsArray].sort((a, b) => b.count - a.count).slice(0, 5);

    // Sắp xếp theo doanh thu
    const topByRevenue = [...productsArray].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Populate table chi tiết sản phẩm
    const tableBody = document.getElementById('productAnalysisTableBody');
    tableBody.innerHTML = '';

    const sortedProducts = [...productsArray].sort((a, b) => b.revenue - a.revenue);

    sortedProducts.forEach(product => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #e2e8f0';
        tr.innerHTML = `
            <td style="width: 45%; padding: 8px 6px; font-weight: 600; color: var(--primary-color); font-size: 13px; overflow: hidden; text-overflow: ellipsis;" title="${product.name}">${product.name}</td>
            <td style="width: 20%; padding: 8px 6px; text-align: center; font-weight: 600; font-size: 13px;">${product.count}</td>
            <td style="width: 35%; padding: 8px 6px; text-align: right; font-weight: bold; color: #10b981; font-size: 13px; white-space: nowrap;">${formatCurrency(product.revenue)}</td>
        `;
        tableBody.appendChild(tr);
    });

    // Đổ dữ liệu bảng so sánh với tháng trước
    const allComparisonProductNames = new Set([
        ...Object.keys(productStats),
        ...Object.keys(prevProductCounts)
    ]);

    const comparisonList = Array.from(allComparisonProductNames).map(name => {
        const prevCount = prevProductCounts[name] || 0;
        const currCount = productStats[name] ? productStats[name].count : 0;
        const diff = currCount - prevCount;

        let growthRateText = '0%';
        if (prevCount > 0) {
            const growthRate = ((currCount - prevCount) / prevCount) * 100;
            const sign = growthRate > 0 ? '+' : '';
            growthRateText = `${sign}${growthRate.toFixed(0)}%`;
        } else if (currCount > 0) {
            growthRateText = '+100%';
        } else {
            growthRateText = '0%';
        }

        let diffText = '0';
        if (diff > 0) diffText = `+${diff}`;
        else if (diff < 0) diffText = `${diff}`;

        let statusHtml = '';
        if (diff > 0) {
            statusHtml = '<span style="color: #16a34a; font-weight: bold;">📈 Tăng</span>';
        } else if (diff < 0) {
            statusHtml = '<span style="color: #dc2626; font-weight: bold;">📉 Giảm</span>';
        } else {
            statusHtml = '<span style="color: #64748b;">➖ Bằng</span>';
        }

        return {
            name,
            prevCount,
            currCount,
            diff,
            diffText,
            growthRateText,
            statusHtml
        };
    });

    comparisonList.sort((a, b) => b.currCount - a.currCount || b.diff - a.diff);

    const comparisonTableBody = document.getElementById('productComparisonTableBody');
    if (comparisonTableBody) {
        comparisonTableBody.innerHTML = '';
        if (comparisonList.length === 0) {
            comparisonTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 12px;">Không có dữ liệu so sánh</td></tr>`;
        } else {
            comparisonList.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #e2e8f0';
                tr.innerHTML = `
                    <td style="padding: 8px 4px; font-weight: 600; color: var(--primary-color); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.name}">${item.name}</td>
                    <td style="padding: 8px 4px; text-align: center; font-size: 13px;">${item.prevCount}</td>
                    <td style="padding: 8px 4px; text-align: center; font-weight: bold; font-size: 13px;">${item.currCount}</td>
                    <td style="padding: 8px 4px; text-align: center; font-weight: 600; font-size: 13px; color: ${item.diff > 0 ? '#16a34a' : (item.diff < 0 ? '#dc2626' : '#475569')};">${item.diffText}</td>
                    <td style="padding: 8px 4px; text-align: center; font-weight: 600; font-size: 13px; color: ${item.diff > 0 ? '#16a34a' : (item.diff < 0 ? '#dc2626' : '#475569')};">${item.growthRateText}</td>
                    <td style="padding: 8px 4px; text-align: center; font-size: 13px;">${item.statusHtml}</td>
                `;
                comparisonTableBody.appendChild(tr);
            });
        }
    }

    // Create charts
    createProductCharts(topByCount, topByRevenue, productsArray);

    document.getElementById('productAnalysisModal').style.display = 'flex';
}

function createProductCharts(topByCount, topByRevenue, productsArray) {
    // Destroy previous instances
    if (chartTopProductsInstance) chartTopProductsInstance.destroy();
    if (chartTopRevenueProductsInstance) chartTopRevenueProductsInstance.destroy();
    if (chartProductDistributionInstance) chartProductDistributionInstance.destroy();

    // Chart 1: Top sản phẩm theo số lượt mua
    const ctx1 = document.getElementById('chartTopProducts').getContext('2d');
    chartTopProductsInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: topByCount.map(p => p.name),
            datasets: [{
                label: 'Số lượt mua',
                data: topByCount.map(p => p.count),
                backgroundColor: '#3b82f6',
                borderColor: '#2563eb',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            }
        }
    });

    // Chart 2: Top sản phẩm theo doanh thu
    const ctx2 = document.getElementById('chartTopRevenueProducts').getContext('2d');
    chartTopRevenueProductsInstance = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: topByRevenue.map(p => p.name),
            datasets: [{
                label: 'Doanh thu (VNĐ)',
                data: topByRevenue.map(p => p.revenue),
                backgroundColor: '#10b981',
                borderColor: '#059669',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        callback: function (value) {
                            if (value >= 1e6) return (value / 1e6) + ' Tr';
                            return value.toLocaleString('vi-VN');
                        }
                    }
                }
            }
        }
    });

    // Chart 3: Phân bố sản phẩm theo doanh thu (Doughnut)
    const ctx3 = document.getElementById('chartProductDistribution').getContext('2d');

    // Lấy top 5 sản phẩm và nhóm còn lại
    const top5Products = [...productsArray].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const othersRevenue = productsArray.slice(5).reduce((sum, p) => sum + p.revenue, 0);

    const labels = top5Products.map(p => p.name);
    const data = top5Products.map(p => p.revenue);
    const colors = ['#3b82f6', '#f59e0b', '#ec4899', '#10b981', '#8b5cf6'];

    if (othersRevenue > 0) {
        labels.push('Sản phẩm khác');
        data.push(othersRevenue);
        colors.push('#94a3b8');
    }

    chartProductDistributionInstance = new Chart(ctx3, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createAnalysisCharts(classCounts, topCustomers, trendLabels, trendData) {
    // Destroy previous instances
    if (chartClassificationInstance) chartClassificationInstance.destroy();
    if (chartTopCustomersInstance) chartTopCustomersInstance.destroy();
    if (chartRevenueTrendInstance) chartRevenueTrendInstance.destroy();

    // 1. Classification doughnut chart
    const ctxClass = document.getElementById('chartClassification').getContext('2d');
    const classLabels = Object.keys(classCounts).filter(k => classCounts[k] > 0);
    const classData = classLabels.map(k => classCounts[k]);
    const classColors = classLabels.map(k => classificationColors[k] || '#94a3b8');

    if (classData.length === 0) {
        classLabels.push("Không có dữ liệu");
        classData.push(1);
        classColors.push("#cbd5e1");
    }

    chartClassificationInstance = new Chart(ctxClass, {
        type: 'doughnut',
        data: {
            labels: classLabels,
            datasets: [{
                data: classData,
                backgroundColor: classColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 11 }
                    }
                }
            }
        }
    });

    // 2. Top customers bar chart
    const ctxTop = document.getElementById('chartTopCustomers').getContext('2d');
    const topLabels = topCustomers.map(c => c.customerId);
    const topData = topCustomers.map(c => c.amount);

    chartTopCustomersInstance = new Chart(ctxTop, {
        type: 'bar',
        data: {
            labels: topLabels,
            datasets: [{
                label: 'Doanh thu tăng (VNĐ)',
                data: topData,
                backgroundColor: '#3b82f6',
                borderColor: '#2563eb',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: {
                        callback: function (value) {
                            if (value >= 1e6) return (value / 1e6) + ' Tr';
                            return value.toLocaleString('vi-VN');
                        }
                    }
                }
            }
        }
    });

    // 3. Revenue Trend line chart
    const ctxTrend = document.getElementById('chartRevenueTrend').getContext('2d');
    chartRevenueTrendInstance = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: trendLabels,
            datasets: [{
                label: 'Doanh thu tháng (VNĐ)',
                data: trendData,
                borderColor: '#ea580c',
                backgroundColor: 'rgba(234, 88, 12, 0.05)',
                borderWidth: 3,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8,
                tension: 0.35,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 25
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Doanh thu: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    grace: '20%',
                    ticks: {
                        callback: function (value) {
                            if (value >= 1e6) return (value / 1e6).toFixed(1) + ' Tr';
                            return value.toLocaleString('vi-VN') + ' đ';
                        }
                    },
                    grid: {
                        color: '#f1f5f9'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        },
        plugins: [{
            id: 'customDataLabels',
            afterDatasetsDraw: function (chart) {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    meta.data.forEach((point, index) => {
                        const dataVal = dataset.data[index];
                        const label = dataVal === 0 ? '0 đ' : formatCurrency(dataVal);

                        ctx.font = 'bold 11px sans-serif';
                        const textWidth = ctx.measureText(label).width;
                        const textHeight = 12;

                        const x = point.x;
                        const y = point.y - 18;

                        ctx.fillStyle = '#fef08a';
                        ctx.strokeStyle = '#facc15';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        if (ctx.roundRect) {
                            ctx.roundRect(x - textWidth / 2 - 4, y - textHeight - 2, textWidth + 8, textHeight + 6, 3);
                        } else {
                            ctx.rect(x - textWidth / 2 - 4, y - textHeight - 2, textWidth + 8, textHeight + 6);
                        }
                        ctx.fill();
                        ctx.stroke();

                        ctx.fillStyle = '#854d0e';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(label, x, y - textHeight / 2 + 1);
                    });
                });
            }
        }]
    });
}

const btnImportExcel = document.getElementById('btnImportExcel');
const excelImportModal = document.getElementById('excelImportModal');
const excelImportMonth = document.getElementById('excelImportMonth');
const btnCancelExcelImport = document.getElementById('btnCancelExcelImport');
const btnConfirmExcelImport = document.getElementById('btnConfirmExcelImport');

let pendingExcelData = null;

btnImportExcel.addEventListener('click', function () { fileInputExcel.value = null; fileInputExcel.click(); });

fileInputExcel.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            pendingExcelData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: "" });

            // Hiển thị modal chọn tháng
            populateExcelImportMonths();
            excelImportModal.style.display = 'flex';
        } catch (error) {
            alert("Không thể đọc tệp Excel. Vui lòng kiểm tra lại cấu trúc file!");
        }
    };
    reader.readAsArrayBuffer(file);
});

function populateExcelImportMonths() {
    if (!excelImportMonth) return;
    excelImportMonth.innerHTML = '';
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const option = document.createElement('option');
        option.value = `${year}-${month}`;
        option.text = i === 0 ? `Tháng ${month}/${year} (Tháng này)` : `Tháng ${month}/${year}`;
        excelImportMonth.appendChild(option);
    }
}

if (btnCancelExcelImport) {
    btnCancelExcelImport.addEventListener('click', function () {
        excelImportModal.style.display = 'none';
        pendingExcelData = null;
    });
}

if (btnConfirmExcelImport) {
    btnConfirmExcelImport.addEventListener('click', async function () {
        if (!pendingExcelData) return;

        const selectedValue = excelImportMonth.value;
        const parts = selectedValue.split('-');
        const selectedYear = parseInt(parts[0], 10);
        const selectedMonth = parseInt(parts[1], 10); // 1-indexed

        // Ngày ghi nhận (chọn ngày 28 của tháng đó để an toàn và tránh múi giờ lệch)
        const targetDate = new Date(selectedYear, selectedMonth - 1, 28, 12, 0, 0).toISOString();
        const nowStr = new Date().toISOString();

        excelImportModal.style.display = 'none';
        btnImportExcel.innerText = "Đang xử lý...";
        btnImportExcel.disabled = true;

        try {
            let importedCount = 0;
            let updatedCount = 0;
            const payloadsToUpsert = [];

            pendingExcelData.forEach(row => {
                const normRow = {};
                for (let k in row) if (row.hasOwnProperty(k)) normRow[k.trim().toLowerCase()] = row[k];
                const custId = String(normRow["mã kh"] || normRow["mã khách hàng"] || normRow["customerid"] || normRow["mã"] || "").trim();
                if (!custId) return;

                let salesVal = normRow["doanh số kh (vnđ)"] || normRow["doanh số (vnđ)"] || normRow["doanh số"] || normRow["sales"] || 0;
                if (typeof salesVal === 'string') salesVal = Number(salesVal.replace(/[,.]/g, '')) || 0;

                const newCustomer = {
                    customerId: custId,
                    taxId: String(normRow["mst"] || normRow["mã số thuế"] || normRow["taxid"] || "").trim(),
                    companyName: String(normRow["tên công ty"] || normRow["công ty"] || normRow["companyname"] || "").trim(),
                    classification: String(normRow["phân loại"] || normRow["phân loại khách hàng"] || normRow["classification"] || "").trim(),
                    contactName: String(normRow["người liên hệ"] || normRow["người lh"] || normRow["contactname"] || "").trim(),
                    phone: String(normRow["số điện thoại"] || normRow["sđt"] || normRow["phone"] || "").trim(),
                    sales: Number(salesVal) || 0,
                    notes: String(normRow["ghi chú"] || normRow["notes"] || "").trim(),
                    lastUpdated: nowStr
                };

                const existingIndex = customers.findIndex(c => String(c.customerId).toLowerCase() === custId.toLowerCase());
                if (existingIndex !== -1) {
                    // Cập nhật khách hàng cũ: dịch chuyển các bản ghi Excel cũ được ghi trong tháng này về tháng được chọn
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();

                    newCustomer.history = (customers[existingIndex].history || []).map(tx => {
                        if (tx.note && tx.note.includes("Excel")) {
                            const txDate = new Date(tx.date);
                            // Nếu giao dịch được ghi trong tháng hiện tại (do import nhầm vừa rồi) -> dịch chuyển về tháng được chọn
                            if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
                                tx.date = targetDate;
                            }
                        }
                        return tx;
                    });

                    const diff = newCustomer.sales - (customers[existingIndex].sales || 0);
                    if (diff !== 0) {
                        newCustomer.history.push({ date: targetDate, amount: diff, note: 'Cập nhật qua Excel', updated_by: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống' });
                    }
                    updatedCount++;
                } else {
                    // Khách hàng mới: tạo lịch sử thuộc tháng được chọn
                    newCustomer.history = [{ date: targetDate, amount: newCustomer.sales, note: 'Thêm mới qua Excel', updated_by: currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống' }];
                    importedCount++;
                }
                payloadsToUpsert.push(mapToSupabase(newCustomer));
            });

            if (payloadsToUpsert.length === 0) {
                notificationTitle.innerText = "Lỗi Cấu Trúc File";
                notificationTitle.style.color = "#ef4444";
                notificationMessage.innerHTML = "Không thể đọc dữ liệu! Hãy đảm bảo file Excel của bạn có chứa cột tiêu đề <strong>Mã KH</strong>.";
                notificationModal.style.display = 'flex';
            } else {
                const { error } = await supabaseClient.from('Quan ly ban hang').upsert(payloadsToUpsert, { onConflict: 'customer_id' });
                if (error) {
                    alert("Gặp sự cố khi đồng bộ lên Supabase: " + error.message);
                } else {
                    await fetchCustomers();
                    notificationTitle.innerText = "Nhập Excel Thành Công!";
                    notificationTitle.style.color = "#10b981";
                    notificationMessage.innerHTML = `Đã thêm mới: <strong>${importedCount}</strong> khách hàng.<br>Đã cập nhật: <strong>${updatedCount}</strong> khách hàng.<br>Dữ liệu lịch sử đã được ghi nhận vào: <strong>Tháng ${selectedMonth}/${selectedYear}</strong>.`;
                    notificationModal.style.display = 'flex';
                }
            }
        } catch (error) {
            console.error(error);
            alert("Đã xảy ra lỗi trong quá trình xử lý dữ liệu nhập.");
        } finally {
            btnImportExcel.innerText = "Nhập Excel";
            btnImportExcel.disabled = false;
            pendingExcelData = null;
        }
    });
}

// Bắt đầu chạy
initAuthListener();

// Custom Autocomplete Function
function initCustomAutocomplete(inputId, datalistId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Tạo wrapper và dropdown
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-autocomplete-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-autocomplete-dropdown';
    wrapper.appendChild(dropdown);

    let currentFocus = -1;

    // Xóa list attribute để tắt datalist mặc định
    input.removeAttribute('list');

    // Hàm lấy options từ datalist
    function getOptions() {
        const datalist = document.getElementById(datalistId);
        if (!datalist) return [];
        const options = Array.from(datalist.querySelectorAll('option'));
        return options.map(opt => opt.value).filter(val => val);
    }

    // Hàm hiển thị dropdown
    function showDropdown(items) {
        dropdown.innerHTML = '';
        currentFocus = -1;

        if (items.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'custom-autocomplete-empty';
            emptyDiv.textContent = 'Không có gợi ý. Hãy nhập tự do!';
            dropdown.appendChild(emptyDiv);
            dropdown.classList.add('show');
            return;
        }

        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'custom-autocomplete-item';
            div.textContent = item;
            div.setAttribute('data-index', index);

            div.addEventListener('click', () => {
                input.value = item;
                dropdown.classList.remove('show');
                input.focus();
            });

            dropdown.appendChild(div);
        });

        dropdown.classList.add('show');
    }

    // Hàm filter options
    function filterOptions(searchTerm) {
        const options = getOptions();
        if (!searchTerm) return options;

        return options.filter(opt =>
            opt.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Sự kiện input
    input.addEventListener('input', function () {
        const filtered = filterOptions(this.value);
        showDropdown(filtered);
    });

    // Sự kiện focus
    input.addEventListener('focus', function () {
        const filtered = filterOptions(this.value);
        showDropdown(filtered);
    });

    // Sự kiện keyboard navigation
    input.addEventListener('keydown', function (e) {
        const items = dropdown.querySelectorAll('.custom-autocomplete-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocus++;
            if (currentFocus >= items.length) currentFocus = 0;
            setActive(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocus--;
            if (currentFocus < 0) currentFocus = items.length - 1;
            setActive(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].click();
            }
        } else if (e.key === 'Escape') {
            dropdown.classList.remove('show');
        }
    });

    function setActive(items) {
        items.forEach(item => item.classList.remove('selected'));
        if (currentFocus >= 0 && currentFocus < items.length) {
            items[currentFocus].classList.add('selected');
            items[currentFocus].scrollIntoView({ block: 'nearest' });
        }
    }

    // Đóng dropdown khi click bên ngoài
    document.addEventListener('click', function (e) {
        if (!wrapper.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
}

// Hàm cập nhật danh sách thể loại động từ dữ liệu khách hàng
function updateCategoryDatalist() {
    const categories = new Set(['Máy in', 'Mực in', 'Linh kiện', 'Dịch vụ / Sửa chữa', 'Khác']);
    const productDescs = new Set();

    // Thu thập tất cả thể loại và mô tả sản phẩm từ customers và lịch sử
    customers.forEach(c => {
        if (c.category && c.category.trim()) {
            categories.add(c.category.trim());
        }
        if (c.productDesc && c.productDesc.trim()) {
            productDescs.add(c.productDesc.trim());
        }
        if (c.history && Array.isArray(c.history)) {
            c.history.forEach(h => {
                if (h.category && h.category.trim()) {
                    categories.add(h.category.trim());
                }
                if (h.productDesc && h.productDesc.trim()) {
                    productDescs.add(h.productDesc.trim());
                }
            });
        }
    });

    // Cập nhật datalist cho Tên sản phẩm - form thêm mới
    const datalist1 = document.getElementById('categoryDatalist');
    if (datalist1) {
        datalist1.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            datalist1.appendChild(option);
        });
    }

    // Cập nhật datalist cho Tên sản phẩm - form chỉnh sửa
    const datalist2 = document.getElementById('editCategoryDatalist');
    if (datalist2) {
        datalist2.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            datalist2.appendChild(option);
        });
    }

    // Cập nhật datalist cho Tên sản phẩm - form cập nhật doanh số
    const datalist3 = document.getElementById('salesCategoryDatalist');
    if (datalist3) {
        datalist3.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            datalist3.appendChild(option);
        });
    }

    // Cập nhật datalist cho Mô tả sản phẩm - form thêm mới
    const productDatalist1 = document.getElementById('productDescDatalist');
    if (productDatalist1) {
        productDatalist1.innerHTML = '';
        productDescs.forEach(desc => {
            const option = document.createElement('option');
            option.value = desc;
            productDatalist1.appendChild(option);
        });
    }

    // Cập nhật datalist cho Mô tả sản phẩm - form chỉnh sửa
    const productDatalist2 = document.getElementById('editProductDescDatalist');
    if (productDatalist2) {
        productDatalist2.innerHTML = '';
        productDescs.forEach(desc => {
            const option = document.createElement('option');
            option.value = desc;
            productDatalist2.appendChild(option);
        });
    }

    // Cập nhật datalist cho Mô tả sản phẩm - form cập nhật doanh số
    const productDatalist3 = document.getElementById('salesProductDescDatalist');
    if (productDatalist3) {
        productDatalist3.innerHTML = '';
        productDescs.forEach(desc => {
            const option = document.createElement('option');
            option.value = desc;
            productDatalist3.appendChild(option);
        });
    }
}


// Hàm xuất PDF cho modal Phân tích Khách hàng
async function exportAnalysisToPDF() {
    const title = document.getElementById('analysisTitle')?.innerText || 'Phân Tích Doanh Thu & Khách Hàng';

    // Lấy dữ liệu KPI
    const kpiRevenueAllTime = document.getElementById('kpiRevenueAllTime')?.innerText || '0 đ';
    const kpiRevenue = document.getElementById('kpiRevenue')?.innerText || '0 đ';
    const kpiRevenueCompare = document.getElementById('kpiRevenueCompare')?.innerText || '';
    const kpiTxCount = document.getElementById('kpiTxCount')?.innerText || '0';
    const kpiNewCustomers = document.getElementById('kpiNewCustomers')?.innerText || '0';
    const kpiNewCustRatio = document.getElementById('kpiNewCustRatio')?.innerText || '0%';
    const kpiReturnCustRatio = document.getElementById('kpiReturnCustRatio')?.innerText || '0%';

    // Chuyển đổi canvas thành hình ảnh
    const chartClassification = document.getElementById('chartClassification');
    const chartTopCustomers = document.getElementById('chartTopCustomers');
    const chartRevenueTrend = document.getElementById('chartRevenueTrend');

    const imgClassification = chartClassification ? chartClassification.toDataURL('image/png') : null;
    const imgTopCustomers = chartTopCustomers ? chartTopCustomers.toDataURL('image/png') : null;
    const imgRevenueTrend = chartRevenueTrend ? chartRevenueTrend.toDataURL('image/png') : null;

    // Lấy dữ liệu bảng
    const tableBody = document.getElementById('analysisTableBody');
    const tableData = [];
    if (tableBody) {
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                tableData.push([
                    (index + 1).toString(),
                    cells[0].textContent.trim(),
                    cells[1].textContent.trim()
                ]);
            }
        });
    }

    const content = [
        { text: title, style: 'header', margin: [0, 0, 0, 20] },

        // KPI Section - Grid 3x2
        {
            table: {
                widths: ['33.33%', '33.33%', '33.33%'],
                body: [
                    [
                        { text: 'TỔNG DOANH THU\n' + kpiRevenueAllTime, style: 'kpi', border: [true, true, true, true] },
                        { text: 'TỔNG DOANH THU THÁNG\n' + kpiRevenue + '\n' + kpiRevenueCompare, style: 'kpi', border: [true, true, true, true] },
                        { text: 'SỐ GIAO DỊCH PHÁT SINH\n' + kpiTxCount, style: 'kpi', border: [true, true, true, true] }
                    ],
                    [
                        { text: 'KHÁCH MỚI PHÁT SINH\n' + kpiNewCustomers, style: 'kpi', border: [true, true, true, true] },
                        { text: 'KHÁCH MỚI MUA (%)\n' + kpiNewCustRatio, style: 'kpi', border: [true, true, true, true] },
                        { text: 'KHÁCH CŨ QUAY LẠI (%)\n' + kpiReturnCustRatio, style: 'kpi', border: [true, true, true, true] }
                    ]
                ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 20]
        },

        // Charts Section
        { text: 'Biểu Đồ Phân Tích', style: 'subheader', margin: [0, 20, 0, 10] }
    ];

    // Thêm biểu đồ nếu có
    if (imgClassification && imgTopCustomers) {
        content.push({
            columns: [
                { image: imgClassification, width: 200, alignment: 'center' },
                { image: imgTopCustomers, width: 280, alignment: 'center' }
            ],
            columnGap: 20,
            margin: [0, 0, 0, 15]
        });
    }

    if (imgRevenueTrend) {
        content.push({ text: 'Xu Hướng Tăng Trưởng Doanh Thu', style: 'chartTitle', margin: [0, 10, 0, 5] });
        content.push({ image: imgRevenueTrend, width: 500, alignment: 'center', margin: [0, 0, 0, 20] });
    }

    // Table
    content.push({ text: 'Chi Tiết Khách Hàng Phát Sinh Doanh Số Trong Tháng', style: 'subheader', margin: [0, 20, 0, 10], pageBreak: 'before' });
    content.push({
        table: {
            headerRows: 1,
            widths: ['10%', '55%', '35%'],
            body: [
                [
                    { text: 'STT', style: 'tableHeader', alignment: 'center' },
                    { text: 'Mã KH', style: 'tableHeader' },
                    { text: 'Doanh Thu Tăng', style: 'tableHeader', alignment: 'right' }
                ],
                ...tableData.map(row => [
                    { text: row[0], alignment: 'center' },
                    { text: row[1], color: '#3C4A34', bold: true },
                    { text: row[2], alignment: 'right', color: '#10b981', bold: true }
                ])
            ]
        },
        layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#e2e8f0',
            vLineColor: () => '#e2e8f0',
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6
        }
    });

    const docDefinition = {
        pageOrientation: 'portrait',
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        content: content,
        styles: {
            header: { fontSize: 18, bold: true, color: '#3C4A34', alignment: 'center' },
            subheader: { fontSize: 14, bold: true, color: '#3C4A34' },
            chartTitle: { fontSize: 12, bold: true, color: '#3C4A34', alignment: 'center' },
            kpi: { fontSize: 9, alignment: 'center', fillColor: '#f8fafc', margin: [5, 8], bold: true, color: '#3C4A34' },
            tableHeader: { bold: true, fontSize: 11, color: '#475569', fillColor: '#f8fafc' }
        },
        defaultStyle: { fontSize: 10 }
    };

    pdfMake.createPdf(docDefinition).download('Phan_Tich_Khach_Hang.pdf');
}

// Hàm xuất PDF cho modal Phân tích Sản phẩm
async function exportProductAnalysisToPDF() {
    const title = document.getElementById('productAnalysisTitle')?.innerText || 'Phân Tích Sản Phẩm & Doanh Thu';

    // Lấy dữ liệu KPI
    const kpiTotalProducts = document.getElementById('kpiTotalProducts')?.innerText || '0';
    const kpiTotalPurchases = document.getElementById('kpiTotalPurchases')?.innerText || '0';
    const kpiProductRevenue = document.getElementById('kpiProductRevenue')?.innerText || '0 đ';

    // Chuyển đổi canvas thành hình ảnh
    const chartTopProducts = document.getElementById('chartTopProducts');
    const chartTopRevenueProducts = document.getElementById('chartTopRevenueProducts');
    const chartProductDistribution = document.getElementById('chartProductDistribution');

    const imgTopProducts = chartTopProducts ? chartTopProducts.toDataURL('image/png') : null;
    const imgTopRevenueProducts = chartTopRevenueProducts ? chartTopRevenueProducts.toDataURL('image/png') : null;
    const imgProductDistribution = chartProductDistribution ? chartProductDistribution.toDataURL('image/png') : null;

    // Lấy dữ liệu bảng chi tiết sản phẩm
    const tableBody = document.getElementById('productAnalysisTableBody');
    const tableData = [];
    if (tableBody) {
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
                tableData.push([
                    (index + 1).toString(),
                    cells[0].textContent.trim(),
                    cells[1].textContent.trim(),
                    cells[2].textContent.trim()
                ]);
            }
        });
    }

    // Lấy dữ liệu bảng so sánh với tháng trước
    const compTableBody = document.getElementById('productComparisonTableBody');
    const compTableData = [];
    if (compTableBody) {
        const rows = compTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 6) {
                compTableData.push([
                    cells[0].textContent.trim(),
                    cells[1].textContent.trim(),
                    cells[2].textContent.trim(),
                    cells[3].textContent.trim(),
                    cells[4].textContent.trim(),
                    cells[5].textContent.trim()
                ]);
            }
        });
    }

    const content = [
        { text: title, style: 'header', margin: [0, 0, 0, 20] },

        // KPI Section
        {
            columns: [
                { text: 'TỔNG SẢN PHẨM KHÁC NHAU\n' + kpiTotalProducts, style: 'kpi', width: '33.33%' },
                { text: 'TỔNG LƯỢT MUA\n' + kpiTotalPurchases, style: 'kpi', width: '33.33%' },
                { text: 'DOANH THU THÁNG\n' + kpiProductRevenue, style: 'kpi', width: '33.33%' }
            ],
            columnGap: 10,
            margin: [0, 0, 0, 20]
        },

        // Charts Section
        { text: 'Biểu Đồ Phân Tích Sản Phẩm', style: 'subheader', margin: [0, 20, 0, 10] }
    ];

    // Row 1: Top sản phẩm theo lượt mua và doanh thu
    if (imgTopProducts && imgTopRevenueProducts) {
        content.push({ text: 'Top 5 Sản Phẩm', style: 'chartTitle', margin: [0, 10, 0, 5] });
        content.push({
            columns: [
                { image: imgTopProducts, width: 240, alignment: 'center' },
                { image: imgTopRevenueProducts, width: 240, alignment: 'center' }
            ],
            columnGap: 20,
            margin: [0, 0, 0, 15]
        });
    }

    // Row 2: Phân bố sản phẩm
    if (imgProductDistribution) {
        content.push({ text: 'Tỷ Lệ Sản Phẩm Được Mua', style: 'chartTitle', margin: [0, 10, 0, 5] });
        content.push({ image: imgProductDistribution, width: 220, alignment: 'center', margin: [0, 0, 0, 15] });
    }

    // Row 3: Bảng so sánh sản phẩm so với tháng trước
    if (compTableData.length > 0) {
        content.push({ text: 'Phân Tích Sản Phẩm So Với Tháng Trước', style: 'subheader', margin: [0, 15, 0, 10] });
        content.push({
            table: {
                headerRows: 1,
                widths: ['25%', '15%', '15%', '15%', '15%', '15%'],
                body: [
                    [
                        { text: 'Tên Sản Phẩm', style: 'tableHeader' },
                        { text: 'SL Tháng Trước', style: 'tableHeader', alignment: 'center' },
                        { text: 'SL Tháng Này', style: 'tableHeader', alignment: 'center' },
                        { text: 'Chênh Lệch', style: 'tableHeader', alignment: 'center' },
                        { text: 'Tỷ Lệ (%)', style: 'tableHeader', alignment: 'center' },
                        { text: 'Trạng Thái', style: 'tableHeader', alignment: 'center' }
                    ],
                    ...compTableData.map(row => [
                        { text: row[0], color: '#3C4A34', bold: true },
                        { text: row[1], alignment: 'center' },
                        { text: row[2], alignment: 'center', bold: true },
                        { text: row[3], alignment: 'center' },
                        { text: row[4], alignment: 'center' },
                        { text: row[5], alignment: 'center' }
                    ])
                ]
            },
            layout: {
                hLineWidth: () => 0.5,
                vLineWidth: () => 0.5,
                hLineColor: () => '#e2e8f0',
                vLineColor: () => '#e2e8f0',
                paddingLeft: () => 6,
                paddingRight: () => 6,
                paddingTop: () => 4,
                paddingBottom: () => 4
            }
        });
    }

    // Table Chi tiết từng sản phẩm
    content.push({ text: 'Chi Tiết Phân Tích Từng Sản Phẩm', style: 'subheader', margin: [0, 20, 0, 10] });
    content.push({
        table: {
            headerRows: 1,
            widths: ['8%', '42%', '20%', '30%'],
            body: [
                [
                    { text: 'STT', style: 'tableHeader', alignment: 'center' },
                    { text: 'Tên Sản Phẩm', style: 'tableHeader' },
                    { text: 'Số Lượt Mua', style: 'tableHeader', alignment: 'center' },
                    { text: 'Doanh Thu', style: 'tableHeader', alignment: 'right' }
                ],
                ...tableData.map(row => [
                    { text: row[0], alignment: 'center' },
                    { text: row[1], color: '#3C4A34', bold: true },
                    { text: row[2], alignment: 'center', bold: true },
                    { text: row[3], alignment: 'right', color: '#10b981', bold: true }
                ])
            ]
        },
        layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#e2e8f0',
            vLineColor: () => '#e2e8f0',
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 6,
            paddingBottom: () => 6
        }
    });

    const docDefinition = {
        pageOrientation: 'portrait',
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        content: content,
        styles: {
            header: { fontSize: 18, bold: true, color: '#3C4A34', alignment: 'center' },
            subheader: { fontSize: 14, bold: true, color: '#3C4A34' },
            chartTitle: { fontSize: 12, bold: true, color: '#3C4A34', alignment: 'center' },
            kpi: { fontSize: 10, alignment: 'center', fillColor: '#f8fafc', margin: [5, 8], bold: true, color: '#3C4A34' },
            tableHeader: { bold: true, fontSize: 11, color: '#475569', fillColor: '#f8fafc' }
        },
        defaultStyle: { fontSize: 10 }
    };

    pdfMake.createPdf(docDefinition).download('Phan_Tich_San_Pham.pdf');
}
