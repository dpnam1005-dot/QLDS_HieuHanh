let chartClassificationInstance = null;
let chartTopCustomersInstance = null;
let chartRevenueTrendInstance = null;
let chartTopProductsInstance = null;
let chartTopRevenueProductsInstance = null;
let chartProductDistributionInstance = null;
let chartTopProductsByCustomersInstance = null;
let chartDashboardTrendInstance = null;
let chartDashboardClassInstance = null;

// ========== DASHBOARD TỔNG QUAN: cố định Tháng này (không chọn kỳ ở đây) ==========
// Muốn xem Ngày/Tuần/Năm thì bấm Mở báo cáo, báo cáo vẫn đủ 4 kỳ.
function getDashboardPeriod() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1); start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); end.setHours(23, 59, 59, 999);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); prevStart.setHours(0, 0, 0, 0);
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0); prevEnd.setHours(23, 59, 59, 999);
    return { type: 'month', start, end, prevStart, prevEnd, label: 'Tháng này', compareLabel: 'tháng trước' };
}

function sumHistoryInRange(rStart, rEnd) {
    let rev = 0;
    let count = 0;
    if (!Array.isArray(customers)) return { rev, count };
    customers.forEach(c => {
        if (c.history && Array.isArray(c.history)) {
            c.history.forEach(tx => {
                if (!tx || !tx.date || tx.amount === 0) return;
                const d = new Date(tx.date);
                if (d >= rStart && d <= rEnd) {
                    rev += Number(tx.amount) || 0;
                    count++;
                }
            });
        }
    });
    return { rev, count };
}

function getPageFromHash() {
    try {
        const h = String(window.location.hash || '').toLowerCase();
        if (h.indexOf('dashboard') !== -1) return 'dashboard';
        if (h.indexOf('ranking') !== -1) return 'ranking';
        const saved = localStorage.getItem(APP_CONFIG.storageKeys.currentPage);
        if (saved === 'dashboard') return 'dashboard';
        return 'ranking';
    } catch (e) { return 'ranking'; }
}

function switchAppPage(page, push = true) {
    const normalized = page === 'dashboard' ? 'dashboard' : 'ranking';
    const dashboardPage = document.getElementById('pageDashboard');
    const rankingPage = document.getElementById('pageRanking');
    const tabDashboard = document.getElementById('tabDashboard');
    const tabRanking = document.getElementById('tabRanking');
    const showDashboard = normalized === 'dashboard';
    if (dashboardPage) dashboardPage.style.display = showDashboard ? 'block' : 'none';
    if (rankingPage) rankingPage.style.display = showDashboard ? 'none' : 'block';
    if (tabDashboard) tabDashboard.classList.toggle('active', showDashboard);
    if (tabRanking) tabRanking.classList.toggle('active', !showDashboard);
    if (showDashboard) renderDashboard();
    try { localStorage.setItem(APP_CONFIG.storageKeys.currentPage, normalized); } catch (e) {}
    if (push) {
        const targetHash = showDashboard ? '#/dashboard' : '#/ranking';
        if (window.location.hash !== targetHash) window.location.hash = targetHash;
    }
}

// F5 giữ đúng trang + nút Back chuyển trang nội bộ thay vì thoát (hash routing)
window.addEventListener('hashchange', () => {
    switchAppPage(getPageFromHash(), false);
});
function initializeDashboardRouting() {
    try {
        switchAppPage(getPageFromHash(), false);
        if (!window.location.hash) {
            history.replaceState(null, '', getPageFromHash() === 'dashboard' ? '#/dashboard' : '#/ranking');
        }
    } catch (e) {}
}

window.setTimeout(initializeDashboardRouting, 0);

function refreshDashboardIfVisible() {
    const dashboardPage = document.getElementById('pageDashboard');
    if (dashboardPage && dashboardPage.style.display !== 'none') {
        try { renderDashboard(); } catch (e) { console.warn('Lỗi render dashboard:', e); }
    }
}

