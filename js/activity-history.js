// ========== LỊCH SỬ THAO TÁC TOÀN HỆ THỐNG (V1: gộp từ customers[].history) ==========
// Không đụng backend. Không log được thao tác xóa / đăng nhập vì dữ liệu đó không còn trong history.
let activityHistoryPage = 1;
const activityHistoryPerPage = 15;

function getActivityPeriod() {
    const typeSel = document.getElementById('activityPeriodType');
    const type = typeSel ? typeSel.value : 'month';
    const now = new Date();

    if (type === 'all') return { type: 'all', label: 'Tất cả thời gian' };
    if (type === 'day') {
        const daySel = document.getElementById('activityDaySelect');
        let base = now;
        if (daySel && daySel.value) {
            const parsed = new Date(daySel.value + 'T00:00:00');
            if (!isNaN(parsed.getTime())) base = parsed;
        }
        const start = new Date(base); start.setHours(0, 0, 0, 0);
        const end = new Date(base); end.setHours(23, 59, 59, 999);
        const label = `Ngày ${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}/${start.getFullYear()}`;
        return { type, start, end, label };
    }
    if (type === 'week') {
        const weekSel = document.getElementById('activityWeekSelect');
        let monday = getMondayOf(now);
        if (weekSel && weekSel.value) {
            const parsed = new Date(weekSel.value + 'T00:00:00');
            if (!isNaN(parsed.getTime())) monday = getMondayOf(parsed);
        }
        const start = new Date(monday); start.setHours(0, 0, 0, 0);
        const end = new Date(monday); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
        const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        return { type, start, end, label: `Tuần ${fmt(start)} - ${fmt(end)}/${end.getFullYear()}` };
    }
    if (type === 'year') {
        const yearSel = document.getElementById('activityYearSelect');
        let year = now.getFullYear();
        if (yearSel && yearSel.value) {
            const parsed = parseInt(yearSel.value, 10);
            if (!isNaN(parsed)) year = parsed;
        }
        const start = new Date(year, 0, 1); start.setHours(0, 0, 0, 0);
        const end = new Date(year, 11, 31); end.setHours(23, 59, 59, 999);
        return { type, start, end, label: `Năm ${year}` };
    }
    const monthSel = document.getElementById('activityMonthSelect');
    let year = now.getFullYear();
    let monthIndex = now.getMonth();
    if (monthSel && monthSel.value && monthSel.value.includes('-')) {
        const parts = monthSel.value.split('-');
        year = parseInt(parts[0], 10);
        monthIndex = parseInt(parts[1], 10) - 1;
    }
    const start = new Date(year, monthIndex, 1); start.setHours(0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 0); end.setHours(23, 59, 59, 999);
    return { type: 'month', start, end, label: `Tháng ${monthIndex + 1}/${year}` };
}

function classifyActivityItem(tx) {
    const note = String((tx && tx.note) || '');
    if (/tạo mới|thêm mới qua excel/i.test(note)) {
        if (/excel/i.test(note)) return { key: 'excel', label: 'Nhập qua Excel', color: '#8C7A6B' };
        return { key: 'create', label: 'Tạo mới KH', color: '#2563EB' };
    }
    if (/cập nhật qua excel/i.test(note)) return { key: 'excel', label: 'Nhập qua Excel', color: '#8C7A6B' };
    if (/điều chỉnh trực tiếp|cập nhật từ supabase/i.test(note)) return { key: 'adjust', label: 'Điều chỉnh', color: '#D97706' };
    if (tx && tx.amount !== undefined && tx.amount !== null && Number(tx.amount) !== 0) return { key: 'sales', label: 'Cập nhật doanh số', color: '#059669' };
    return { key: 'adjust', label: 'Điều chỉnh', color: '#D97706' };
}

function buildActivityGroups() {
    const flat = [];
    if (Array.isArray(customers)) {
        customers.forEach(c => {
            if (c.history && Array.isArray(c.history)) {
                c.history.forEach(tx => {
                    if (!tx || !tx.date) return;
                    flat.push({ customer: c, tx, date: new Date(tx.date) });
                });
            }
        });
    }
    flat.sort((a, b) => b.date - a.date);

    const groups = [];
    const groupIndexByBatch = {};
    flat.forEach(entry => {
        const batchId = entry.tx.batchId;
        if (batchId) {
            if (groupIndexByBatch[batchId] === undefined) {
                groupIndexByBatch[batchId] = groups.length;
                groups.push({ batchId, date: entry.date, customer: entry.customer, items: [entry.tx] });
            } else {
                const g = groups[groupIndexByBatch[batchId]];
                g.items.push(entry.tx);
                if (entry.date > g.date) g.date = entry.date;
            }
        } else {
            groups.push({ batchId: null, date: entry.date, customer: entry.customer, items: [entry.tx] });
        }
    });
    groups.sort((a, b) => b.date - a.date);
    return groups;
}

