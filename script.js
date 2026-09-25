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
                <b>Không thể khởi tạo ứng dụng.</b><br>
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
            authErrorMsg.innerHTML = `
                <div style="background: #FEF2F2; border: 1px solid #FCA5A5; padding: 14px; border-radius: 10px; text-align: left; margin-top: 12px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.08);">
                    <div style="font-size: 14px; font-weight: 800; color: #DC2626; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                        <span>❌</span> <span>Đăng Nhập Thất Bại</span>
                    </div>
                    <div style="font-size: 12px; color: #7F1D1D; line-height: 1.5; margin-bottom: 8px;">Thông tin đăng nhập chưa đúng hoặc kết nối đang gặp sự cố. Vui lòng kiểm tra lại và thử lại.</div>
                    <div style="font-size: 11px; color: #64748B; line-height: 1.5;">
                        💡 <strong>Gợi ý khắc phục:</strong><br>
                        • Kiểm tra lại ID/Email và Mật khẩu (chú ý chữ hoa/thường).<br>
                        • Nếu mạng không ổn định, thử tải lại trang hoặc đổi DNS.
                    </div>
                </div>
            `;
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
                    clearCustomerCache();
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
                clearCustomerCache();
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
            } else {
                clearCustomerCache();
            }
        });
    } else {
        if (authContainer) authContainer.style.display = 'flex';
        if (mainContainer) mainContainer.style.display = 'none';
    }
}