function renderDashboard() {
    if (!Array.isArray(customers)) return;
    const period = getDashboardPeriod();
    const cur = sumHistoryInRange(period.start, period.end);
    const prev = sumHistoryInRange(period.prevStart, period.prevEnd);
    const diff = cur.rev - prev.rev;
    let compareText = `0% so với ${period.compareLabel}`;
    let compareColor = '#64748b';
    if (prev.rev > 0) {
        const pct = Math.round((diff / prev.rev) * 100);
        compareText = `${pct >= 0 ? '+' : ''}${pct}% so với ${period.compareLabel}`;
        compareColor = pct >= 0 ? '#10b981' : '#ef4444';
    } else if (cur.rev > 0) {
        compareText = `Mới (+${formatCurrency(cur.rev)})`;
        compareColor = '#10b981';
    }

    const custMap = {};
    const classMap = { "Khách mới": 0, "Thường xuyên": 0, "Không thường xuyên": 0, "Chưa liên hệ được": 0, "Không nhu cầu": 0, "Chưa phân loại": 0 };
    const productMap = {};
    const canonicalMap = typeof buildProductNameCanonicalMap === 'function' ? buildProductNameCanonicalMap() : null;
    customers.forEach(c => {
        let sum = 0;
        let hasTx = false;
        if (c.history && Array.isArray(c.history)) {
            c.history.forEach(tx => {
                if (!tx || !tx.date || tx.amount === 0) return;
                const d = new Date(tx.date);
                if (d >= period.start && d <= period.end) {
                    sum += Number(tx.amount) || 0;
                    hasTx = true;
                    const rawName = tx.category || c.category || '';
                    const pname = canonicalMap && typeof getCanonicalProductName === 'function' ? getCanonicalProductName(rawName, canonicalMap) : (collapseSpacesPreserveCase(rawName) || 'Không rõ');
                    if (!productMap[pname]) productMap[pname] = { name: pname, revenue: 0, count: 0 };
                    productMap[pname].revenue += Number(tx.amount) || 0;
                    productMap[pname].count++;
                }
            });
        }
        if (hasTx) {
            custMap[c.customerId] = { customerId: c.customerId, companyName: c.companyName || '', amount: sum };
            const cls = c.classification || 'Chưa phân loại';
            if (classMap[cls] === undefined) classMap[cls] = 0;
            classMap[cls]++;
        }
    });

    const topCustomers = Object.values(custMap).sort((a, b) => b.amount - a.amount).slice(0, 5);
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const monthSales = getCurrentMonthSales();
    const kpiPct = Math.round((monthSales / KPI_TARGET) * 100);

    const subEl = document.getElementById('dashboardSub');
    if (subEl) subEl.innerText = `${period.label} • So với ${period.compareLabel} • KPI tháng ${kpiPct}%`;

    const grid = document.getElementById('dashboardKpiGrid');
    if (grid) {
        grid.innerHTML = `
            <div class="dash-kpi-card">
                <div class="dash-kpi-label">DOANH THU ${period.label.toUpperCase()}</div>
                <div class="dash-kpi-value" style="color: #059669;">${formatCurrency(cur.rev)}</div>
                <div class="dash-kpi-sub" style="color: ${compareColor}; font-weight: 700;">${compareText}</div>
            </div>
            <div class="dash-kpi-card">
                <div class="dash-kpi-label">KPI THÁNG / 650M</div>
                <div class="dash-kpi-value">${formatCurrency(monthSales)}</div>
                <div class="dash-kpi-sub">Đạt <strong style="color: #B45309;">${kpiPct}%</strong> chỉ tiêu tháng</div>
            </div>
            <div class="dash-kpi-card">
                <div class="dash-kpi-label">GIAO DỊCH ${period.label.toUpperCase()}</div>
                <div class="dash-kpi-value" style="color: #2563EB;">${cur.count}</div>
                <div class="dash-kpi-sub">${Object.keys(custMap).length} khách phát sinh</div>
            </div>
            <div class="dash-kpi-card">
                <div class="dash-kpi-label">TỔNG KHÁCH HÀNG</div>
                <div class="dash-kpi-value">${customers.length}</div>
                <div class="dash-kpi-sub">${Object.keys(custMap).length} khách phát sinh trong kỳ</div>
            </div>
            <div class="dash-kpi-card">
                <div class="dash-kpi-label">TỔNG DOANH SỐ HỆ THỐNG</div>
                <div class="dash-kpi-value" style="color: #3b82f6;">${formatCurrency(customers.reduce((s, c) => s + (c.sales || 0), 0))}</div>
                <div class="dash-kpi-sub">Cộng dồn toàn bộ khách hàng</div>
            </div>
        `;
    }

    const topCustEl = document.getElementById('dashboardTopCustomers');
    if (topCustEl) {
        topCustEl.innerHTML = topCustomers.length === 0 ? `<div style="color: #94a3b8;">Chưa có giao dịch trong kỳ.</div>` : topCustomers.map((it, idx) => `
            <div class="dash-row-item">
                <span><strong style="color: #94a3b8;">#${idx + 1}</strong> <strong style="color: var(--primary-color);">${escapeHtml(it.customerId)}</strong> <span style="color: var(--text-muted);">${escapeHtml(it.companyName || '')}</span></span>
                <strong style="color: #059669; white-space: nowrap;">${formatCurrency(it.amount)}</strong>
            </div>
        `).join('');
    }
    const topProdEl = document.getElementById('dashboardTopProducts');
    if (topProdEl) {
        topProdEl.innerHTML = topProducts.length === 0 ? `<div style="color: #94a3b8;">Chưa có sản phẩm trong kỳ.</div>` : topProducts.map((it, idx) => `
            <div class="dash-row-item">
                <span><strong style="color: #94a3b8;">#${idx + 1}</strong> <strong style="color: var(--text-main);">${escapeHtml(it.name)}</strong> <span style="color: var(--text-muted);">(${it.count} lượt)</span></span>
                <strong style="color: #059669; white-space: nowrap;">${formatCurrency(it.revenue)}</strong>
            </div>
        `).join('');
    }

    const recentEl = document.getElementById('dashboardRecentActivity');
    if (recentEl) {
        const all = [];
        customers.forEach(c => {
            if (c.history && Array.isArray(c.history)) {
                c.history.forEach(tx => {
                    if (tx && tx.date) all.push({ c, tx, date: new Date(tx.date) });
                });
            }
        });
        all.sort((a, b) => b.date - a.date);
        const latest = all.slice(0, 6);
        recentEl.innerHTML = latest.length === 0 ? `<div style="color: #94a3b8;">Chưa có hoạt động.</div>` : latest.map(entry => {
            const prefix = (entry.tx.amount || 0) > 0 ? '+' : '';
            return `<div class="dash-row-item">
                <span><span style="color: var(--text-muted);">${escapeHtml(entry.date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</span> • <strong style="color: var(--primary-color);">${escapeHtml(entry.c.customerId)}</strong> <span style="color: var(--text-muted);">${escapeHtml(entry.tx.note || '')}</span></span>
                <strong style="color: ${(entry.tx.amount || 0) >= 0 ? '#10b981' : '#ef4444'}; white-space: nowrap;">${prefix}${formatCurrency(entry.tx.amount || 0)}</strong>
            </div>`;
        }).join('');
    }

    renderDashboardCharts(period);
}

