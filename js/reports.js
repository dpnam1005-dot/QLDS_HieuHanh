let currentReportType = 'month'; // day | week | month | year

function getReportTypeName(type) {
    if (type === 'day') return 'Ngày';
    if (type === 'week') return 'Tuần';
    if (type === 'year') return 'Năm';
    return 'Tháng';
}

function formatLocalISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getMondayOf(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dow = (d.getDay() + 6) % 7; // Thứ 2 = 0
    d.setDate(d.getDate() - dow);
    return d;
}

function getReportPeriod() {
    const now = new Date();
    const type = currentReportType || 'month';

    if (type === 'day') {
        const daySel = document.getElementById('reportDaySelect');
        let base = now;
        if (daySel && daySel.value) {
            const parsed = new Date(daySel.value + 'T00:00:00');
            if (!isNaN(parsed.getTime())) base = parsed;
        }
        const start = new Date(base); start.setHours(0, 0, 0, 0);
        const end = new Date(base); end.setHours(23, 59, 59, 999);
        const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 1);
        const prevEnd = new Date(end); prevEnd.setDate(prevEnd.getDate() - 1);
        const label = `Ngày ${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}/${start.getFullYear()}`;
        return { type, start, end, prevStart, prevEnd, label, compareLabel: 'hôm qua', emptyNoun: label };
    }

    if (type === 'week') {
        const weekSel = document.getElementById('reportWeekSelect');
        let monday = getMondayOf(now);
        if (weekSel && weekSel.value) {
            const parsed = new Date(weekSel.value + 'T00:00:00');
            if (!isNaN(parsed.getTime())) monday = getMondayOf(parsed);
        }
        const start = new Date(monday); start.setHours(0, 0, 0, 0);
        const end = new Date(monday); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
        const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7);
        const prevEnd = new Date(end); prevEnd.setDate(prevEnd.getDate() - 7);
        const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `Tuần ${fmt(start)} - ${fmt(end)}/${end.getFullYear()}`;
        return { type, start, end, prevStart, prevEnd, label, compareLabel: 'tuần trước', emptyNoun: label };
    }

    if (type === 'year') {
        const yearSel = document.getElementById('reportYearSelect');
        let year = now.getFullYear();
        if (yearSel && yearSel.value) {
            const parsed = parseInt(yearSel.value, 10);
            if (!isNaN(parsed)) year = parsed;
        }
        const start = new Date(year, 0, 1); start.setHours(0, 0, 0, 0);
        const end = new Date(year, 11, 31); end.setHours(23, 59, 59, 999);
        const prevStart = new Date(year - 1, 0, 1); prevStart.setHours(0, 0, 0, 0);
        const prevEnd = new Date(year - 1, 11, 31); prevEnd.setHours(23, 59, 59, 999);
        const label = `Năm ${year}`;
        return { type, start, end, prevStart, prevEnd, label, compareLabel: 'năm trước', emptyNoun: label, year };
    }

    const reportMonthSelect = document.getElementById('reportMonthSelect');
    let year, monthIndex, monthLabel;
    const selectedValue = reportMonthSelect ? reportMonthSelect.value : '';
    if (selectedValue && selectedValue.includes('-')) {
        const parts = selectedValue.split('-');
        year = parseInt(parts[0], 10);
        monthIndex = parseInt(parts[1], 10) - 1;
        monthLabel = `${monthIndex + 1}/${year}`;
    } else {
        year = now.getFullYear();
        monthIndex = now.getMonth();
        monthLabel = `${monthIndex + 1}/${year}`;
    }
    const start = new Date(year, monthIndex, 1); start.setHours(0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 0); end.setHours(23, 59, 59, 999);
    const prevStart = new Date(year, monthIndex - 1, 1); prevStart.setHours(0, 0, 0, 0);
    const prevEnd = new Date(year, monthIndex, 0); prevEnd.setHours(23, 59, 59, 999);
    const label = `Tháng ${monthLabel}`;
    return { type: 'month', start, end, prevStart, prevEnd, label, compareLabel: 'tháng trước', emptyNoun: label, year, monthIndex, monthLabel };
}

function updateReportControlsVisibility() {
    const daySel = document.getElementById('reportDaySelect');
    const weekSel = document.getElementById('reportWeekSelect');
    const monthSel = document.getElementById('reportMonthSelect');
    const yearSel = document.getElementById('reportYearSelect');
    const titleEl = document.getElementById('reportTitle');
    const subEl = document.getElementById('reportPeriodSub');
    const typeName = getReportTypeName(currentReportType);

    if (daySel) daySel.style.display = currentReportType === 'day' ? 'block' : 'none';
    if (weekSel) weekSel.style.display = currentReportType === 'week' ? 'block' : 'none';
    if (monthSel) monthSel.style.display = currentReportType === 'month' ? 'block' : 'none';
    if (yearSel) yearSel.style.display = currentReportType === 'year' ? 'block' : 'none';

    if (titleEl) titleEl.innerText = `Báo Cáo Doanh Thu - Báo cáo ${typeName.toLowerCase()}`;
    if (subEl) {
        try {
            const period = getReportPeriod();
            subEl.innerText = `${period.label} • So với ${period.compareLabel}`;
        } catch (e) {
            subEl.innerText = '';
        }
    }
}

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