function mapFromSupabase(row) {
    let parsedHistory = parseJsonArray(row.history);

    const topCategory = row.product_name || '';
    const topProductDesc = row.product_description || '';

    // Giữ nguyên tên/mô tả SP gốc của từng giao dịch để phân tích đa sản phẩm không bị gán đè.
    // Chỉ fallback sang product_name/product_description top-level khi entry cũ thiếu dữ liệu.
    parsedHistory = (parsedHistory || []).map(tx => ({
        ...tx,
        category: tx.category || topCategory || '',
        productDesc: tx.productDesc || topProductDesc || ''
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

// Build a draft so failed saves never leave the in-memory customer partially changed.
function cloneCustomerData(customer) {
    if (typeof structuredClone === 'function') return structuredClone(customer);
    return JSON.parse(JSON.stringify(customer));
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
    "Hiếu Hạnh đỉnh quó đi 💕",
    "Hiếu Hạnh là giỏi nhất ✨🥰",
    "Uống thêm nước nhoa 🥛💕",
    "Nghỉ tay nhắm mắt nghỉ ngơi một xíu nhoa 😴💖",
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
    showMochiBubble("Hiếu Hạnh đỉnh quó đi 💕");
}, 2000);

document.getElementById('kpiCatRunner')?.addEventListener('click', () => {
    showMochiBubble("Hiếu Hạnh đỉnh quó đi 💕");
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
const LOCAL_CACHE_KEY = APP_CONFIG.storageKeys.customersCache;

function clearCustomerCache() {
    try {
        localStorage.removeItem(LOCAL_CACHE_KEY);
    } catch (e) {
        console.warn("Lỗi xóa cache local:", e);
    }
}

function loadCachedCustomers() {
    try {
        const cached = localStorage.getItem(LOCAL_CACHE_KEY);
        if (cached) {
            const parsed = parseJsonArray(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                customers = parsed;
                renderTable();
                updateCategoryDatalist();
                updateKPIBar();
                refreshDashboardIfVisible();
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

        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`Quá thời gian ${APP_CONFIG.fetchTimeoutMs / 1000} giây. Hãy kiểm tra lại kết nối mạng!`)), APP_CONFIG.fetchTimeoutMs));
        const fetchPromise = supabaseClient.from(APP_CONFIG.supabaseTable).select('*').order('sales', { ascending: false });

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
        refreshDashboardIfVisible();

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
        if (!hasCache && tableBody) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: #ef4444; padding: 30px; line-height: 1.6;">
                <b>Lỗi kết nối mạng:</b> ${e.message}
            </td></tr>`;
        } else if (hasCache) {
            console.warn("Không thể đồng bộ dữ liệu mới; đang giữ dữ liệu cache hiện tại.", e);
        }
    }
}

const form = document.getElementById('customerForm');
const searchInput = document.getElementById('searchInput');
const btnClearSearch = document.getElementById('btnClearSearch');
const filterClassification = document.getElementById('filterClassification');
const tableBodyElement = document.getElementById('tableBody');
const paginationContainer = document.getElementById('pagination');

tableBodyElement?.addEventListener('click', (event) => {
    const cell = event.target.closest('[data-customer-action]');
    if (cell && cell.dataset.customerAction) showCustomerActionModal(cell.dataset.customerAction);
});

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

// ========== NHẬP NHIỀU SẢN PHẨM TRONG 1 LẦN (PHƯƠNG ÁN 1) ==========
// Mỗi đợt nhập tạo N history entry có cùng batchId + cùng date.
// KPI / báo cáo / phân tích vẫn duyệt từng entry nên tổng tiền không đổi,
// nhưng chi tiết từng sản phẩm được giữ riêng để phân tích đúng.
function createBatchId() {
    return 'batch_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function parseMoneyInputValue(raw) {
    const s = String(raw || '').replace(/[,.]/g, '').trim();
    if (s === '' || s === '-' || s === '+') return null;
    const n = Number(s);
    return isNaN(n) ? null : n;
}

function parseQuantityInputValue(raw) {
    const s = String(raw ?? '').trim();
    if (s === '') return 1;
    const n = Number(s);
    return Number.isInteger(n) && n > 0 ? n : null;
}

function formatMoneyInputValue(input) {
    if (!input) return;
    let isNegative = input.value.startsWith('-');
    let rawValue = input.value.replace(/\D/g, '');
    let formatted = rawValue ? parseInt(rawValue, 10).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '';
    if (isNegative && formatted) input.value = '-' + formatted;
    else if (isNegative && !formatted) input.value = '-';
    else input.value = formatted;

    if (isNegative && formatted) { input.style.borderColor = '#ef4444'; input.style.color = '#ef4444'; }
    else if (!isNegative && formatted) { input.style.borderColor = '#10b981'; input.style.color = '#10b981'; }
    else { input.style.borderColor = 'var(--border-color)'; input.style.color = 'var(--text-main)'; }
}

function buildSalesItemRow(listType, item) {
    const row = document.createElement('div');
    row.className = 'sales-item-row';
    row.dataset.listType = listType;
    row.style.cssText = 'border: 1px solid var(--border-color); border-radius: 10px; padding: 10px; background: #FFFFFF; display: flex; flex-direction: column; gap: 8px;';

    const topRow = document.createElement('div');
    topRow.style.cssText = 'display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap;';

    const amountWrap = document.createElement('div');
    amountWrap.style.flex = '1 1 260px';
    const amountLabel = document.createElement('label');
    amountLabel.style.cssText = 'display: block; font-size: 12px; font-weight: 700; color: #2C2825; margin-bottom: 4px;';
    amountLabel.textContent = 'Số tiền (VNĐ) *';
    const amountInput = document.createElement('input');
    amountInput.type = 'text';
    amountInput.className = 'form-control-custom sales-item-amount';
    amountInput.placeholder = 'Ví dụ: 5.000.000 (dấu – nếu giảm)';
    amountInput.value = item && item.amount ? Number(item.amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '';
    amountWrap.appendChild(amountLabel);
    amountWrap.appendChild(amountInput);

    const quantityWrap = document.createElement('div');
    quantityWrap.style.cssText = 'flex: 0 0 110px;';
    const quantityLabel = document.createElement('label');
    quantityLabel.style.cssText = 'display: block; font-size: 12px; font-weight: 700; color: #2C2825; margin-bottom: 4px;';
    quantityLabel.textContent = 'Số lượng';
    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.min = '1';
    quantityInput.step = '1';
    quantityInput.inputMode = 'numeric';
    quantityInput.className = 'form-control-custom sales-item-quantity';
    quantityInput.placeholder = '1';
    const initialQuantity = Number(item && item.quantity);
    quantityInput.value = Number.isInteger(initialQuantity) && initialQuantity > 0 ? initialQuantity : 1;
    quantityWrap.appendChild(quantityLabel);
    quantityWrap.appendChild(quantityInput);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-cancel-sales sales-item-remove';
    removeBtn.title = 'Xóa sản phẩm này khỏi đợt nhập';
    removeBtn.style.cssText = 'width: auto; padding: 8px 12px; font-size: 13px; flex-shrink: 0;';
    removeBtn.textContent = 'Xóa';

    topRow.appendChild(amountWrap);
    topRow.appendChild(quantityWrap);
    topRow.appendChild(removeBtn);

    const midRow = document.createElement('div');
    midRow.style.cssText = 'display: flex; gap: 8px;';
    if (window.innerWidth < 560) midRow.style.flexDirection = 'column';

    const nameWrap = document.createElement('div');
    nameWrap.style.flex = '1';
    const nameLabel = document.createElement('label');
    nameLabel.style.cssText = 'display: block; font-size: 12px; font-weight: 700; color: #2C2825; margin-bottom: 4px;';
    nameLabel.textContent = 'Tên sản phẩm';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'form-control-custom sales-item-name';
    nameInput.placeholder = 'Nhập hoặc chọn tên sản phẩm...';
    nameInput.value = (item && item.category) || '';
    nameInput.setAttribute('list', listType === 'new' ? 'categoryDatalist' : 'salesCategoryDatalist');
    nameWrap.appendChild(nameLabel);
    nameWrap.appendChild(nameInput);
    bindAutocompleteElement(nameInput, listType === 'new' ? 'categoryDatalist' : 'salesCategoryDatalist');

    const descWrap = document.createElement('div');
    descWrap.style.flex = '1';
    const descLabel = document.createElement('label');
    descLabel.style.cssText = 'display: block; font-size: 12px; font-weight: 700; color: #2C2825; margin-bottom: 4px;';
    descLabel.textContent = 'Mô tả sản phẩm';
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'form-control-custom sales-item-desc';
    descInput.placeholder = 'Ví dụ: HP M404dn, RAM 16GB...';
    descInput.value = (item && item.productDesc) || '';
    descInput.setAttribute('list', listType === 'new' ? 'productDescDatalist' : 'salesProductDescDatalist');
    descWrap.appendChild(descLabel);
    descWrap.appendChild(descInput);
    bindAutocompleteElement(descInput, listType === 'new' ? 'productDescDatalist' : 'salesProductDescDatalist');

    midRow.appendChild(nameWrap);
    midRow.appendChild(descWrap);

    row.appendChild(topRow);
    row.appendChild(midRow);

    amountInput.addEventListener('input', function () {
        formatMoneyInputValue(amountInput);
        updateBatchTotals();
    });
    removeBtn.addEventListener('click', function () {
        const list = row.parentNode;
        const rows = list ? list.querySelectorAll('.sales-item-row') : [];
        if (rows.length <= 1) {
            amountInput.value = '';
            quantityInput.value = '1';
            nameInput.value = '';
            descInput.value = '';
            formatMoneyInputValue(amountInput);
            updateBatchTotals();
            return;
        }
        row.remove();
        updateBatchTotals();
    });

    return row;
}

function getSalesItemRows(listId) {
    const list = document.getElementById(listId);
    if (!list) return [];
    return Array.from(list.querySelectorAll('.sales-item-row'));
}

function collectSalesItems(listId) {
    return getSalesItemRows(listId).map(row => {
        const amountInput = row.querySelector('.sales-item-amount');
        const quantityInput = row.querySelector('.sales-item-quantity');
        const nameInput = row.querySelector('.sales-item-name');
        const descInput = row.querySelector('.sales-item-desc');
        return {
            row,
            amount: parseMoneyInputValue(amountInput ? amountInput.value : ''),
            quantity: parseQuantityInputValue(quantityInput ? quantityInput.value : ''),
            category: nameInput ? nameInput.value.trim() : '',
            productDesc: descInput ? descInput.value.trim() : ''
        };
    });
}

function resetSalesItemsList(listId, initialItems) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '';
    const listType = listId === 'newCustomerItemsList' ? 'new' : 'update';
    const seeds = (Array.isArray(initialItems) && initialItems.length > 0) ? initialItems : [{ amount: '', category: '', productDesc: '' }];
    seeds.forEach(seed => list.appendChild(buildSalesItemRow(listType, seed)));
    updateBatchTotals();
}

function updateBatchTotals() {
    const updateItems = collectSalesItems('salesItemsList');
    const updateTotal = updateItems.reduce((sum, it) => sum + (it.amount || 0), 0);
    const updateTotalEl = document.getElementById('salesBatchTotal');
    if (updateTotalEl) {
        updateTotalEl.textContent = formatCurrency(updateTotal);
        updateTotalEl.style.color = updateTotal < 0 ? '#ef4444' : '#059669';
    }

    const newItems = collectSalesItems('newCustomerItemsList');
    const newTotal = newItems.reduce((sum, it) => sum + (it.amount || 0), 0);
    const newTotalEl = document.getElementById('newCustomerBatchTotal');
    if (newTotalEl) {
        newTotalEl.textContent = formatCurrency(newTotal);
        newTotalEl.style.color = newTotal < 0 ? '#ef4444' : '#059669';
    }
    if (salesInput) {
        salesInput.value = newTotal ? newTotal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : '';
    }
}

function validateSalesItems(items, listId) {
    const filled = items.filter(it => it.amount !== null && it.amount !== 0);
    if (filled.length === 0) {
        return { ok: false, message: 'Vui lòng nhập số tiền khác 0 cho ít nhất 1 sản phẩm!' };
    }
    const invalidRow = items.find(it => {
        const amountInput = it.row ? it.row.querySelector('.sales-item-amount') : null;
        const raw = amountInput ? amountInput.value.trim() : '';
        return raw !== '' && (it.amount === null || it.amount === 0);
    });
    if (invalidRow) {
        return { ok: false, message: 'Có dòng số tiền chưa hợp lệ (trống hoặc bằng 0). Vui lòng kiểm tra lại!' };
    }
    const invalidQuantityRow = items.find(it => it.quantity === null);
    if (invalidQuantityRow) {
        return { ok: false, message: 'Số lượng sản phẩm phải là số nguyên lớn hơn 0.' };
    }
    void listId;
    return { ok: true, items: filled };
}

function buildBatchHistoryEntries(items, batchDate, batchNote, actionBy) {
    const batchId = createBatchId();
    const multi = items.length > 1;
    return items.map(it => {
        const itemParts = [];
        if (it.category) itemParts.push(`[${it.category}]`);
        if (it.productDesc) itemParts.push(it.productDesc);
        const itemLabel = itemParts.length > 0 ? itemParts.join(' ') : '';
        let note = '';
        if (itemLabel && batchNote) note = `${itemLabel} - ${batchNote}`;
        else if (itemLabel) note = itemLabel;
        else if (batchNote) note = batchNote;
        else note = multi ? 'Sản phẩm' : 'Cập nhật (+/-)';
        return {
            date: batchDate,
            amount: it.amount,
            quantity: it.quantity || 1,
            note,
            batchNote: batchNote || '',
            category: it.category || '',
            productDesc: it.productDesc || '',
            batchId,
            updated_by: actionBy
        };
    });
}

function summarizeBatchForTopLevel(items) {
    const names = items.map(it => it.category).filter(Boolean);
    const descs = items.map(it => it.productDesc).filter(Boolean);
    const biggest = [...items].sort((a, b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0))[0];
    return {
        category: names.length <= 1 ? (names[0] || '') : `${names[0]} + ${names.length - 1} sản phẩm khác`,
        productDesc: descs.length <= 1 ? (descs[0] || '') : `${descs[0]} + ${descs.length - 1} mô tả khác`,
        biggest
    };
}

// ========== SỬA GIAO DỊCH CŨ: CHIA LẠI TIỀN THEO SP, GIỮ NGUYÊN NGÀY + TỔNG ==========
// Trường hợp của bạn: tổng sales đúng, chỉ chia sai theo từng SP.
// Nguyên tắc: giữ nguyên date gốc (không dời kỳ báo cáo), tổng sau sửa phải bằng tổng gốc,
// sales mới = sales cũ - tổng gốc + tổng mới (luôn bằng sales cũ nếu tổng sau sửa đúng).
let editHistoryTxState = null;

function getEditHistoryTxItems() {
    const list = document.getElementById('editHistoryTxItems');
    if (!list) return [];
    return Array.from(list.querySelectorAll('.sales-item-row')).map(row => {
        const amountInput = row.querySelector('.sales-item-amount');
        const quantityInput = row.querySelector('.sales-item-quantity');
        const nameInput = row.querySelector('.sales-item-name');
        const descInput = row.querySelector('.sales-item-desc');
        return {
            row,
            amountInput,
            amount: parseMoneyInputValue(amountInput ? amountInput.value : ''),
            quantity: parseQuantityInputValue(quantityInput ? quantityInput.value : ''),
            category: nameInput ? nameInput.value.trim() : '',
            productDesc: descInput ? descInput.value.trim() : ''
        };
    });
}

function updateEditHistoryTxTotal() {
    const items = getEditHistoryTxItems();
    const total = items.reduce((sum, it) => sum + (it.amount || 0), 0);
    const totalEl = document.getElementById('editHistoryTxTotal');
    const origEl = document.getElementById('editHistoryTxOriginal');
    const warnEl = document.getElementById('editHistoryTxWarn');
    const saveBtn = document.getElementById('btnSaveEditHistoryTx');
    const original = editHistoryTxState ? editHistoryTxState.originalTotal : 0;
    if (totalEl) {
        totalEl.textContent = formatCurrency(total);
        totalEl.style.color = total === original ? '#059669' : '#DC2626';
    }
    if (origEl) origEl.textContent = formatCurrency(original);
    const mismatch = total !== original;
    if (warnEl) {
        warnEl.style.display = mismatch ? 'block' : 'none';
        if (mismatch) warnEl.textContent = `Tổng sau sửa (${formatCurrency(total)}) đang lệch ${formatCurrency(total - original)} so với tổng gốc. Hãy chia lại cho khớp thì mới lưu được.`;
    }
    if (saveBtn) saveBtn.disabled = mismatch;
}

function openEditHistoryTx(customerId, batchId, singleIndex) {
    const customer = customers.find(c => String(c.customerId).toLowerCase() === String(customerId).toLowerCase());
    if (!customer || !Array.isArray(customer.history)) return;
    let entries = [];
    let indices = [];
    if (batchId) {
        customer.history.forEach((tx, idx) => {
            if (tx && tx.batchId === batchId) { entries.push(tx); indices.push(idx); }
        });
    } else if (singleIndex !== null && singleIndex !== undefined && singleIndex >= 0) {
        const tx = customer.history[singleIndex];
        if (tx) { entries = [tx]; indices = [singleIndex]; }
    }
    if (entries.length === 0) return;
    const originalTotal = entries.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const keepDate = entries[0].date;
    const keepNote = entries[0].batchNote || '';
    editHistoryTxState = { customerId: customer.customerId, batchId: batchId || null, indices, originalTotal, keepDate, keepNote };

    const metaEl = document.getElementById('editHistoryTxMeta');
    if (metaEl) {
        const d = new Date(keepDate);
        const when = isNaN(d.getTime()) ? keepDate : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        metaEl.innerHTML = `<strong>${escapeHtml(customer.customerId)}</strong>${customer.companyName ? ` - ${escapeHtml(customer.companyName)}` : ''}<br><span style="color: var(--text-muted);">Ngày gốc (giữ nguyên): <strong>${escapeHtml(when)}</strong> • Số dòng hiện tại: <strong>${entries.length}</strong></span>`;
    }
    const list = document.getElementById('editHistoryTxItems');
    if (list) {
        list.innerHTML = '';
        entries.forEach(tx => {
            const row = buildSalesItemRow('edithistory', { amount: tx.amount, quantity: tx.quantity, category: tx.category || '', productDesc: tx.productDesc || '' });
            const amt = row.querySelector('.sales-item-amount');
            if (amt) amt.addEventListener('input', updateEditHistoryTxTotal);
            list.appendChild(row);
        });
    }
    updateEditHistoryTxTotal();
    const modal = document.getElementById('editHistoryTxModal');
    if (modal) modal.style.display = 'flex';
}

function closeEditHistoryTxModal() {
    const modal = document.getElementById('editHistoryTxModal');
    if (modal) modal.style.display = 'none';
    editHistoryTxState = null;
}

async function saveEditHistoryTx() {
    if (!editHistoryTxState) return;
    const customer = customers.find(c => String(c.customerId).toLowerCase() === String(editHistoryTxState.customerId).toLowerCase());
    if (!customer || !Array.isArray(customer.history)) return;
    const items = getEditHistoryTxItems();
    const filled = items.filter(it => it.amount !== null && it.amount !== 0);
    if (filled.length === 0) {
        alert('Vui lòng nhập số tiền khác 0 cho ít nhất 1 sản phẩm!');
        return;
    }
    if (items.some(it => {
        const raw = it.amountInput ? it.amountInput.value.trim() : '';
        return raw !== '' && (it.amount === null || it.amount === 0);
    })) {
        alert('Có dòng số tiền chưa hợp lệ. Vui lòng kiểm tra lại!');
        return;
    }
    if (items.some(it => it.quantity === null)) {
        alert('Số lượng sản phẩm phải là số nguyên lớn hơn 0.');
        return;
    }
    if (items.some(it => (it.category || it.productDesc) && (it.amount === null || it.amount === 0))) {
        alert('Có sản phẩm đã nhập tên/mô tả nhưng chưa nhập số tiền. Vui lòng nhập số tiền hoặc xóa dòng đó!');
        return;
    }
    const newTotal = filled.reduce((sum, it) => sum + (it.amount || 0), 0);
    if (newTotal !== editHistoryTxState.originalTotal) {
        alert(`Tổng sau sửa phải bằng tổng gốc ${formatCurrency(editHistoryTxState.originalTotal)}. Hiện đang ${formatCurrency(newTotal)}.`);
        return;
    }
    const actionBy = currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống';
    const batchId = editHistoryTxState.batchId || createBatchId();
    const baseNote = editHistoryTxState.keepNote;
    const newEntries = filled.map(it => {
        const itemParts = [];
        if (it.category) itemParts.push(`[${it.category}]`);
        if (it.productDesc) itemParts.push(it.productDesc);
        const itemLabel = itemParts.length > 0 ? itemParts.join(' ') : 'Sản phẩm';
        const prevNote = `${itemLabel}${baseNote ? ` - ${baseNote}` : ''}`;
        const note = /chỉnh sửa chia tiền/i.test(prevNote) ? prevNote : `${prevNote} (chỉnh sửa chia tiền)`;
        return {
            date: editHistoryTxState.keepDate,
            amount: it.amount,
            quantity: it.quantity || 1,
            note,
            batchNote: baseNote || '',
            category: it.category || '',
            productDesc: it.productDesc || '',
            batchId,
            updated_by: actionBy
        };
    });

    const draft = cloneCustomerData(customer);
    const keepIdx = new Set(editHistoryTxState.indices);
    const keptHistory = draft.history.filter((tx, idx) => !keepIdx.has(idx));
    newEntries.forEach(entry => keptHistory.push(entry));
    draft.history = keptHistory;
    const historySum = draft.history.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    draft.sales = historySum;
    draft.lastUpdated = new Date().toISOString();
    const summary = summarizeBatchForTopLevel(filled);
    if (summary.category) draft.category = summary.category;
    if (summary.productDesc) draft.productDesc = summary.productDesc;

    const saveBtn = document.getElementById('btnSaveEditHistoryTx');
    if (saveBtn) { saveBtn.innerText = 'Đang lưu...'; saveBtn.disabled = true; }
    let error = null;
    try {
        const payload = mapToSupabase(draft);
        ({ error } = await supabaseClient.from(APP_CONFIG.supabaseTable).update(payload).eq('customer_id', customer.customerId));
    } catch (err) {
        error = err;
    }
    if (saveBtn) { saveBtn.innerText = 'Lưu chia lại'; saveBtn.disabled = false; }
    if (error) {
        alert('Lỗi khi lưu chia lại: ' + error.message);
        return;
    }
    await fetchCustomers();
    updateCategoryDatalist();
    closeEditHistoryTxModal();
    showHistoryModal(customer.customerId);
    if (notificationTitle && notificationMessage && notificationModal) {
        notificationTitle.innerText = 'Đã chia lại thành công!';
        notificationTitle.style.color = '#10b981';
        notificationMessage.innerHTML = `Đã chia <strong>${formatCurrency(editHistoryTxState ? editHistoryTxState.originalTotal : newTotal)}</strong> thành <strong>${filled.length} sản phẩm</strong>, giữ nguyên ngày và tổng.<br><span style="color: #64748b; font-size: 13px;">Bạn có thể kiểm tra lại ở Lịch sử và Phân tích Sản phẩm.</span>`;
        notificationModal.style.display = 'flex';
    }
}

document.getElementById('btnAddEditHistoryTxItem')?.addEventListener('click', function () {
    const list = document.getElementById('editHistoryTxItems');
    if (!list) return;
    const row = buildSalesItemRow('edithistory', { amount: '', category: '', productDesc: '' });
    const amt = row.querySelector('.sales-item-amount');
    if (amt) amt.addEventListener('input', updateEditHistoryTxTotal);
    list.appendChild(row);
    updateEditHistoryTxTotal();
});
document.getElementById('btnSaveEditHistoryTx')?.addEventListener('click', saveEditHistoryTx);
document.getElementById('btnCancelEditHistoryTx')?.addEventListener('click', closeEditHistoryTxModal);
document.getElementById('btnCloseEditHistoryTxModal')?.addEventListener('click', closeEditHistoryTxModal);

document.getElementById('btnAddSalesItem')?.addEventListener('click', function () {
    const list = document.getElementById('salesItemsList');
    if (!list) return;
    list.appendChild(buildSalesItemRow('update', { amount: '', category: '', productDesc: '' }));
    updateBatchTotals();
});

document.getElementById('btnAddNewCustomerItem')?.addEventListener('click', function () {
    const list = document.getElementById('newCustomerItemsList');
    if (!list) return;
    list.appendChild(buildSalesItemRow('new', { amount: '', category: '', productDesc: '' }));
    updateBatchTotals();
});

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
        <strong>Mã khách hàng:</strong> ${escapeHtml(customer.customerId)} <br>
        <strong>Tên Công ty:</strong> ${escapeHtml(customer.companyName || '-')}
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
        // Gộp các entry cùng batchId (nhập nhiều SP trong 1 lần) thành 1 card
        const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
        const groups = [];
        const groupIndexByBatch = {};
        sortedHistory.forEach(item => {
            if (item && item.batchId) {
                if (groupIndexByBatch[item.batchId] === undefined) {
                    groupIndexByBatch[item.batchId] = groups.length;
                    groups.push({ batchId: item.batchId, date: item.date, items: [item] });
                } else {
                    const g = groups[groupIndexByBatch[item.batchId]];
                    g.items.push(item);
                    if (new Date(item.date) > new Date(g.date)) g.date = item.date;
                }
            } else {
                groups.push({ batchId: null, date: item.date, items: [item] });
            }
        });
        groups.sort((a, b) => new Date(b.date) - new Date(a.date));

        const ul = document.createElement('div');
        ul.style.position = 'relative';
        ul.style.paddingLeft = '24px';
        ul.style.borderLeft = '2px solid #e2e8f0';
        ul.style.marginLeft = '12px';
        ul.style.display = 'flex';
        ul.style.flexDirection = 'column';
        ul.style.gap = '20px';

        groups.forEach(group => {
            const groupItems = group.items;
            const isBatch = group.batchId && groupItems.length > 1;
            const firstDate = new Date(group.date);
            const formattedDate = firstDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = firstDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const user = (groupItems[0] && groupItems[0].updated_by) || 'hệ thống';

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

            // Time header + nút sửa chia tiền theo SP (giữ nguyên ngày gốc)
            const timeHeader = document.createElement('div');
            timeHeader.style.display = 'flex';
            timeHeader.style.justifyContent = 'space-between';
            timeHeader.style.alignItems = 'center';
            timeHeader.style.gap = '8px';
            const timeText = document.createElement('span');
            timeText.style.fontSize = '12px';
            timeText.style.color = 'var(--text-muted)';
            timeText.style.fontWeight = 'bold';
            timeText.innerText = `${formattedDate} LÚC ${formattedTime}`;
            timeHeader.appendChild(timeText);
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.innerText = '✏️ Sửa chia tiền';
            editBtn.title = 'Tách / chia lại số tiền theo từng sản phẩm (giữ nguyên ngày, giữ nguyên tổng)';
            editBtn.style.cssText = 'flex-shrink: 0; font-size: 12px; font-weight: 700; color: var(--primary-color); background: #F1F5F9; border: 1px solid var(--border-color); border-radius: 6px; padding: 4px 10px; cursor: pointer;';
            editBtn.onmouseenter = function () { editBtn.style.background = '#E2E8F0'; };
            editBtn.onmouseleave = function () { editBtn.style.background = '#F1F5F9'; };
            const singleIndex = customer.history ? customer.history.indexOf(groupItems[0]) : -1;
            const isSyntheticAdjust = !group.batchId && (singleIndex === -1 || /Điều chỉnh trực tiếp|Cập nhật từ Supabase/i.test(String((groupItems[0] && groupItems[0].note) || '')));
            if (!isSyntheticAdjust) {
                editBtn.onclick = function (ev) {
                    ev.stopPropagation();
                    openEditHistoryTx(customer.customerId, group.batchId || null, singleIndex);
                };
                timeHeader.appendChild(editBtn);
            }
            content.appendChild(timeHeader);

            // Action title
            const actionTitle = document.createElement('div');
            actionTitle.style.fontWeight = 'bold';
            actionTitle.style.color = 'var(--text-main)';
            actionTitle.style.marginTop = '2px';
            if (isBatch) {
                actionTitle.innerText = `Nhập ${groupItems.length} sản phẩm cùng đợt`;
            } else {
                actionTitle.innerText = groupItems[0].note || 'Cập nhật thông tin';
            }
            content.appendChild(actionTitle);

            // Details box
            const detailsBox = document.createElement('div');
            detailsBox.style.background = '#f8fafc';
            detailsBox.style.border = '1px solid #e2e8f0';
            detailsBox.style.borderRadius = '6px';
            detailsBox.style.padding = '8px 12px';
            detailsBox.style.marginTop = '6px';

            let detailsHtml = `<ul style="margin: 0; padding-left: 15px; list-style-type: disc; color: #475569; font-size: 13px;">`;
            detailsHtml += `<li>Thực hiện bởi: <strong>${escapeHtml(user)}</strong></li>`;
            if (isBatch) {
                const batchTotal = groupItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
                const batchPrefix = batchTotal > 0 ? '+' : '';
                detailsHtml += `<li>Tổng đợt: <strong style="color: ${batchTotal >= 0 ? '#10b981' : '#ef4444'}">${batchPrefix}${formatCurrency(batchTotal)}</strong></li>`;
                detailsHtml += `</ul><ol style="margin: 8px 0 0 15px; padding-left: 15px; color: #475569; font-size: 13px;">`;
                groupItems.forEach((it, idx) => {
                    const itemParts = [];
                    if (it.category) itemParts.push(`<strong style="color: var(--primary-color);">${escapeHtml(it.category)}</strong>`);
                    if (it.productDesc) itemParts.push(`${escapeHtml(it.productDesc)}`);
                    const itemName = itemParts.length > 0 ? itemParts.join(' - ') : `Sản phẩm ${idx + 1}`;
                    const amtPrefix = (it.amount || 0) > 0 ? '+' : '';
                    const quantity = Number.isInteger(Number(it.quantity)) && Number(it.quantity) > 0 ? Number(it.quantity) : 1;
                    detailsHtml += `<li>${itemName} (${quantity} SP): <strong style="color: ${(it.amount || 0) >= 0 ? '#10b981' : '#ef4444'}">${amtPrefix}${formatCurrency(it.amount || 0)}</strong></li>`;
                });
                detailsHtml += `</ol><ul style="margin: 8px 0 0 0; padding-left: 15px; list-style-type: disc; color: #475569; font-size: 13px;">`;
                const batchNote = (groupItems[0] && (groupItems[0].batchNote || '')) || '';
                if (batchNote) detailsHtml += `<li>Ghi chú đợt: ${escapeHtml(batchNote)}</li>`;
                detailsHtml += `</ul>`;
            } else {
                const item = groupItems[0];
                if (item.amount !== undefined && item.amount !== null && item.amount !== 0) {
                    const amountPrefix = item.amount > 0 ? '+' : '';
                    detailsHtml += `<li>Biến động doanh số: <strong style="color: ${item.amount > 0 ? '#10b981' : '#ef4444'}">${amountPrefix}${formatCurrency(item.amount)}</strong></li>`;
                }
                const quantity = Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0 ? Number(item.quantity) : 1;
                detailsHtml += `<li>Số lượng: <strong>${quantity} sản phẩm</strong></li>`;
                const finalCategory = item.category || customer.category || '';
                const finalProductDesc = item.productDesc || customer.productDesc || '';

                const categoryText = finalCategory ? `<strong style="color: var(--primary-color);">${escapeHtml(finalCategory)}</strong>` : '<span style="color: #94a3b8;">-</span>';
                detailsHtml += `<li>Tên sản phẩm: ${categoryText}</li>`;

                const productDescText = finalProductDesc ? `<span style="color: #64748b;">${escapeHtml(finalProductDesc)}</span>` : '<span style="color: #94a3b8;">-</span>';
                detailsHtml += `<li>Mô tả: ${productDescText}</li>`;
                detailsHtml += `</ul>`;
            }

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
    const newBatchItems = collectSalesItems('newCustomerItemsList').filter(it => it.amount !== null && it.amount !== 0);
    if (newBatchItems.length > 0) {
        const batchTotal = newBatchItems.reduce((sum, it) => sum + (it.amount || 0), 0);
        const summary = summarizeBatchForTopLevel(newBatchItems);
        return {
            customerId: idInput ? idInput.value.trim() : '', taxId: taxIdInput ? taxIdInput.value.trim() : '',
            companyName: companyInput ? companyInput.value.trim() : '', classification: classificationInput ? classificationInput.value : '',
            category: summary.category || '', productDesc: summary.productDesc || '',
            contactName: contactInput ? contactInput.value.trim() : '', phone: phoneInput ? phoneInput.value.trim() : '',
            sales: batchTotal, notes: notesInput ? notesInput.value.trim() : '',
            _batchItems: newBatchItems
        };
    }
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
    resetSalesItemsList('newCustomerItemsList', data.category || data.productDesc || data.sales ? [{ amount: data.sales || '', category: data.category || '', productDesc: data.productDesc || '' }] : [{ amount: '', category: '', productDesc: '' }]);
    const addSalesEl = document.getElementById('addSales');
    if (addSalesEl) { addSalesEl.value = ''; addSalesEl.style.borderColor = 'var(--border-color)'; addSalesEl.style.color = 'var(--text-main)'; }
}

function openCustomerFormModal(mode, customer = null) {
    const modalEl = document.getElementById('customerFormModal');
    const titleTextEl = document.getElementById('formModalTitleText');
    const iconEl = document.getElementById('formModalIcon');
    const submitBtn = document.getElementById('btnSubmit');

    setFormData({});
    resetSalesItemsList('newCustomerItemsList', [{ amount: '', category: '', productDesc: '' }]);
    if (idInput) {
        idInput.readOnly = false;
        idInput.style.backgroundColor = '#FAF7F2';
        idInput.style.borderColor = 'var(--border-color)';
    }
    if (salesInput) {
        // Doanh số ban đầu luôn tự cộng từ danh sách SP, không nhập tay
        salesInput.readOnly = true;
        salesInput.style.backgroundColor = '#F1F5F9';
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
        if (salesInput) { salesInput.readOnly = true; salesInput.style.backgroundColor = '#F1F5F9'; }
        setFormData({});
        if (addSalesContainerEl) addSalesContainerEl.style.display = 'none';
        if (salesLabel) salesLabel.innerText = "Doanh số ban đầu (VNĐ) - Tự động từ danh sách SP";
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
        tableBodyElement.innerHTML = `<tr style="height: 52px;"><td colspan="8" class="text-center" style="color: #94a3b8; padding: 30px;">Không có dữ liệu.</td></tr>`;
        for (let i = 1; i < itemsPerPage; i++) {
            const filler = document.createElement('tr');
            filler.className = 'table-filler-row';
            filler.innerHTML = `<td colspan="8">&nbsp;</td>`;
            tableBodyElement.appendChild(filler);
        }
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    paginatedItems.forEach((customer, index) => {
        const tr = document.createElement('tr');
        let maKhColor = (customer.classification && classificationColors[customer.classification]) ? classificationColors[customer.classification] : 'var(--primary-color)';
        let maKhTitle = customer.classification ? `Phân loại: ${escapeHtml(customer.classification)}` : 'Chưa phân loại';
        const customerId = escapeHtml(customer.customerId || '');
        const taxId = escapeHtml(customer.taxId || '');
        const companyName = escapeHtml(customer.companyName || '');
        const contactName = escapeHtml(customer.contactName || '');
        const phone = escapeHtml(formatPhoneNumber(customer.phone));
        const notes = escapeHtml(customer.notes || '');
        tr.innerHTML = `
            <td class="text-center"><strong>${startIndex + index + 1}</strong></td>
            <td class="nowrap customer-id-cell" style="color: ${maKhColor}; font-weight: bold; cursor: pointer;" title="${customerId} - ${maKhTitle}" data-customer-action="${customerId}">${customerId || '-'}</td>
            <td class="nowrap" title="${taxId}">${taxId || '-'}</td>
            <td title="${companyName}"><strong>${companyName || '-'}</strong></td>
            <td class="nowrap" title="${contactName}">${contactName || '-'}</td>
            <td class="nowrap" title="${phone}">${phone}</td>
            <td class="text-right money nowrap">${formatSalesScaledByMagnitude(customer.sales)}</td>
            <td title="${notes}">${notes || '-'}</td>
        `;
        tableBodyElement.appendChild(tr);
    });
    // Thêm dòng đệm để mọi trang đều cao bằng nhau (đủ 10 dòng), trang cuối ít KH không còn bị co lên
    const fillerCount = itemsPerPage - paginatedItems.length;
    for (let i = 0; i < fillerCount; i++) {
        const filler = document.createElement('tr');
        filler.className = 'table-filler-row';
        filler.innerHTML = `<td colspan="8">&nbsp;</td>`;
        tableBodyElement.appendChild(filler);
    }
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
        notificationMessage.innerHTML = `Mã khách hàng <strong style="color: #ef4444; font-size: 16px;">"${escapeHtml(data.customerId)}"</strong> đã tồn tại trên hệ thống!<br><br><span style="color: #64748b; font-size: 13px;">Vui lòng kiểm tra lại danh sách hoặc nhập một Mã KH khác.</span>`;
        notificationModal.style.display = 'flex';
        return;
    } else {
        let saveError = null;
        if (!isUpdating) {
            const actionBy = currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống';
            if (Array.isArray(data._batchItems) && data._batchItems.length > 0) {
                const batchNote = 'Tạo mới';
                data.history = buildBatchHistoryEntries(data._batchItems, data.lastUpdated, batchNote, actionBy);
                const summary = summarizeBatchForTopLevel(data._batchItems);
                data.category = summary.category || data.category || '';
                data.productDesc = summary.productDesc || data.productDesc || '';
            } else {
                data.history = [{ date: data.lastUpdated, amount: data.sales, quantity: 1, note: 'Tạo mới', category: data.category || '', productDesc: data.productDesc || '', updated_by: actionBy }];
            }
            delete data._batchItems;
            try {
                const payload = mapToSupabase(data);
                ({ error: saveError } = await supabaseClient.from(APP_CONFIG.supabaseTable).insert([payload]));
            } catch (err) {
                saveError = err;
            }
        } else {
            try {
                const payload = mapToSupabase(data);
                ({ error: saveError } = await supabaseClient.from(APP_CONFIG.supabaseTable).update(payload).eq('customer_id', data.customerId));
            } catch (err) {
                saveError = err;
            }
        }

        if (saveError) {
            alert((isUpdating ? "Lỗi khi cập nhật dữ liệu: " : "Lỗi khi thêm mới dữ liệu: ") + saveError.message);
            if (btnSubmit) { btnSubmit.innerText = 'Lưu Khách Hàng'; btnSubmit.disabled = false; }
            return;
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
        // Validate danh sách SP của khách mới: nếu có dòng nhập dở (có tên/mô tả hoặc tiền nhưng thiếu tiền hợp lệ) thì báo để tránh bị bỏ sót
        const rawNewItems = collectSalesItems('newCustomerItemsList');
        if (rawNewItems.length > 0) {
            const hasAnyInput = rawNewItems.some(it => it.amount !== null || it.category || it.productDesc);
            if (hasAnyInput) {
                const validation = validateSalesItems(rawNewItems, 'newCustomerItemsList');
                if (!validation.ok) {
                    alert(validation.message);
                    return;
                }
                const rowsWithNameButNoMoney = rawNewItems.filter(it => (it.category || it.productDesc) && (it.amount === null || it.amount === 0));
                if (rowsWithNameButNoMoney.length > 0) {
                    alert('Có sản phẩm đã nhập tên/mô tả nhưng chưa nhập số tiền. Vui lòng nhập số tiền hoặc xóa dòng đó!');
                    return;
                }
            }
        }
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
document.getElementById('btnCloseAnalysisModal')?.addEventListener('click', () => returnFromReportPage('analysisModal'));
document.getElementById('btnAnalyzeCustomers')?.addEventListener('click', () => {
    showAnalysisModal();
    showReportPageView('analysisModal', reportPageReturnTo, true);
});

document.getElementById('btnCloseProductAnalysisModal')?.addEventListener('click', () => returnFromReportPage('productAnalysisModal'));
document.getElementById('btnAnalyzeProducts')?.addEventListener('click', () => {
    showProductAnalysisModal();
    showReportPageView('productAnalysisModal', reportPageReturnTo, true);
});

document.getElementById('btnCloseDeepAnalysisModal')?.addEventListener('click', () => returnFromReportPage('deepAnalysisModal'));
document.getElementById('btnBackFromDeepAnalysis')?.addEventListener('click', () => returnFromReportPage('deepAnalysisModal'));
document.getElementById('btnRefreshDeepAnalysis')?.addEventListener('click', showDeepAnalysis);
document.getElementById('deepAnalysisMonthSelect')?.addEventListener('change', showDeepAnalysis);

document.getElementById('btnBackFromReport')?.addEventListener('click', () => returnFromReportPage('reportModal'));
document.getElementById('btnBackFromAnalysis')?.addEventListener('click', () => returnFromReportPage('analysisModal'));
document.getElementById('btnBackFromProductAnalysis')?.addEventListener('click', () => returnFromReportPage('productAnalysisModal'));

// Export PDF cho modal Phân tích Khách hàng
document.getElementById('btnExportAnalysisPDF')?.addEventListener('click', exportAnalysisToPDF);

// Export PDF cho modal Phân tích Sản phẩm
document.getElementById('btnExportProductAnalysisPDF')?.addEventListener('click', exportProductAnalysisToPDF);

document.getElementById('btnConfirmDelete')?.addEventListener('click', async function () {
    if (customerToDelete) {
        document.getElementById('btnConfirmDelete').innerText = 'Đang xóa...';
        document.getElementById('btnConfirmDelete').disabled = true;
        const { error } = await supabaseClient.from(APP_CONFIG.supabaseTable).delete().eq('customer_id', customerToDelete);
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
    const modalIds = ['customerActionModal', 'editCustomerInfoModal', 'updateSalesModal', 'customerFormModal', 'reportTypeModal', 'reportModal', 'activityHistoryModal', 'analysisModal', 'productAnalysisModal', 'deepAnalysisModal', 'historyModal', 'editHistoryTxModal', 'duplicateModal', 'deleteModal', 'warningModal', 'notificationModal', 'excelImportModal', 'kpi50MilestoneModal'];
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

    // Reset danh sách nhiều sản phẩm (1 dòng trống mặc định)
    resetSalesItemsList('salesItemsList', [{ amount: '', category: '', productDesc: '' }]);

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
        const firstAmount = document.querySelector('#salesItemsList .sales-item-amount');
        if (firstAmount) firstAmount.focus();
        else if (amountInput) amountInput.focus();
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
        if (deleteModalMessage) deleteModalMessage.innerHTML = `Bạn có chắc chắn muốn xóa khách hàng <strong>"${escapeHtml(currentActionCustomerId)}"</strong> không?`;
        if (deleteModal) deleteModal.style.display = 'flex';
    }
});

// Submit Form Option 1: Lưu Thông Tin Khách Hàng (Cập nhật Hồ sơ)
document.getElementById('editCustomerInfoForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const customer = customers.find(c => String(c.customerId).toLowerCase() === String(currentActionCustomerId).toLowerCase());
    if (!customer) return;

    const draft = cloneCustomerData(customer);
    draft.taxId = document.getElementById('editTaxId')?.value.trim() || '';
    draft.companyName = document.getElementById('editCompanyName')?.value.trim() || '';
    draft.classification = document.getElementById('editClassification')?.value || '';
    const editCategoryEl = document.getElementById('editCategory');
    const editProductDescEl = document.getElementById('editProductDesc');
    if (editCategoryEl) draft.category = editCategoryEl.value || '';
    if (editProductDescEl) draft.productDesc = editProductDescEl.value.trim() || '';
    draft.contactName = document.getElementById('editContactName')?.value.trim() || '';
    draft.phone = document.getElementById('editPhone')?.value.trim() || '';
    draft.notes = document.getElementById('editNotes')?.value.trim() || '';
    draft.lastUpdated = new Date().toISOString();

    const saveBtn = document.getElementById('btnSaveEditInfo');
    if (saveBtn) { saveBtn.innerText = 'Đang lưu...'; saveBtn.disabled = true; }

    let error = null;
    try {
        const payload = mapToSupabase(draft);
        ({ error } = await supabaseClient.from(APP_CONFIG.supabaseTable).update(payload).eq('customer_id', customer.customerId));
    } catch (err) {
        error = err;
    }

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
            notificationMessage.innerHTML = `Hồ sơ thông tin của khách hàng <strong>${escapeHtml(customer.customerId)}</strong> đã được cập nhật thành công!`;
            notificationModal.style.display = 'flex';
        }
    }
});

// Submit Form Option 2: Lưu Doanh Số & Sản Phẩm (nhiều SP trong 1 đợt)
document.getElementById('updateSalesForm')?.addEventListener('submit', async function (e) {
    e.preventDefault();
    const customer = customers.find(c => String(c.customerId).toLowerCase() === String(currentActionCustomerId).toLowerCase());
    if (!customer) return;

    const rawItems = collectSalesItems('salesItemsList');
    let itemsToSave = [];
    let txNoteVal = document.getElementById('salesTxNoteInput')?.value.trim() || '';

    if (rawItems.length > 0) {
        const validation = validateSalesItems(rawItems, 'salesItemsList');
        if (!validation.ok) {
            alert(validation.message);
            return;
        }
        itemsToSave = validation.items;
    }

    // Tương thích ngược: nếu vì lý do nào đó danh sách mới chưa render, dùng input đơn cũ
    if (itemsToSave.length === 0) {
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
        itemsToSave = [{ amount: addedSales, quantity: 1, category: categoryVal, productDesc: productDescVal }];
    }

    const batchDate = new Date().toISOString();
    const actionBy = currentUserEmail ? currentUserEmail.split('@')[0] : 'hệ thống';
    const batchEntries = buildBatchHistoryEntries(itemsToSave, batchDate, txNoteVal, actionBy);
    const addedSales = itemsToSave.reduce((sum, it) => sum + (it.amount || 0), 0);

    const draft = cloneCustomerData(customer);
    draft.sales = (draft.sales || 0) + addedSales;
    if (!Array.isArray(draft.history)) draft.history = [];
    batchEntries.forEach(entry => draft.history.push(entry));
    draft.lastUpdated = batchDate;
    const batchSummary = summarizeBatchForTopLevel(itemsToSave);
    if (batchSummary.category) draft.category = batchSummary.category;
    if (batchSummary.productDesc) draft.productDesc = batchSummary.productDesc;

    const saveBtn = document.getElementById('btnSaveUpdateSales');
    if (saveBtn) { saveBtn.innerText = 'Đang lưu...'; saveBtn.disabled = true; }

    let error = null;
    try {
        const payload = mapToSupabase(draft);
        ({ error } = await supabaseClient.from(APP_CONFIG.supabaseTable).update(payload).eq('customer_id', customer.customerId));
    } catch (err) {
        error = err;
    }

    if (saveBtn) { saveBtn.innerText = 'Lưu Doanh Số & Sản Phẩm'; saveBtn.disabled = false; }

    if (error) {
        alert("Lỗi khi cập nhật doanh số: " + error.message);
    } else {
        let titleColor = addedSales > 0 ? '#10b981' : '#ef4444';
        let actionText = addedSales > 0 ? `Tăng thêm ${formatCurrency(addedSales)}` : `Giảm đi ${formatCurrency(Math.abs(addedSales))}`;
        if (itemsToSave.length > 1) {
            actionText += `<br><span style="font-size: 13px; color: #64748b;">(${itemsToSave.length} sản phẩm trong cùng 1 đợt)</span>`;
        }

        await fetchCustomers();
        updateCategoryDatalist(); // Cập nhật danh sách thể loại
        closeUpdateSalesModal();

        if (notificationTitle && notificationMessage && notificationModal) {
            notificationTitle.innerText = 'Thành công!';
            notificationTitle.style.color = titleColor;
            notificationMessage.innerHTML = `Doanh số của khách hàng <strong>${escapeHtml(customer.customerId)}</strong> đã được <br><strong style="color: ${titleColor}; font-size: 18px;">${actionText}</strong>`;
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
        const { error } = await supabaseClient.from(APP_CONFIG.supabaseTable).update(payload).eq('customer_id', pendingCustomerData.customerId);

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
                const { error } = await supabaseClient.from(APP_CONFIG.supabaseTable).upsert(payloadsToUpsert, { onConflict: 'customer_id' });
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
function initCustomAutocomplete(inputOrId, datalistId) {
    const input = (typeof inputOrId === 'string') ? document.getElementById(inputOrId) : inputOrId;
    if (!input || input.dataset.autocompleteBound) return;

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

        const isNameField = /category/i.test(datalistId || '') || /sales-item-name/i.test(input.className || '');
        const isDescField = /productdesc/i.test(datalistId || '') || /sales-item-desc/i.test(input.className || '');
        const isProductField = isNameField || isDescField;
        const keyword = String(input.value || '').trim();
        const shown = items.slice(0, 8);

        const header = document.createElement('div');
        header.className = 'suggest-header';
        const headerLeft = document.createElement('span');
        headerLeft.textContent = isNameField ? 'Tên sản phẩm' : isDescField ? 'Mô tả sản phẩm' : 'Gợi ý';
        const headerRight = document.createElement('span');
        headerRight.style.display = 'inline-flex';
        headerRight.style.gap = '8px';
        headerRight.style.alignItems = 'center';
        const countBadge = document.createElement('span');
        countBadge.className = 'suggest-count';
        countBadge.textContent = shown.length + (items.length > shown.length ? '+' : '');
        countBadge.title = items.length + ' gợi ý';
        const hint = document.createElement('span');
        hint.className = 'suggest-hint';
        hint.textContent = '↑↓ chọn • Enter dùng';
        headerRight.appendChild(countBadge);
        headerRight.appendChild(hint);
        header.appendChild(headerLeft);
        header.appendChild(headerRight);
        dropdown.appendChild(header);

        const avatarPalette = [
            'linear-gradient(135deg, #1B362B, #2E5A46)',
            'linear-gradient(135deg, #2563EB, #60A5FA)',
            'linear-gradient(135deg, #D97706, #F59E0B)',
            'linear-gradient(135deg, #7C3AED, #A78BFA)',
            'linear-gradient(135deg, #059669, #34D399)',
            'linear-gradient(135deg, #DC2626, #F87171)',
            'linear-gradient(135deg, #0891B2, #22D3EE)',
            'linear-gradient(135deg, #C2410C, #FB923C)'
        ];
        function avatarBgFor(text) {
            let h = 0;
            const s = String(text || '');
            for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
            return avatarPalette[h % avatarPalette.length];
        }

        shown.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'custom-autocomplete-item';
            div.setAttribute('data-index', index);
            div.title = item;

            const avatar = document.createElement('span');
            avatar.className = 'suggest-avatar';
            avatar.style.background = avatarBgFor(item);
            const firstChar = String(item || '').trim().charAt(0) || (isProductField ? '📦' : '🔍');
            avatar.textContent = /[A-Za-zÀ-ỹ]/.test(firstChar) ? firstChar.toUpperCase() : (isProductField ? '📦' : '🔍');

            const body = document.createElement('span');
            body.className = 'suggest-body';

            const text = document.createElement('span');
            text.className = 'suggest-text';
            if (keyword) {
                const lowerItem = String(item).toLowerCase();
                const lowerKey = keyword.toLowerCase();
                const pos = lowerItem.indexOf(lowerKey);
                if (pos >= 0) {
                    const before = document.createTextNode(String(item).slice(0, pos));
                    const mark = document.createElement('mark');
                    mark.textContent = String(item).slice(pos, pos + keyword.length);
                    const after = document.createTextNode(String(item).slice(pos + keyword.length));
                    text.appendChild(before);
                    text.appendChild(mark);
                    text.appendChild(after);
                } else {
                    text.textContent = item;
                }
            } else {
                text.textContent = item;
            }

            const sub = document.createElement('span');
            sub.className = 'suggest-sub';
            sub.textContent = isNameField ? 'Tên sản phẩm • nhấn để điền' : isDescField ? 'Mô tả chi tiết • nhấn để điền' : 'Nhấn để điền';

            body.appendChild(text);
            body.appendChild(sub);

            const go = document.createElement('span');
            go.className = 'suggest-go';
            go.textContent = '→';

            div.appendChild(avatar);
            div.appendChild(body);
            div.appendChild(go);

            div.addEventListener('click', () => {
                input.value = item;
                dropdown.classList.remove('show');
                input.focus();
                input.dispatchEvent(new Event('input', { bubbles: true }));
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
    input.dataset.autocompleteBound = '1';
    return { input, dropdown, wrapper };
}

// Bản bind trực tiếp cho ô nhập tạo động (dòng SP thêm nhiều lần) — dùng chung initCustomAutocomplete hiện đại
function bindAutocompleteElement(input, datalistId) {
    return initCustomAutocomplete(input, datalistId);
}
// ========== CHUẨN HÓA TÊN SẢN PHẨM (CHỈ TẦNG HIỂN THỊ/PHÂN TÍCH - KHÔNG SỬA DỮ LIỆU GỐC) ==========
// Vấn đề: tên SP nhập tay tự do nên "HP M404dn", "HP M404DN", "  hp   m404dn " bị tính thành 3 SP khác nhau.
// Giải pháp: gộp theo khóa chuẩn hóa (trim + gộp khoảng trắng + lower-case) khi hiển thị gợi ý và khi phân tích.
// Dữ liệu gốc trong history / Supabase được giữ nguyên 100%, chỉ tên hiển thị được chọn từ biến thể phổ biến nhất.
function normalizeProductKey(name) {
    if (name === undefined || name === null) return '';
    return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
}

function collapseSpacesPreserveCase(name) {
    return String(name === undefined || name === null ? '' : name).trim().replace(/\s+/g, ' ');
}

// Dựng bản đồ key chuẩn hóa -> tên hiển thị (biến thể xuất hiện nhiều nhất, ổn định để báo cáo nhất quán).
// Dùng cho cả gợi ý datalist và nhóm phân tích, nên "Mực in" gõ kiểu nào cũng về một dòng.
function buildProductNameCanonicalMap() {
    const freqByKey = {}; // key -> { displayCounts: {display: count}, total }
    function addRaw(raw) {
        const display = collapseSpacesPreserveCase(raw);
        if (!display) return;
        const key = normalizeProductKey(display);
        if (!key) return;
        if (!freqByKey[key]) freqByKey[key] = { displayCounts: {}, total: 0, firstSeen: display };
        const entry = freqByKey[key];
        entry.displayCounts[display] = (entry.displayCounts[display] || 0) + 1;
        entry.total++;
    }
    ['Máy in', 'Mực in', 'Linh kiện', 'Dịch vụ / Sửa chữa', 'Khác'].forEach(addRaw);
    if (Array.isArray(customers)) {
        customers.forEach(c => {
            addRaw(c.category);
            if (c.history && Array.isArray(c.history)) {
                c.history.forEach(h => addRaw(h.category));
            }
        });
    }
    const map = {};
    Object.keys(freqByKey).forEach(key => {
        const entry = freqByKey[key];
        let best = entry.firstSeen;
        let bestCount = -1;
        Object.keys(entry.displayCounts).forEach(display => {
            const n = entry.displayCounts[display];
            if (n > bestCount || (n === bestCount && display.length > best.length)) {
                bestCount = n;
                best = display;
            }
        });
        map[key] = best;
    });
    return map;
}

function getCanonicalProductName(raw, canonicalMap) {
    const display = collapseSpacesPreserveCase(raw);
    if (!display) return 'Không rõ';
    const key = normalizeProductKey(display);
    if (!key) return 'Không rõ';
    if (canonicalMap && canonicalMap[key]) return canonicalMap[key];
    return display;
}

// Hàm cập nhật danh sách thể loại động từ dữ liệu khách hàng
function updateCategoryDatalist() {
    // Dùng tên chuẩn hóa cho gợi ý: "HP M404dn" / "HP M404DN" chỉ hiện 1 gợi ý duy nhất.
    const canonicalMap = buildProductNameCanonicalMap();
    const categories = new Set(['Máy in', 'Mực in', 'Linh kiện', 'Dịch vụ / Sửa chữa', 'Khác']);
    const productDescs = new Set();

    // Thu thập tất cả thể loại và mô tả sản phẩm từ customers và lịch sử
    customers.forEach(c => {
        if (c.category && collapseSpacesPreserveCase(c.category)) {
            categories.add(getCanonicalProductName(c.category, canonicalMap));
        }
        if (c.productDesc && c.productDesc.trim()) {
            productDescs.add(c.productDesc.trim());
        }
        if (c.history && Array.isArray(c.history)) {
            c.history.forEach(h => {
                if (h.category && collapseSpacesPreserveCase(h.category)) {
                    categories.add(getCanonicalProductName(h.category, canonicalMap));
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
    const kpiRevenuePeriodName = document.getElementById('kpiRevenuePeriodLabel')?.innerText || `TỔNG DOANH THU ${getReportTypeName(currentReportType).toUpperCase()}`;
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
                        { text: kpiRevenuePeriodName + '\n' + kpiRevenue + '\n' + kpiRevenueCompare, style: 'kpi', border: [true, true, true, true] },
                        { text: 'SỐ GIAO DỊCH PHÁT SINH\n' + kpiTxCount, style: 'kpi', border: [true, true, true, true] }
                    ],
                    [
                        { text: 'TỔNG KHÁCH HÀNG PHÁT SINH\n' + kpiNewCustomers, style: 'kpi', border: [true, true, true, true] },
                        { text: 'DOANH THU BÌNH QUÂN / KHÁCH\n' + kpiNewCustRatio, style: 'kpi', border: [true, true, true, true] },
                        { text: 'TỶ TRỌNG KHÁCH QUAY LẠI\n' + kpiReturnCustRatio, style: 'kpi', border: [true, true, true, true] }
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
    const analysisDetailPdfTitle = document.getElementById('analysisDetailTitle')?.innerText || 'Chi Tiết Khách Hàng Phát Sinh Doanh Số Trong Kỳ';
    content.push({ text: analysisDetailPdfTitle, style: 'subheader', margin: [0, 20, 0, 10], pageBreak: 'before' });
    content.push({
        table: {
            headerRows: 1,
            widths: ['10%', '55%', '35%'],
            body: [
                [
                    { text: 'STT', style: 'tableHeader', alignment: 'center' },
                    { text: 'Mã KH', style: 'tableHeader' },
                    { text: 'Doanh Thu Trong Kỳ', style: 'tableHeader', alignment: 'right' }
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
    const kpiProductRevenueLabel = document.getElementById('kpiProductRevenueLabel')?.innerText || `DOANH THU ${getReportTypeName(currentReportType).toUpperCase()}`;
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
            if (cells.length >= 7) {
                tableData.push([
                    (index + 1).toString(),
                    cells[0].textContent.trim(),
                    cells[1].textContent.trim(),
                    cells[2].textContent.trim(),
                    cells[3].textContent.trim(),
                    cells[4].textContent.trim(),
                    cells[5].textContent.trim(),
                    cells[6].textContent.trim()
                ]);
            }
        });
    }

    // Lấy dữ liệu bảng so sánh với kỳ liền trước
    const compTableBody = document.getElementById('productComparisonTableBody');
    const compTableData = [];
    if (compTableBody) {
        const rows = compTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 8) {
                compTableData.push([
                    cells[0].textContent.trim(),
                    cells[1].textContent.trim(),
                    cells[2].textContent.trim(),
                    cells[3].textContent.trim(),
                    cells[4].textContent.trim(),
                    cells[5].textContent.trim(),
                    cells[6].textContent.trim(),
                    cells[7].textContent.trim()
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
                { text: kpiProductRevenueLabel + '\n' + kpiProductRevenue, style: 'kpi', width: '33.33%' }
            ],
            columnGap: 10,
            margin: [0, 0, 0, 20]
        },

        // Charts Section
        { text: 'Biểu Đồ Phân Tích Sản Phẩm', style: 'subheader', margin: [0, 20, 0, 10] }
    ];

    // Row 1: Top sản phẩm theo lượt giao dịch và doanh thu
    if (imgTopProducts && imgTopRevenueProducts) {
        content.push({ text: 'Top 5 Sản Phẩm Theo Lượt Giao Dịch Và Doanh Thu', style: 'chartTitle', margin: [0, 10, 0, 5] });
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
        content.push({ text: 'Cơ Cấu Doanh Thu Theo Sản Phẩm', style: 'chartTitle', margin: [0, 10, 0, 5] });
        content.push({ image: imgProductDistribution, width: 220, alignment: 'center', margin: [0, 0, 0, 15] });
    }

    // Row 3: Bảng so sánh sản phẩm so với kỳ liền trước
    if (compTableData.length > 0) {
        const productCompPdfTitle = document.getElementById('productComparisonTitle')?.innerText || 'Phân Tích Sản Phẩm So Với Kỳ Trước';
        content.push({ text: productCompPdfTitle, style: 'subheader', margin: [0, 15, 0, 10] });
        const compPrevLabel = document.getElementById('productCompPrevTh')?.innerText || 'SL Kỳ Trước';
        const compCurrLabel = document.getElementById('productCompCurrTh')?.innerText || 'SL Kỳ Này';
        content.push({
            table: {
                headerRows: 1,
                widths: ['20%', '8%', '8%', '15%', '15%', '16%', '8%', '10%'],
                body: [
                    [
                        { text: 'Tên Sản Phẩm', style: 'tableHeader' },
                        { text: compPrevLabel, style: 'tableHeader', alignment: 'center' },
                        { text: compCurrLabel, style: 'tableHeader', alignment: 'center' },
                        { text: document.getElementById('productCompPrevRevenueTh')?.innerText || 'DT Kỳ Trước', style: 'tableHeader', alignment: 'right' },
                        { text: document.getElementById('productCompCurrRevenueTh')?.innerText || 'DT Kỳ Này', style: 'tableHeader', alignment: 'right' },
                        { text: 'Chênh Lệch DT', style: 'tableHeader', alignment: 'right' },
                        { text: 'Tỷ Lệ DT', style: 'tableHeader', alignment: 'center' },
                        { text: 'Trạng Thái', style: 'tableHeader', alignment: 'center' }
                    ],
                    ...compTableData.map(row => [
                        { text: row[0], color: '#3C4A34', bold: true },
                        { text: row[1], alignment: 'center' },
                        { text: row[2], alignment: 'center', bold: true },
                        { text: row[3], alignment: 'right' },
                        { text: row[4], alignment: 'right', bold: true },
                        { text: row[5], alignment: 'right' },
                        { text: row[6], alignment: 'center' },
                        { text: row[7], alignment: 'center' }
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
            widths: ['5%', '22%', '11%', '11%', '17%', '17%', '10%', '7%'],
            body: [
                [
                    { text: 'STT', style: 'tableHeader', alignment: 'center' },
                    { text: 'Tên Sản Phẩm', style: 'tableHeader' },
                    { text: 'Khách Mua', style: 'tableHeader', alignment: 'center' },
                    { text: 'Lượt GD', style: 'tableHeader', alignment: 'center' },
                    { text: 'Doanh Thu', style: 'tableHeader', alignment: 'right' },
                    { text: 'DT / Khách', style: 'tableHeader', alignment: 'right' },
                    { text: 'DT / GD', style: 'tableHeader', alignment: 'right' },
                    { text: 'Tỷ Trọng', style: 'tableHeader', alignment: 'right' }
                ],
                ...tableData.map(row => [
                    { text: row[0], alignment: 'center' },
                    { text: row[1], color: '#3C4A34', bold: true },
                    { text: row[2], alignment: 'center', bold: true },
                    { text: row[3], alignment: 'center' },
                    { text: row[4], alignment: 'right', color: '#10b981', bold: true },
                    { text: row[5], alignment: 'right' },
                    { text: row[6], alignment: 'right' },
                    { text: row[7], alignment: 'right' }
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
        pageOrientation: 'landscape',
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