function renderDashboardCharts(period) {
    if (typeof Chart === 'undefined') return;
    if (chartDashboardTrendInstance) chartDashboardTrendInstance.destroy();
    if (chartDashboardClassInstance) chartDashboardClassInstance.destroy();

    const labels = [];
    const values = [];
    function pushRange(rStart, rEnd, label) {
        labels.push(label);
        values.push(sumHistoryInRange(rStart, rEnd).rev);
    }
    const now = new Date();
    if (period.type === 'day') {
        for (let i = 11; i >= 0; i--) {
            const d = new Date(period.start); d.setDate(d.getDate() - i);
            const s = new Date(d); s.setHours(0, 0, 0, 0);
            const e = new Date(d); e.setHours(23, 59, 59, 999);
            pushRange(s, e, `${String(s.getDate()).padStart(2, '0')}/${String(s.getMonth() + 1).padStart(2, '0')}`);
        }
    } else if (period.type === 'week') {
        for (let i = 11; i >= 0; i--) {
            const s = new Date(period.start); s.setDate(s.getDate() - i * 7); s.setHours(0, 0, 0, 0);
            const e = new Date(s); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59, 999);
            pushRange(s, e, `${String(s.getDate()).padStart(2, '0')}/${String(s.getMonth() + 1).padStart(2, '0')}`);
        }
    } else if (period.type === 'year') {
        const y = now.getFullYear();
        for (let yy = y - 4; yy <= y; yy++) {
            pushRange(new Date(yy, 0, 1), new Date(yy, 11, 31, 23, 59, 59, 999), `${yy}`);
        }
    } else {
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            pushRange(new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999), `T${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
    }

    const trendCanvas = document.getElementById('chartDashboardTrend');
    if (trendCanvas) {
        chartDashboardTrendInstance = new Chart(trendCanvas.getContext('2d'), {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Doanh thu', data: values, backgroundColor: '#3C4A34', borderRadius: 5 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.raw)}` } } },
                scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => v >= 1e6 ? (v / 1e6) + ' Tr' : v.toLocaleString('vi-VN') } } }
            }
        });
    }

    const classMap = { "Khách mới": 0, "Thường xuyên": 0, "Không thường xuyên": 0, "Chưa liên hệ được": 0, "Không nhu cầu": 0, "Chưa phân loại": 0 };
    customers.forEach(c => {
        let hasTx = false;
        if (c.history && Array.isArray(c.history)) {
            hasTx = c.history.some(tx => tx && tx.date && tx.amount !== 0 && new Date(tx.date) >= period.start && new Date(tx.date) <= period.end);
        }
        if (hasTx) {
            const cls = c.classification || 'Chưa phân loại';
            if (classMap[cls] === undefined) classMap[cls] = 0;
            classMap[cls]++;
        }
    });
    const classLabels = Object.keys(classMap).filter(k => classMap[k] > 0);
    const classData = classLabels.map(k => classMap[k]);
    const classColors = classLabels.map(k => (classificationColors && classificationColors[k]) || '#94a3b8');
    const classCanvas = document.getElementById('chartDashboardClass');
    if (classCanvas) {
        chartDashboardClassInstance = new Chart(classCanvas.getContext('2d'), {
            type: 'doughnut',
            data: { labels: classLabels.length ? classLabels : ['Không có dữ liệu'], datasets: [{ data: classData.length ? classData : [1], backgroundColor: classData.length ? classColors : ['#e2e8f0'], borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
        });
    }
}

document.getElementById('tabDashboard')?.addEventListener('click', () => switchAppPage('dashboard'));
document.getElementById('tabRanking')?.addEventListener('click', () => switchAppPage('ranking'));
document.getElementById('btnDashboardReport')?.addEventListener('click', () => {
    openReportTypeModal();
});
document.getElementById('pageDashboard')?.addEventListener('click', (e) => {
    const custEl = e.target && e.target.closest ? e.target.closest('[data-dashboard-customer]') : null;
    if (custEl && custEl.dataset && custEl.dataset.dashboardCustomer) {
        e.preventDefault();
        e.stopPropagation();
        showCustomerActionModal(custEl.dataset.dashboardCustomer);
    }
});
// Event delegation dự phòng cho Dashboard: hoạt động cả khi các card được render lại bằng innerHTML.
document.addEventListener('click', (e) => {
    const custEl = e.target && e.target.closest ? e.target.closest('[data-dashboard-customer]') : null;
    if (!custEl || !custEl.dataset || !custEl.dataset.dashboardCustomer) return;
    if (!document.getElementById('pageDashboard')?.contains(custEl)) return;
    e.preventDefault();
    e.stopPropagation();
    showCustomerActionModal(custEl.dataset.dashboardCustomer);
}, true);

function isPositiveSaleTransaction(tx) {
    const amount = Number(tx && tx.amount);
    const date = tx && tx.date ? new Date(tx.date) : null;
    return Number.isFinite(amount) && amount > 0 && date && !Number.isNaN(date.getTime());
}

function showAnalysisModal() {
    const period = getReportPeriod();
    const start = period.start;
    const end = period.end;
    const prevStart = period.prevStart;
    const prevEnd = period.prevEnd;

    document.getElementById('analysisTitle').innerText = `Phân Tích Doanh Thu & Khách Hàng - ${period.label}`;
    const kpiPeriodLabel = document.getElementById('kpiRevenuePeriodLabel');
    if (kpiPeriodLabel) kpiPeriodLabel.innerText = `TỔNG DOANH THU ${getReportTypeName(period.type).toUpperCase()}`;

    let totalRevenueMonth = 0;
    let txCountMonth = 0;
    const customerRevenueMap = {};
    // This chart uses the customer's saved classification; KPI cards use separate behavior rules.
    const classCountMap = {
        "Khách mới": 0,
        "Thường xuyên": 0,
        "Không thường xuyên": 0,
        "Chưa liên hệ được": 0,
        "Không nhu cầu": 0,
        "Chưa phân loại": 0
    };
    const classTransactionCountMap = {
        "Khách mới": 0,
        "Thường xuyên": 0,
        "Không thường xuyên": 0,
        "Chưa liên hệ được": 0,
        "Không nhu cầu": 0,
        "Chưa phân loại": 0
    };

    let newCustCount = 0;
    let returningCustCount = 0;
    let newCustRevenue = 0;
    let returningCustRevenue = 0;
    let totalActiveCust = 0;

    customers.forEach(c => {
        let customerHasTxInMonth = false;
        let customerRevenueInMonth = 0;
        let customerTransactionCountInMonth = 0;

        const saleHistory = Array.isArray(c.history) ? c.history.filter(isPositiveSaleTransaction) : [];

        if (saleHistory.length > 0) {
            saleHistory.forEach(tx => {
                const txDate = new Date(tx.date);
                const amount = Number(tx.amount);
                if (txDate >= start && txDate <= end) {
                    totalRevenueMonth += amount;
                    txCountMonth++;
                    customerRevenueInMonth += amount;
                    customerTransactionCountInMonth++;
                    customerHasTxInMonth = true;
                }
            });
        }

        if (customerHasTxInMonth) {
            totalActiveCust++;

            // A first-time buyer is based on the earliest positive sale, not the label on the customer.
            const firstPurchaseTime = Math.min(...saleHistory.map(tx => new Date(tx.date).getTime()));
            const isNewThisMonth = firstPurchaseTime >= start.getTime() && firstPurchaseTime <= end.getTime();

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
            if (classCountMap[classification] === undefined) classCountMap[classification] = 0;
            if (classTransactionCountMap[classification] === undefined) classTransactionCountMap[classification] = 0;
            classCountMap[classification]++;
            classTransactionCountMap[classification] += customerTransactionCountInMonth;
        }
    });

    // Tính toán so sánh với kỳ liền trước (ngày/hôm qua, tuần/tuần trước, tháng/tháng trước, năm/năm trước)
    let prevRevenueMonth = 0;
    customers.forEach(c => {
        const saleHistory = Array.isArray(c.history) ? c.history.filter(isPositiveSaleTransaction) : [];
        saleHistory.forEach(tx => {
            const txDate = new Date(tx.date);
            if (txDate >= prevStart && txDate <= prevEnd) {
                prevRevenueMonth += Number(tx.amount);
            }
        });
    });

    const revDiff = totalRevenueMonth - prevRevenueMonth;
    let revPctStr = '';
    let compareColor = 'var(--text-muted)';
    if (prevRevenueMonth > 0) {
        const pct = Math.round((revDiff / prevRevenueMonth) * 100);
        const sign = pct >= 0 ? '+' : '';
        revPctStr = `${sign}${pct}% so với ${period.compareLabel} (${pct >= 0 ? '+' : ''}${formatCurrency(revDiff)})`;
        compareColor = pct >= 0 ? '#10b981' : '#ef4444';
    } else if (totalRevenueMonth > 0) {
        revPctStr = `Mới (+${formatCurrency(totalRevenueMonth)})`;
        compareColor = '#10b981';
    } else {
        revPctStr = `0% so với ${period.compareLabel}`;
    }

    // Tính toán tổng doanh thu của toàn bộ hệ thống
    const totalWebSales = customers.reduce((sum, c) => sum + (c.sales || 0), 0);

    // These cards describe the whole active customer base, without changing source data.
    const averageRevenuePerCustomer = totalActiveCust > 0 ? totalRevenueMonth / totalActiveCust : 0;

    const returnCustRatio = totalActiveCust > 0 ? Math.round((returningCustCount / totalActiveCust) * 100) : 0;
    const returnCustRevenueRatio = totalRevenueMonth > 0 ? Math.round((returningCustRevenue / totalRevenueMonth) * 100) : 0;

    // Cập nhật thẻ chỉ số KPI chính
    document.getElementById('kpiRevenueAllTime').innerText = formatCurrency(totalWebSales);
    document.getElementById('kpiRevenue').innerText = formatCurrency(totalRevenueMonth);
    document.getElementById('kpiRevenueCompare').innerText = revPctStr;
    document.getElementById('kpiRevenueCompare').style.color = compareColor;
    document.getElementById('kpiTxCount').innerText = txCountMonth;
    document.getElementById('kpiNewCustomers').innerText = totalActiveCust;

    // Cập nhật các thẻ quy mô và hiệu quả khách hàng
    document.getElementById('kpiNewCustRatio').innerHTML = `${formatCurrency(averageRevenuePerCustomer)} <span style="font-size: 12px; font-weight: normal; color: var(--text-muted);">${totalActiveCust} KH</span>`;
    document.getElementById('kpiNewCustRevenueRatio').innerText = `Tổng doanh thu: ${formatCurrency(totalRevenueMonth)}`;

    document.getElementById('kpiReturnCustRatio').innerHTML = `${returnCustRatio}% <span style="font-size: 12px; font-weight: normal; color: var(--text-muted);">${returningCustCount}/${totalActiveCust} KH</span>`;
    document.getElementById('kpiReturnCustRevenueRatio').innerText = `Đóng góp: ${returnCustRevenueRatio}% doanh số (${formatCurrency(returningCustRevenue)})`;

    // Tính xu hướng doanh thu theo đúng loại kỳ đã chọn (ngày: 14 ngày gần nhất, tuần: 12 tuần gần nhất, tháng: 12 tháng trong năm, năm: 5 năm gần nhất)
    const trendPeriodLabel = getReportTypeName(period.type).toLowerCase();
    const trendTitleEl = document.getElementById('analysisTrendTitle');
    if (trendTitleEl) trendTitleEl.innerText = `Xu Hướng Tăng Trưởng Doanh Thu Theo Từng ${trendPeriodLabel === 'ngày' ? 'Ngày' : trendPeriodLabel === 'tuần' ? 'Tuần' : trendPeriodLabel === 'năm' ? 'Năm' : 'Tháng'}`;
    const last12Months = [];
    const monthlyRevenues = [];
    function sumRevenueInRange(rStart, rEnd) {
        let rev = 0;
        customers.forEach(c => {
            const saleHistory = Array.isArray(c.history) ? c.history.filter(isPositiveSaleTransaction) : [];
            saleHistory.forEach(tx => {
                const txDate = new Date(tx.date);
                if (txDate >= rStart && txDate <= rEnd) {
                    rev += Number(tx.amount);
                }
            });
        });
        return rev;
    }
    if (period.type === 'day') {
        for (let i = 13; i >= 0; i--) {
            const dStart = new Date(start); dStart.setDate(dStart.getDate() - i); dStart.setHours(0, 0, 0, 0);
            const dEnd = new Date(dStart); dEnd.setHours(23, 59, 59, 999);
            last12Months.push({ label: `${String(dStart.getDate()).padStart(2, '0')}/${String(dStart.getMonth() + 1).padStart(2, '0')}` });
            monthlyRevenues.push(sumRevenueInRange(dStart, dEnd));
        }
    } else if (period.type === 'week') {
        for (let i = 11; i >= 0; i--) {
            const wStart = new Date(start); wStart.setDate(wStart.getDate() - i * 7); wStart.setHours(0, 0, 0, 0);
            const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6); wEnd.setHours(23, 59, 59, 999);
            last12Months.push({ label: `${String(wStart.getDate()).padStart(2, '0')}/${String(wStart.getMonth() + 1).padStart(2, '0')}` });
            monthlyRevenues.push(sumRevenueInRange(wStart, wEnd));
        }
    } else if (period.type === 'year') {
        const curYear = period.year || new Date().getFullYear();
        for (let y = curYear - 4; y <= curYear; y++) {
            const yStart = new Date(y, 0, 1); yStart.setHours(0, 0, 0, 0);
            const yEnd = new Date(y, 11, 31); yEnd.setHours(23, 59, 59, 999);
            last12Months.push({ label: `${y}` });
            monthlyRevenues.push(sumRevenueInRange(yStart, yEnd));
        }
    } else {
        const trendYear = period.year || new Date().getFullYear();
        for (let i = 0; i < 12; i++) {
            last12Months.push({
                year: trendYear,
                month: i + 1,
                label: `T${String(i + 1).padStart(2, '0')}-${trendYear}`
            });
        }
        last12Months.forEach(m => {
            const mStart = new Date(m.year, m.month - 1, 1);
            mStart.setHours(0, 0, 0, 0);
            const mEnd = new Date(m.year, m.month, 0);
            mEnd.setHours(23, 59, 59, 999);
            monthlyRevenues.push(sumRevenueInRange(mStart, mEnd));
        });
    }

    // Populate table details
    const analysisTableBody = document.getElementById('analysisTableBody');
    analysisTableBody.innerHTML = '';

    const activeCustomersList = Object.values(customerRevenueMap).sort((a, b) => b.amount - a.amount);
    const analysisDetailTitle = document.getElementById('analysisDetailTitle');
    if (analysisDetailTitle) analysisDetailTitle.innerText = `Chi Tiết Khách Hàng Phát Sinh Doanh Số Trong ${period.label}`;
    if (activeCustomersList.length === 0) {
        analysisTableBody.innerHTML = `<tr><td colspan="2" class="text-center" style="color: var(--text-muted); padding: 15px;">Không có dữ liệu giao dịch trong ${escapeHtml(period.label)}.</td></tr>`;
    } else {
        activeCustomersList.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';
            tr.innerHTML = `
                <td style="width: 75% !important; max-width: 75% !important; padding: 10px 8px; font-weight: bold; color: var(--primary-color); text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" class="customer-id-cell">${escapeHtml(item.customerId)}</td>
                <td style="width: 25% !important; max-width: 25% !important; padding: 10px 8px; text-align: right; white-space: nowrap;">${formatSalesScaledByMagnitude(item.amount)}</td>
            `;
            analysisTableBody.appendChild(tr);
        });
    }

    // Create charts
    createAnalysisCharts(classCountMap, classTransactionCountMap, activeCustomersList.slice(0, 5), last12Months.map(m => m.label), monthlyRevenues);
    // Hiển thị do showReportPageView đảm nhiệm, không set display thủ công ở đây
}