function populateDaySelect() {
    const daySel = document.getElementById('reportDaySelect');
    if (!daySel) return;
    if (!daySel.value) daySel.value = formatLocalISODate(new Date());
}

function populateWeekSelect() {
    const weekSel = document.getElementById('reportWeekSelect');
    if (!weekSel) return;
    weekSel.innerHTML = '';
    const nowMonday = getMondayOf(new Date());
    const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    for (let i = 0; i < 12; i++) {
        const monday = new Date(nowMonday);
        monday.setDate(monday.getDate() - i * 7);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        const option = document.createElement('option');
        option.value = formatLocalISODate(monday);
        option.text = i === 0 ? `Tuần ${fmt(monday)} - ${fmt(sunday)}/${sunday.getFullYear()} (Tuần này)` : `Tuần ${fmt(monday)} - ${fmt(sunday)}/${sunday.getFullYear()}`;
        weekSel.appendChild(option);
    }
}

function populateYearSelect() {
    const yearSel = document.getElementById('reportYearSelect');
    if (!yearSel) return;
    yearSel.innerHTML = '';
    const nowYear = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
        const y = nowYear - i;
        const option = document.createElement('option');
        option.value = `${y}`;
        option.text = i === 0 ? `Năm ${y} (Năm nay)` : `Năm ${y}`;
        yearSel.appendChild(option);
    }
}

let reportPageReturnTo = 'ranking';
let reportPageCameFromReport = false;

function updateAnalysisBackButtons() {
    const fromReport = reportPageCameFromReport === true;
    const backAnalysis = document.getElementById('btnBackFromAnalysis');
    const backProduct = document.getElementById('btnBackFromProductAnalysis');
    if (backAnalysis) backAnalysis.classList.toggle('report-back-hidden', !fromReport);
    if (backProduct) backProduct.classList.toggle('report-back-hidden', !fromReport);
}

function showReportPageView(pageId, returnTo, fromReport) {
    const page = document.getElementById(pageId);
    if (!page) return;
    if (returnTo === 'dashboard' || returnTo === 'ranking') reportPageReturnTo = returnTo;
    if (fromReport === true || fromReport === false) reportPageCameFromReport = fromReport;
    else if (pageId === 'reportModal') reportPageCameFromReport = false;
    closeAllModals();
    page.classList.add('report-page-view');
    page.style.display = 'flex';
    updateAnalysisBackButtons();
    if (window.location.hash !== `#/${pageId.replace('Modal', '').toLowerCase()}`) {
        history.pushState({ reportPage: pageId }, '', `#/${pageId.replace('Modal', '').toLowerCase()}`);
    }
}

function closeReportPageView(pageId, replaceHistory = false) {
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.remove('report-page-view');
        page.style.display = 'none';
    }
    if (!replaceHistory) history.back();
}

function returnFromReportPage(pageId) {
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.remove('report-page-view');
        page.style.display = 'none';
    }
    if (pageId === 'reportModal') {
        openReportTypeModal();
        return;
    }
    if (pageId === 'analysisModal' || pageId === 'productAnalysisModal' || pageId === 'deepAnalysisModal') {
        if (reportPageCameFromReport) {
            showReportPageView('reportModal', reportPageReturnTo, true);
            return;
        }
        if (pageId === 'deepAnalysisModal') {
            openReportTypeModal();
            return;
        }
        switchAppPage(reportPageReturnTo === 'dashboard' ? 'dashboard' : 'ranking', false);
        return;
    }
    switchAppPage(reportPageReturnTo === 'dashboard' ? 'dashboard' : 'ranking', false);
}

function handleReportPagePopState() {
    ['reportModal', 'analysisModal', 'productAnalysisModal', 'deepAnalysisModal'].forEach(id => {
        const page = document.getElementById(id);
        if (page && page.classList.contains('report-page-view')) {
            page.classList.remove('report-page-view');
            page.style.display = 'none';
        }
    });
}
window.addEventListener('popstate', handleReportPagePopState);

function openReportTypeModal() {
    const m = document.getElementById('reportTypeModal');
    if (m) m.style.display = 'flex';
}

function closeReportTypeModal() {
    const m = document.getElementById('reportTypeModal');
    if (m) m.style.display = 'none';
}