function populateActivityPeriodSelects() {
    const daySel = document.getElementById('activityDaySelect');
    if (daySel && !daySel.value) daySel.value = formatLocalISODate(new Date());

    const weekSel = document.getElementById('activityWeekSelect');
    if (weekSel && (!weekSel.options || weekSel.options.length === 0)) {
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

    const monthSel = document.getElementById('activityMonthSelect');
    if (monthSel && (!monthSel.options || monthSel.options.length === 0)) {
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const option = document.createElement('option');
            option.value = `${d.getFullYear()}-${d.getMonth() + 1}`;
            option.text = i === 0 ? `Tháng ${d.getMonth() + 1}/${d.getFullYear()} (Tháng này)` : `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
            monthSel.appendChild(option);
        }
    }

    const yearSel = document.getElementById('activityYearSelect');
    if (yearSel && (!yearSel.options || yearSel.options.length === 0)) {
        const nowYear = new Date().getFullYear();
        for (let i = 0; i < 5; i++) {
            const y = nowYear - i;
            const option = document.createElement('option');
            option.value = `${y}`;
            option.text = i === 0 ? `Năm ${y} (Năm nay)` : `Năm ${y}`;
            yearSel.appendChild(option);
        }
    }
}

function populateActivityUserSelect() {
    const userSel = document.getElementById('activityUserSelect');
    if (!userSel) return;
    const currentVal = userSel.value;
    const users = new Set();
    if (Array.isArray(customers)) {
        customers.forEach(c => {
            if (c.history && Array.isArray(c.history)) {
                c.history.forEach(tx => {
                    if (tx && tx.updated_by) users.add(String(tx.updated_by));
                });
            }
        });
    }
    userSel.innerHTML = '<option value="">Tất cả người làm</option>';
    Array.from(users).sort().forEach(u => {
        const option = document.createElement('option');
        option.value = u;
        option.text = u;
        userSel.appendChild(option);
    });
    if (currentVal && users.has(currentVal)) userSel.value = currentVal;
}

function updateActivityControlsVisibility() {
    const typeSel = document.getElementById('activityPeriodType');
    const type = typeSel ? typeSel.value : 'month';
    const daySel = document.getElementById('activityDaySelect');
    const weekSel = document.getElementById('activityWeekSelect');
    const monthSel = document.getElementById('activityMonthSelect');
    const yearSel = document.getElementById('activityYearSelect');
    if (daySel) daySel.style.display = type === 'day' ? 'block' : 'none';
    if (weekSel) weekSel.style.display = type === 'week' ? 'block' : 'none';
    if (monthSel) monthSel.style.display = type === 'month' ? 'block' : 'none';
    if (yearSel) yearSel.style.display = type === 'year' ? 'block' : 'none';
}

function getFilteredActivityGroups() {
    const period = getActivityPeriod();
    const searchEl = document.getElementById('activitySearchInput');
    const typeEl = document.getElementById('activityTypeSelect');
    const userEl = document.getElementById('activityUserSelect');
    const keyword = searchEl ? searchEl.value.trim().toLowerCase() : '';
    const typeFilter = typeEl ? typeEl.value : '';
    const userFilter = userEl ? userEl.value : '';

    return buildActivityGroups().filter(group => {
        if (period.type !== 'all' && (group.date < period.start || group.date > period.end)) return false;
        const c = group.customer || {};
        if (keyword) {
            const hay = `${c.customerId || ''} ${c.companyName || ''}`.toLowerCase();
            if (!hay.includes(keyword)) return false;
        }
        if (userFilter) {
            const hasUser = group.items.some(it => String(it.updated_by || 'hệ thống') === userFilter);
            if (!hasUser) return false;
        }
        if (typeFilter) {
            const hasType = group.items.some(it => classifyActivityItem(it).key === typeFilter);
            if (!hasType) return false;
        }
        return true;
    });
}

function renderActivityHistory() {
    const listEl = document.getElementById('activityHistoryList');
    const pagingEl = document.getElementById('activityHistoryPaging');
    const subEl = document.getElementById('activityHistorySub');
    if (!listEl) return;

    updateActivityControlsVisibility();
    const period = getActivityPeriod();
    const groups = getFilteredActivityGroups();
    if (subEl) subEl.innerText = `${period.label} • ${groups.length} mốc thao tác`;

    const totalPages = Math.ceil(groups.length / activityHistoryPerPage) || 1;
    if (activityHistoryPage > totalPages) activityHistoryPage = totalPages;
    const startIndex = (activityHistoryPage - 1) * activityHistoryPerPage;
    const pageGroups = groups.slice(startIndex, startIndex + activityHistoryPerPage);

    listEl.innerHTML = '';
    if (pageGroups.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 20px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;">Không có thao tác nào trong <strong>${escapeHtml(period.label)}</strong> với bộ lọc hiện tại.</div>`;
    } else {
        const timeline = document.createElement('div');
        timeline.style.cssText = 'position: relative; padding-left: 24px; border-left: 2px solid #e2e8f0; margin-left: 12px; display: flex; flex-direction: column; gap: 16px;';
        pageGroups.forEach(group => {
            const c = group.customer || {};
            const isBatch = group.batchId && group.items.length > 1;
            const total = group.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
            const mainType = classifyActivityItem(group.items[0]);
            const timeText = group.date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const user = (group.items[0] && group.items[0].updated_by) || 'hệ thống';
            const activityCustomerId = escapeHtml(c.customerId || '');
            const activityCompanyName = escapeHtml(c.companyName || '');
            const activityTime = escapeHtml(timeText);
            const activityUser = escapeHtml(user);

            const card = document.createElement('div');
            card.style.cssText = 'position: relative; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;';
            const dot = document.createElement('div');
            dot.style.cssText = `position: absolute; left: -31px; top: 14px; width: 12px; height: 12px; border-radius: 50%; background-color: ${mainType.color}; border: 2px solid white; box-shadow: 0 0 0 2px #e2e8f0;`;
            card.appendChild(dot);

            let detailHtml = '';
            if (isBatch) {
                detailHtml += `<ol style="margin: 8px 0 0 16px; padding-left: 12px; color: #475569; font-size: 13px;">`;
                group.items.forEach((it, idx) => {
                    const parts = [];
                    if (it.category) parts.push(`<strong style="color: var(--primary-color);">${escapeHtml(it.category)}</strong>`);
                    if (it.productDesc) parts.push(`${escapeHtml(it.productDesc)}`);
                    const name = parts.length > 0 ? parts.join(' - ') : `Sản phẩm ${idx + 1}`;
                    const prefix = (it.amount || 0) > 0 ? '+' : '';
                    detailHtml += `<li>${name}: <strong style="color: ${(it.amount || 0) >= 0 ? '#10b981' : '#ef4444'}">${prefix}${formatCurrency(it.amount || 0)}</strong></li>`;
                });
                detailHtml += `</ol>`;
            } else {
                const it = group.items[0] || {};
                const parts = [];
                if (it.category) parts.push(`<strong style="color: var(--primary-color);">${escapeHtml(it.category)}</strong>`);
                if (it.productDesc) parts.push(`${escapeHtml(it.productDesc)}`);
                const singleName = parts.length > 0 ? parts.join(' - ') : '-';
                const prefix = (it.amount || 0) > 0 ? '+' : '';
                detailHtml += `<div style="font-size: 13px; color: #475569; margin-top: 6px;">${singleName} • <strong style="color: ${(it.amount || 0) >= 0 ? '#10b981' : '#ef4444'}">${prefix}${formatCurrency(it.amount || 0)}</strong></div>`;
                if (it.note) detailHtml += `<div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(it.note)}</div>`;
            }
            const batchNote = isBatch ? String((group.items[0] && (group.items[0].batchNote || '')) || '') : '';
            const title = isBatch ? `Nhập ${group.items.length} sản phẩm cùng đợt` : mainType.label;

            card.innerHTML += `
                <div style="font-size: 12px; color: var(--text-muted); font-weight: 700;">${activityTime}</div>
                <div style="font-size: 14px; font-weight: 800; color: var(--text-main); margin-top: 2px;">
                    <span class="customer-id-cell" style="color: var(--primary-color); cursor: pointer;" data-activity-customer="${activityCustomerId}">${activityCustomerId || '-'}</span>
                    <span style="font-weight: 500; color: var(--text-muted);"> ${activityCompanyName ? `(${activityCompanyName})` : ''}</span>
                </div>
                <div style="margin-top: 6px; display: inline-block; padding: 2px 10px; font-size: 11px; font-weight: 800; border-radius: 20px; color: ${mainType.color}; background: #f8fafc; border: 1px solid #e2e8f0;">${title}</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">Người làm: <strong>${activityUser}</strong> • Tổng đợt: <strong style="color: ${total >= 0 ? '#10b981' : '#ef4444'}">${total > 0 ? '+' : ''}${formatCurrency(total)}</strong>${batchNote ? ` • Ghi chú: ${escapeHtml(batchNote)}` : ''}</div>
                ${detailHtml}
            `;
            timeline.appendChild(card);
        });
        listEl.appendChild(timeline);
    }

    if (pagingEl) {
        pagingEl.innerHTML = '';
        if (totalPages > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'page-btn';
            prevBtn.innerText = 'Trước';
            prevBtn.disabled = activityHistoryPage === 1;
            prevBtn.onclick = () => { if (activityHistoryPage > 1) { activityHistoryPage--; renderActivityHistory(); } };
            pagingEl.appendChild(prevBtn);
            for (let i = 1; i <= totalPages; i++) {
                if (totalPages > 7 && Math.abs(i - activityHistoryPage) > 2 && i !== 1 && i !== totalPages) continue;
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-btn ${i === activityHistoryPage ? 'active' : ''}`;
                pageBtn.innerText = i;
                pageBtn.onclick = () => { activityHistoryPage = i; renderActivityHistory(); };
                pagingEl.appendChild(pageBtn);
            }
            const nextBtn = document.createElement('button');
            nextBtn.className = 'page-btn';
            nextBtn.innerText = 'Sau';
            nextBtn.disabled = activityHistoryPage === totalPages;
            nextBtn.onclick = () => { if (activityHistoryPage < totalPages) { activityHistoryPage++; renderActivityHistory(); } };
            pagingEl.appendChild(nextBtn);
        }
    }
}

function openActivityHistoryModal() {
    populateActivityPeriodSelects();
    populateActivityUserSelect();
    activityHistoryPage = 1;
    renderActivityHistory();
    const m = document.getElementById('activityHistoryModal');
    if (m) m.style.display = 'flex';
}

function closeActivityHistoryModal() {
    const m = document.getElementById('activityHistoryModal');
    if (m) m.style.display = 'none';
}

document.getElementById('btnActivityHistory')?.addEventListener('click', openActivityHistoryModal);
document.getElementById('btnCloseActivityHistoryModal')?.addEventListener('click', closeActivityHistoryModal);
document.getElementById('btnCloseActivityHistoryBtn')?.addEventListener('click', closeActivityHistoryModal);
document.getElementById('activityHistoryModal')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'activityHistoryModal') closeActivityHistoryModal();
    const custEl = e.target && e.target.closest ? e.target.closest('[data-activity-customer]') : null;
    if (custEl && custEl.dataset && custEl.dataset.activityCustomer) {
        closeActivityHistoryModal();
        showCustomerActionModal(custEl.dataset.activityCustomer);
    }
});
document.getElementById('activityPeriodType')?.addEventListener('change', () => { activityHistoryPage = 1; renderActivityHistory(); });
document.getElementById('activityDaySelect')?.addEventListener('change', () => { activityHistoryPage = 1; renderActivityHistory(); });
document.getElementById('activityWeekSelect')?.addEventListener('change', () => { activityHistoryPage = 1; renderActivityHistory(); });
document.getElementById('activityMonthSelect')?.addEventListener('change', () => { activityHistoryPage = 1; renderActivityHistory(); });
document.getElementById('activityYearSelect')?.addEventListener('change', () => { activityHistoryPage = 1; renderActivityHistory(); });
document.getElementById('activityTypeSelect')?.addEventListener('change', () => { activityHistoryPage = 1; renderActivityHistory(); });
document.getElementById('activityUserSelect')?.addEventListener('change', () => { activityHistoryPage = 1; renderActivityHistory(); });
document.getElementById('activitySearchInput')?.addEventListener('input', () => { activityHistoryPage = 1; renderActivityHistory(); });