function showProductAnalysisModal() {
    const period = getReportPeriod();
    const start = period.start;
    const end = period.end;
    const startPrev = period.prevStart;
    const endPrev = period.prevEnd;

    document.getElementById('productAnalysisTitle').innerText = `Phân Tích Sản Phẩm & Doanh Thu - ${period.label}`;
    const kpiProductRevenueLabel = document.getElementById('kpiProductRevenueLabel');
    if (kpiProductRevenueLabel) kpiProductRevenueLabel.innerText = `DOANH THU ${getReportTypeName(period.type).toUpperCase()}`;
    const productCompTitle = document.getElementById('productComparisonTitle');
    if (productCompTitle) productCompTitle.innerText = `Phân Tích Sản Phẩm So Với ${period.compareLabel.charAt(0).toUpperCase() + period.compareLabel.slice(1)}`;
    const productCompPrevTh = document.getElementById('productCompPrevTh');
    if (productCompPrevTh) productCompPrevTh.innerText = `Lượt (${period.compareLabel})`;
    const productCompCurrTh = document.getElementById('productCompCurrTh');
    if (productCompCurrTh) productCompCurrTh.innerText = `Lượt (${getReportTypeName(period.type).toLowerCase()} này)`;
    const productCompPrevRevenueTh = document.getElementById('productCompPrevRevenueTh');
    if (productCompPrevRevenueTh) productCompPrevRevenueTh.innerText = `DT (${period.compareLabel})`;
    const productCompCurrRevenueTh = document.getElementById('productCompCurrRevenueTh');
    if (productCompCurrRevenueTh) productCompCurrRevenueTh.innerText = `DT (${getReportTypeName(period.type).toLowerCase()} này)`;

    const productStats = {};
    const prevProductStats = {};
    let totalRevenue = 0;
    let totalPurchases = 0;

    // Gộp các biến thể chỉ khác hoa/thường/khoảng trắng về 1 SP chuẩn, không sửa dữ liệu gốc.
    const canonicalMap = buildProductNameCanonicalMap();

    // Thu thập dữ liệu sản phẩm từ lịch sử
    customers.forEach(c => {
        if (c.history && c.history.length > 0) {
            c.history.forEach(tx => {
                const txDate = new Date(tx.date);
                const amount = Number(tx.amount);
                if (Number.isFinite(amount) && amount !== 0) {
                    const productName = getCanonicalProductName(tx.category || c.category, canonicalMap);

                    // Kỳ hiện tại
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
                        productStats[productName].revenue += amount;
                        productStats[productName].customers.add(c.customerId);
                        totalRevenue += amount;
                        totalPurchases++;
                    }

                    // Kỳ liền trước
                    if (txDate >= startPrev && txDate <= endPrev) {
                        if (!prevProductStats[productName]) {
                            prevProductStats[productName] = { count: 0, revenue: 0 };
                        }
                        prevProductStats[productName].count++;
                        prevProductStats[productName].revenue += amount;
                    }
                }
            });
        }
    });

    const productsArray = Object.values(productStats).map(p => ({
        name: p.name,
        count: p.count,
        revenue: p.revenue,
        customerCount: p.customers.size,
        averageRevenuePerCustomer: p.customers.size > 0 ? p.revenue / p.customers.size : 0,
        averageRevenuePerTransaction: p.count > 0 ? p.revenue / p.count : 0,
        revenueShare: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0
    }));
    const totalProducts = productsArray.length;

    // Cập nhật KPI
    document.getElementById('kpiTotalProducts').innerText = totalProducts;
    document.getElementById('kpiTotalPurchases').innerText = totalPurchases;
    document.getElementById('kpiProductRevenue').innerText = formatCurrency(totalRevenue);

    // Sắp xếp theo số lượt giao dịch để phản ánh đúng "bán chạy".
    const topByTransactions = [...productsArray].sort((a, b) => b.count - a.count || b.revenue - a.revenue).slice(0, 5);

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
            <td style="width: 24%; padding: 8px 6px; font-weight: 600; color: var(--primary-color); font-size: 13px; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</td>
            <td style="width: 12%; padding: 8px 6px; text-align: center; font-weight: 600; font-size: 13px;">${product.customerCount}</td>
            <td style="width: 12%; padding: 8px 6px; text-align: center; font-size: 13px;">${product.count}</td>
            <td style="width: 17%; padding: 8px 6px; text-align: right; font-weight: bold; color: #10b981; font-size: 13px; white-space: nowrap;">${formatCurrency(product.revenue)}</td>
            <td style="width: 15%; padding: 8px 6px; text-align: right; font-size: 13px; white-space: nowrap;">${formatCurrency(product.averageRevenuePerCustomer)}</td>
            <td style="width: 12%; padding: 8px 6px; text-align: right; font-size: 13px; white-space: nowrap;">${formatCurrency(product.averageRevenuePerTransaction)}</td>
            <td style="width: 8%; padding: 8px 6px; text-align: right; font-size: 13px; white-space: nowrap;">${product.revenueShare.toFixed(1)}%</td>
        `;
        tableBody.appendChild(tr);
    });

    // Đổ dữ liệu bảng so sánh với kỳ liền trước
    const allComparisonProductNames = new Set([
        ...Object.keys(productStats),
        ...Object.keys(prevProductStats)
    ]);

    const comparisonList = Array.from(allComparisonProductNames).map(name => {
        const prevCount = prevProductStats[name] ? prevProductStats[name].count : 0;
        const prevRevenue = prevProductStats[name] ? prevProductStats[name].revenue : 0;
        const currCount = productStats[name] ? productStats[name].count : 0;
        const currRevenue = productStats[name] ? productStats[name].revenue : 0;
        const revenueDiff = currRevenue - prevRevenue;

        let growthRateText = '0%';
        if (prevRevenue !== 0) {
            const growthRate = (revenueDiff / Math.abs(prevRevenue)) * 100;
            const sign = growthRate > 0 ? '+' : '';
            growthRateText = `${sign}${growthRate.toFixed(0)}%`;
        } else if (currRevenue !== 0) {
            growthRateText = 'Mới';
        } else {
            growthRateText = '0%';
        }

        const diffText = revenueDiff > 0 ? `+${formatCurrency(revenueDiff)}` : formatCurrency(revenueDiff);

        let statusHtml = '';
        if (revenueDiff > 0) {
            statusHtml = '<span style="color: #16a34a; font-weight: bold;">📈 Tăng</span>';
        } else if (revenueDiff < 0) {
            statusHtml = '<span style="color: #dc2626; font-weight: bold;">📉 Giảm</span>';
        } else {
            statusHtml = '<span style="color: #64748b;">➖ Bằng</span>';
        }

        return {
            name,
            prevCount,
            currCount,
            prevRevenue,
            currRevenue,
            revenueDiff,
            diffText,
            growthRateText,
            statusHtml
        };
    });

    comparisonList.sort((a, b) => b.currRevenue - a.currRevenue || b.revenueDiff - a.revenueDiff);

    const comparisonTableBody = document.getElementById('productComparisonTableBody');
    if (comparisonTableBody) {
        comparisonTableBody.innerHTML = '';
        if (comparisonList.length === 0) {
            comparisonTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #94a3b8; padding: 12px;">Không có dữ liệu so sánh</td></tr>`;
        } else {
            comparisonList.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #e2e8f0';
                tr.innerHTML = `
                    <td style="padding: 8px 4px; font-weight: 600; color: var(--primary-color); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</td>
                    <td style="padding: 8px 4px; text-align: center; font-size: 13px;">${item.prevCount}</td>
                    <td style="padding: 8px 4px; text-align: center; font-weight: bold; font-size: 13px;">${item.currCount}</td>
                    <td style="padding: 8px 4px; text-align: right; font-size: 13px; white-space: nowrap;">${formatCurrency(item.prevRevenue)}</td>
                    <td style="padding: 8px 4px; text-align: right; font-weight: bold; font-size: 13px; white-space: nowrap;">${formatCurrency(item.currRevenue)}</td>
                    <td style="padding: 8px 4px; text-align: right; font-weight: 600; font-size: 13px; white-space: nowrap; color: ${item.revenueDiff > 0 ? '#16a34a' : (item.revenueDiff < 0 ? '#dc2626' : '#475569')};">${item.diffText}</td>
                    <td style="padding: 8px 4px; text-align: center; font-weight: 600; font-size: 13px; color: ${item.revenueDiff > 0 ? '#16a34a' : (item.revenueDiff < 0 ? '#dc2626' : '#475569')};">${item.growthRateText}</td>
                    <td style="padding: 8px 4px; text-align: center; font-size: 13px;">${item.statusHtml}</td>
                `;
                comparisonTableBody.appendChild(tr);
            });
        }
    }

    // Create charts
    createProductCharts(topByTransactions, topByRevenue, productsArray);
    // Hiển thị do showReportPageView đảm nhiệm, không set display thủ công ở đây
}