function openReportByType(type, returnTo) {
    currentReportType = type || 'month';
    if (returnTo === 'dashboard' || returnTo === 'ranking') reportPageReturnTo = returnTo;
    if (type === 'day') populateDaySelect();
    if (type === 'week' && (!document.getElementById('reportWeekSelect')?.options?.length)) populateWeekSelect();
    if (type === 'month' && (!document.getElementById('reportMonthSelect')?.options?.length)) populateMonthSelect();
    if (type === 'year' && (!document.getElementById('reportYearSelect')?.options?.length)) populateYearSelect();
    closeReportTypeModal();
    updateReportControlsVisibility();
    showRevenueReport();
    showReportPageView('reportModal');
}

function showRevenueReport() {
    const reportMonthSelect = document.getElementById('reportMonthSelect');
    if (!reportMonthSelect) return;

    if (currentReportType === 'month' && (!reportMonthSelect.options || reportMonthSelect.options.length === 0)) {
        populateMonthSelect();
    }
    if (currentReportType === 'day') populateDaySelect();
    if (currentReportType === 'week' && (!document.getElementById('reportWeekSelect')?.options?.length)) populateWeekSelect();
    if (currentReportType === 'year' && (!document.getElementById('reportYearSelect')?.options?.length)) populateYearSelect();

    updateReportControlsVisibility();
    const period = getReportPeriod();
    const start = period.start;
    const end = period.end;

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
            reportTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #64748b;">Không có giao dịch/biến động doanh thu nào phát sinh trong <strong>${escapeHtml(period.label)}</strong>.</td></tr>`;
            const reportTotalEl = document.getElementById('reportTotalRevenue');
            if (reportTotalEl) {
                reportTotalEl.innerText = "0 đ";
                reportTotalEl.style.color = "#64748b";
            }
        } else {
            transactionsInPeriod.forEach(item => {
                const c = item.customer;
                const tx = item.tx;
                const shortDate = item.date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
                const shortTime = item.date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                const formattedTime = `${shortDate} ${shortTime}`;
                const reportCustomerId = escapeHtml(c.customerId || '');
                const reportCompanyName = escapeHtml(c.companyName || '');
                const reportNote = escapeHtml(tx.note || '');
                totalRevenuePeriod += Number(tx.amount || 0);
                const tr = document.createElement('tr');
                tr.innerHTML = `<td style="padding: 12px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12.5px; text-align: center; white-space: nowrap;">${escapeHtml(formattedTime)}</td><td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: var(--primary-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" class="customer-id-cell" title="${reportCustomerId}">${reportCustomerId || '-'}</td><td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0;">${reportCompanyName || '-'}</td><td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; white-space: nowrap;">${formatSalesScaledByMagnitude(tx.amount)}</td><td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${reportNote || '-'}</td>`;
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
    if (reportModal && !reportModal.classList.contains('report-page-view')) reportModal.style.display = 'none';
}


document.getElementById('reportMonthSelect')?.addEventListener('change', showRevenueReport);
document.getElementById('reportDaySelect')?.addEventListener('change', showRevenueReport);
document.getElementById('reportWeekSelect')?.addEventListener('change', showRevenueReport);
document.getElementById('reportYearSelect')?.addEventListener('change', showRevenueReport);
document.getElementById('btnCloseReportTypeModal')?.addEventListener('click', closeReportTypeModal);
document.getElementById('btnCloseReportTypeBtn')?.addEventListener('click', closeReportTypeModal);
document.getElementById('reportTypeModal')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'reportTypeModal') closeReportTypeModal();
});
function getReportTypeReturnTo() {
    const dashboardPage = document.getElementById('pageDashboard');
    if (dashboardPage && dashboardPage.style.display !== 'none') return 'dashboard';
    return 'ranking';
}
document.getElementById('btnReportTypeDay')?.addEventListener('click', () => openReportByType('day', getReportTypeReturnTo()));
document.getElementById('btnReportTypeWeek')?.addEventListener('click', () => openReportByType('week', getReportTypeReturnTo()));
document.getElementById('btnReportTypeMonth')?.addEventListener('click', () => openReportByType('month', getReportTypeReturnTo()));
document.getElementById('btnReportTypeYear')?.addEventListener('click', () => openReportByType('year', getReportTypeReturnTo()));
document.getElementById('btnReportTypeDeep')?.addEventListener('click', () => {
    const returnTo = getReportTypeReturnTo();
    if (returnTo === 'dashboard' || returnTo === 'ranking') reportPageReturnTo = returnTo;
    currentReportType = 'month';
    closeReportTypeModal();
    showDeepAnalysis();
    showReportPageView('deepAnalysisModal', reportPageReturnTo, false);
});