function createProductCharts(topByTransactions, topByRevenue, productsArray) {
    // Destroy previous instances
    if (chartTopProductsInstance) chartTopProductsInstance.destroy();
    if (chartTopRevenueProductsInstance) chartTopRevenueProductsInstance.destroy();
    if (chartProductDistributionInstance) chartProductDistributionInstance.destroy();

    // Chart 1: Top sản phẩm theo số lượt giao dịch
    const ctx1 = document.getElementById('chartTopProducts').getContext('2d');
    chartTopProductsInstance = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: topByTransactions.map(p => p.name),
            datasets: [{
                label: 'Lượt giao dịch',
                data: topByTransactions.map(p => p.count),
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
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const product = topByTransactions[context.dataIndex];
                            return ` ${product.count} lượt giao dịch - ${product.customerCount} khách mua`;
                        }
                    }
                }
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

    // Sort before splitting so "Sản phẩm khác" is the true remainder.
    const sortedByRevenue = [...productsArray].sort((a, b) => b.revenue - a.revenue);
    const top5Products = sortedByRevenue.slice(0, 5);
    const othersRevenue = sortedByRevenue.slice(5).reduce((sum, p) => sum + p.revenue, 0);

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

function createAnalysisCharts(classCounts, classTransactionCounts, topCustomers, trendLabels, trendData) {
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
                },
                tooltip: {
                    callbacks: {
                        title: function (items) {
                            return items[0]?.label || '';
                        },
                        label: function (context) {
                            const value = Number(context.parsed || 0);
                            return `Khách hàng: ${value} KH`;
                        },
                        afterLabel: function (context) {
                            const transactionCount = classTransactionCounts[context.label] || 0;
                            return `Giao dịch: ${transactionCount}`;
                        }
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
