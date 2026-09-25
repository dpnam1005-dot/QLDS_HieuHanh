// ========== PHÂN TÍCH AI CHUYÊN SÂU (READ-ONLY) ==========
// Toàn bộ khối này chỉ đọc customers[].history[]. Không gọi insert/update/upsert/delete
// và không sửa object dữ liệu gốc. quantity chỉ được hiển thị/giữ nguyên theo từng dòng;
// amount luôn là tổng tiền của dòng, không nhân amount với quantity.
const DEEP_ANALYSIS_KPI_TARGET = 650000000;
let deepAnalysisLastResult = null;

function deepSetText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value == null ? '' : String(value);
}

function deepSafeDate(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function deepFormatDate(value) {
    const d = deepSafeDate(value);
    return d ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
}

function deepFormatShortMoney(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)} tỷ`;
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)} Tr`;
    if (Math.abs(n) >= 1e3) return `${Math.round(n / 1e3)}K`;
    return Math.round(n).toLocaleString('vi-VN');
}

function deepCustomerLabel(customer, fallback = '') {
    const id = String(customer?.customerId || fallback || '-');
    const company = String(customer?.companyName || '').trim();
    return company ? `${id} • ${company}` : id;
}

function deepProductName(tx, customer, canonicalMap) {
    const raw = tx?.category || customer?.category || tx?.productDesc || customer?.productDesc || 'Không rõ';
    if (typeof getCanonicalProductName === 'function') return getCanonicalProductName(raw, canonicalMap);
    return String(raw).trim() || 'Không rõ';
}

function deepGetPeriod() {
    const now = new Date();
    const select = document.getElementById('deepAnalysisMonthSelect');
    const fallback = document.getElementById('reportMonthSelect');
    const selected = (select?.value || fallback?.value || '').trim();
    let year = now.getFullYear();
    let monthIndex = now.getMonth();
    if (/^\d{4}-\d{1,2}$/.test(selected)) {
        const [y, m] = selected.split('-').map(Number);
        if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
            year = y;
            monthIndex = m - 1;
        }
    }
    const start = new Date(year, monthIndex, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 0);
    end.setHours(23, 59, 59, 999);
    const previousStart = new Date(year, monthIndex - 1, 1);
    previousStart.setHours(0, 0, 0, 0);
    const previousEnd = new Date(year, monthIndex, 0);
    previousEnd.setHours(23, 59, 59, 999);
    const yearAgoStart = new Date(year - 1, monthIndex, 1);
    yearAgoStart.setHours(0, 0, 0, 0);
    const yearAgoEnd = new Date(year - 1, monthIndex + 1, 0);
    yearAgoEnd.setHours(23, 59, 59, 999);
    const asOf = now < start ? new Date(start) : (now > end ? new Date(end) : new Date(now));
    return {
        year, monthIndex, start, end, previousStart, previousEnd, yearAgoStart, yearAgoEnd, asOf,
        label: `Tháng ${monthIndex + 1}/${year}`,
        monthValue: `${year}-${monthIndex + 1}`
    };
}

function deepReadTransactions(cutoff) {
    const rows = [];
    const cutoffTime = deepSafeDate(cutoff)?.getTime() ?? Infinity;
    const canonicalMap = typeof buildProductNameCanonicalMap === 'function' ? buildProductNameCanonicalMap() : null;
    (Array.isArray(customers) ? customers : []).forEach((customer, customerIndex) => {
        const history = Array.isArray(customer?.history) ? customer.history : [];
        history.forEach((tx, historyIndex) => {
            const date = deepSafeDate(tx?.date);
            const amount = Number(tx?.amount);
            if (!date || !Number.isFinite(amount) || amount === 0 || date.getTime() > cutoffTime) return;
            rows.push({
                customer,
                customerIndex,
                customerKey: String(customer?.customerId || `customer-${customerIndex}`),
                tx,
                historyIndex,
                date,
                amount,
                product: deepProductName(tx, customer, canonicalMap)
            });
        });
    });
    return rows;
}

function deepBuildOrders(cutoff) {
    const orders = [];
    const cutoffTime = deepSafeDate(cutoff)?.getTime() ?? Infinity;
    const canonicalMap = typeof buildProductNameCanonicalMap === 'function' ? buildProductNameCanonicalMap() : null;
    (Array.isArray(customers) ? customers : []).forEach((customer, customerIndex) => {
        const history = Array.isArray(customer?.history) ? customer.history : [];
        const grouped = new Map();
        history.forEach((tx, historyIndex) => {
            const date = deepSafeDate(tx?.date);
            const amount = Number(tx?.amount);
            if (!date || !Number.isFinite(amount) || amount <= 0 || date.getTime() > cutoffTime) return;
            const batchId = String(tx?.batchId ?? '').trim();
            const key = batchId ? `batch:${batchId}` : `entry:${historyIndex}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    customer,
                    customerIndex,
                    customerKey: String(customer?.customerId || `customer-${customerIndex}`),
                    orderKey: key,
                    batchId: batchId || '',
                    date: new Date(date),
                    amount: 0,
                    products: new Set(),
                    transactionCount: 0
                });
            }
            const order = grouped.get(key);
            if (date > order.date) order.date = new Date(date);
            order.amount += amount;
            order.products.add(deepProductName(tx, customer, canonicalMap));
            order.transactionCount += 1;
        });
        grouped.forEach(order => orders.push(order));
    });
    return orders;
}

function deepMetricsForRange(transactions, start, end) {
    const startTime = deepSafeDate(start)?.getTime() ?? -Infinity;
    const endTime = deepSafeDate(end)?.getTime() ?? Infinity;
    let gross = 0;
    let negative = 0;
    let transactionCount = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    (transactions || []).forEach(item => {
        const time = item.date.getTime();
        if (time < startTime || time > endTime) return;
        transactionCount += 1;
        if (item.amount > 0) {
            gross += item.amount;
            positiveCount += 1;
        } else if (item.amount < 0) {
            negative += item.amount;
            negativeCount += 1;
        }
    });
    return { gross, negative, net: gross + negative, transactionCount, positiveCount, negativeCount };
}

function deepChangeText(current, baseline) {
    const diff = current - baseline;
    if (baseline === 0) return current === 0 ? '0% (không có dữ liệu nền)' : 'Mới phát sinh';
    const pct = (diff / Math.abs(baseline)) * 100;
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}% (${diff >= 0 ? '+' : ''}${formatCurrency(diff)})`;
}

function deepScore(value, values, lowerIsBetter) {
    const sorted = [...values].sort((a, b) => lowerIsBetter ? a - b : b - a);
    const index = Math.max(0, sorted.findIndex(item => item === value));
    return Math.max(1, Math.min(5, 5 - Math.floor((index / Math.max(sorted.length, 1)) * 5)));
}

function deepRfmGroup(r, f, m, recencyDays) {
    if (r >= 4 && f >= 4 && m >= 4) return 'VIP';
    if (recencyDays > 90 || r <= 1) return 'Đã ngủ đông';
    if (r <= 2 && (f >= 3 || m >= 3)) return 'Có nguy cơ rời bỏ';
    if (f >= 4 && r >= 3) return 'Trung thành';
    return 'Tiềm năng';
}

function deepBuildRfm(period) {
    const orders = deepBuildOrders(period.asOf);
    const byCustomer = new Map();
    orders.forEach(order => {
        if (!byCustomer.has(order.customerKey)) byCustomer.set(order.customerKey, []);
        byCustomer.get(order.customerKey).push(order);
    });
    const raw = [];
    byCustomer.forEach(customerOrders => {
        customerOrders.sort((a, b) => a.date - b.date);
        const lastOrder = customerOrders[customerOrders.length - 1];
        const recencyDays = Math.max(0, Math.floor((period.asOf.getTime() - lastOrder.date.getTime()) / 86400000));
        raw.push({
            customer: lastOrder.customer,
            customerKey: lastOrder.customerKey,
            orders: customerOrders,
            recencyDays,
            frequency: customerOrders.length,
            monetary: customerOrders.reduce((sum, order) => sum + order.amount, 0),
            lastDate: lastOrder.date
        });
    });
    const recencies = raw.map(item => item.recencyDays);
    const frequencies = raw.map(item => item.frequency);
    const monetaryValues = raw.map(item => item.monetary);
    raw.forEach(item => {
        item.rScore = deepScore(item.recencyDays, recencies, true);
        item.fScore = deepScore(item.frequency, frequencies, false);
        item.mScore = deepScore(item.monetary, monetaryValues, false);
        item.group = deepRfmGroup(item.rScore, item.fScore, item.mScore, item.recencyDays);
    });
    raw.sort((a, b) => {
        const groupOrder = { VIP: 0, 'Trung thành': 1, 'Có nguy cơ rời bỏ': 2, 'Đã ngủ đông': 3, 'Tiềm năng': 4 };
        return (groupOrder[a.group] ?? 9) - (groupOrder[b.group] ?? 9) || b.monetary - a.monetary;
    });
    return raw;
}

function deepEmptyRow(colspan, message = 'Không có dữ liệu phù hợp trong kỳ phân tích.') {
    return `<tr><td colspan="${colspan}" style="text-align:center;color:#94a3b8;padding:18px;">${escapeHtml(message)}</td></tr>`;
}

function deepRenderRfm(rfm) {
    const counts = rfm.reduce((acc, item) => { acc[item.group] = (acc[item.group] || 0) + 1; return acc; }, {});
    deepSetText('deepRfmVipCount', counts.VIP || 0);
    deepSetText('deepRfmLoyalCount', counts['Trung thành'] || 0);
    deepSetText('deepRfmRiskCount', counts['Có nguy cơ rời bỏ'] || 0);
    deepSetText('deepRfmDormantCount', counts['Đã ngủ đông'] || 0);
    const body = document.getElementById('deepRfmTableBody');
    if (!body) return;
    const rows = rfm.slice(0, 60);
    body.innerHTML = rows.length ? rows.map(item => `<tr>
        <td><strong>${escapeHtml(deepCustomerLabel(item.customer, item.customerKey))}</strong></td>
        <td><span class="deep-analysis-status-badge">${escapeHtml(item.group)}</span><br><small>R${item.rScore} / F${item.fScore} / M${item.mScore}</small></td>
        <td class="deep-center">${item.recencyDays} ngày</td>
        <td class="deep-center">${item.frequency} đợt</td>
        <td class="deep-money">${formatCurrency(item.monetary)}</td>
        <td class="deep-center">${deepFormatDate(item.lastDate)}</td>
    </tr>`).join('') : deepEmptyRow(6);
}

function deepRenderChurn(rfm) {
    const body = document.getElementById('deepChurnTableBody');
    if (!body) return;
    const list = rfm.filter(item => item.frequency >= 2 && item.recencyDays >= 60).sort((a, b) => b.monetary - a.monetary).slice(0, 40);
    body.innerHTML = list.length ? list.map(item => {
        const dormant = item.recencyDays > 90;
        return `<tr>
            <td><strong>${escapeHtml(deepCustomerLabel(item.customer, item.customerKey))}</strong></td>
            <td><span class="deep-analysis-status-badge" style="background:${dormant ? '#fee2e2' : '#ffedd5'};color:${dormant ? '#b91c1c' : '#c2410c'}">${dormant ? 'Đã ngủ đông' : 'Sắp mất'}</span></td>
            <td class="deep-center">${item.recencyDays} ngày</td><td class="deep-center">${item.frequency} đợt</td>
            <td class="deep-money">${formatCurrency(item.monetary)}</td>
            <td>${dormant ? 'Gọi lại ngay, ưu tiên khôi phục' : 'Đưa vào danh sách chăm sóc tuần này'}</td>
        </tr>`;
    }).join('') : deepEmptyRow(6, 'Chưa có khách đủ điều kiện cảnh báo (>60 ngày và từ 2 đợt mua).');
}

function deepRenderPareto(rfm) {
    const active = [...rfm].sort((a, b) => b.monetary - a.monetary);
    const total = active.reduce((sum, item) => sum + item.monetary, 0);
    let cumulative = 0;
    let cutoff = 0;
    active.forEach(item => {
        if (cutoff === 0 && total > 0 && cumulative < total * 0.8) cutoff += 1;
        cumulative += item.monetary;
    });
    if (active.length && cutoff === 0) cutoff = 1;
    const top10Count = active.length ? Math.max(1, Math.ceil(active.length * 0.1)) : 0;
    const top10Revenue = active.slice(0, top10Count).reduce((sum, item) => sum + item.monetary, 0);
    const top10Share = total > 0 ? (top10Revenue / total) * 100 : 0;
    const customerShare = active.length > 0 ? (cutoff / active.length) * 100 : 0;
    const risk = top10Share >= 60 ? 'Cao' : (top10Share >= 40 ? 'Vừa' : 'Thấp');
    deepSetText('deepParetoCustomerCount', cutoff);
    deepSetText('deepParetoCustomerShare', `${customerShare.toFixed(1)}% tổng KH mua`);
    deepSetText('deepParetoTopShare', `${top10Share.toFixed(1)}%`);
    deepSetText('deepParetoRevenue', formatCurrency(total));
    deepSetText('deepParetoRisk', risk);
    deepSetText('deepParetoRiskSub', risk === 'Cao' ? 'Nên mở rộng tệp khách' : 'Theo dõi định kỳ');
    const body = document.getElementById('deepParetoTableBody');
    if (!body) return;
    cumulative = 0;
    body.innerHTML = active.length ? active.slice(0, 25).map((item, index) => {
        cumulative += item.monetary;
        return `<tr><td class="deep-center">${index + 1}</td><td><strong>${escapeHtml(deepCustomerLabel(item.customer, item.customerKey))}</strong></td><td class="deep-money">${formatCurrency(item.monetary)}</td><td class="deep-center">${total ? ((item.monetary / total) * 100).toFixed(1) : '0.0'}%</td><td class="deep-center">${total ? ((cumulative / total) * 100).toFixed(1) : '0.0'}%</td></tr>`;
    }).join('') : deepEmptyRow(5);
}

function deepOrdersInRange(orders, start, end) {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return orders.filter(order => order.date.getTime() >= startTime && order.date.getTime() <= endTime);
}

function deepMonthBounds(year, monthIndex) {
    const start = new Date(year, monthIndex, 1); start.setHours(0, 0, 0, 0);
    const end = new Date(year, monthIndex + 1, 0); end.setHours(23, 59, 59, 999);
    return { start, end };
}

function deepRenderAov(period) {
    const orders = deepBuildOrders(period.asOf);
    const series = [];
    for (let offset = 7; offset >= 0; offset -= 1) {
        const date = new Date(period.year, period.monthIndex - offset, 1);
        const bounds = deepMonthBounds(date.getFullYear(), date.getMonth());
        const monthlyOrders = deepOrdersInRange(orders, bounds.start, bounds.end);
        const revenue = monthlyOrders.reduce((sum, order) => sum + order.amount, 0);
        series.push({ label: `T${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`, revenue, orders: monthlyOrders.length, aov: monthlyOrders.length ? revenue / monthlyOrders.length : 0 });
    }
    const current = series[series.length - 1];
    const previous = series[series.length - 2];
    const body = document.getElementById('deepAovTableBody');
    if (body) body.innerHTML = series.map((item, index) => `<tr><td>${item.label}${index === series.length - 1 ? ' <strong>(đang xem)</strong>' : ''}</td><td class="deep-money">${formatCurrency(item.revenue)}</td><td class="deep-center">${item.orders}</td><td class="deep-money">${formatCurrency(item.aov)}</td><td class="deep-center">${index === 0 ? '-' : escapeHtml(deepChangeText(item.aov, series[index - 1].aov))}</td></tr>`).join('');
    const orderChange = current.orders - previous.orders;
    const aovChange = current.aov - previous.aov;
    deepSetText('deepAovInsight', '');
    const insight = document.getElementById('deepAovInsight');
    if (insight) insight.innerHTML = `Tháng đang xem có <strong>${current.orders} đợt mua</strong>, giá trị trung bình <strong>${formatCurrency(current.aov)}</strong>. So với tháng trước: số đợt <strong>${orderChange >= 0 ? '+' : ''}${orderChange}</strong>, giá trị/đợt <strong>${aovChange >= 0 ? '+' : ''}${formatCurrency(aovChange)}</strong>. ${aovChange >= 0 ? 'Tăng trưởng đang đến từ đơn lớn hơn.' : 'Cần kiểm tra chất lượng/giá trị từng đơn; doanh thu có thể chỉ tăng nhờ nhiều đơn hơn.'}`;
}

function deepRenderPairs(period) {
    const orders = deepBuildOrders(period.asOf);
    const pairMap = new Map();
    orders.forEach(order => {
        const products = Array.from(order.products).filter(Boolean).sort((a, b) => normalizeProductKey(a).localeCompare(normalizeProductKey(b)));
        if (products.length < 2) return;
        for (let i = 0; i < products.length - 1; i += 1) {
            for (let j = i + 1; j < products.length; j += 1) {
                const key = `${normalizeProductKey(products[i])}||${normalizeProductKey(products[j])}`;
                if (!pairMap.has(key)) pairMap.set(key, { first: products[i], second: products[j], count: 0, revenue: 0, customers: new Set() });
                const pair = pairMap.get(key);
                pair.count += 1;
                pair.revenue += order.amount;
                pair.customers.add(order.customerKey);
            }
        }
    });
    const pairs = Array.from(pairMap.values()).sort((a, b) => b.count - a.count || b.revenue - a.revenue).slice(0, 30);
    const body = document.getElementById('deepPairTableBody');
    if (body) body.innerHTML = pairs.length ? pairs.map(pair => `<tr><td><strong>${escapeHtml(pair.first)}</strong> + <strong>${escapeHtml(pair.second)}</strong></td><td class="deep-center">${pair.count}</td><td class="deep-center">${pair.customers.size}</td><td class="deep-money">${formatCurrency(pair.revenue)}</td><td>Gợi ý chào ${escapeHtml(pair.second)} khi khách mua ${escapeHtml(pair.first)}</td></tr>`).join('') : deepEmptyRow(5, 'Chưa đủ dữ liệu batchId có từ 2 sản phẩm để tìm cặp mua kèm.');
}

function deepRenderRepurchase(period) {
    const orders = deepBuildOrders(period.asOf);
    const byCustomer = new Map();
    orders.forEach(order => {
        if (!byCustomer.has(order.customerKey)) byCustomer.set(order.customerKey, []);
        byCustomer.get(order.customerKey).push(order);
    });
    const rows = [];
    byCustomer.forEach(customerOrders => {
        customerOrders.sort((a, b) => a.date - b.date);
        if (customerOrders.length < 2) return;
        const intervals = [];
        for (let i = 1; i < customerOrders.length; i += 1) intervals.push((customerOrders[i].date - customerOrders[i - 1].date) / 86400000);
        const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
        const last = customerOrders[customerOrders.length - 1];
        const predicted = new Date(last.date);
        predicted.setDate(predicted.getDate() + Math.max(1, Math.round(average)));
        rows.push({ customer: last.customer, customerKey: last.customerKey, count: customerOrders.length, average, last: last.date, predicted, daysToNext: Math.ceil((predicted - period.asOf) / 86400000) });
    });
    rows.sort((a, b) => a.daysToNext - b.daysToNext);
    const body = document.getElementById('deepRepurchaseTableBody');
    if (body) body.innerHTML = rows.length ? rows.slice(0, 40).map(item => `<tr><td><strong>${escapeHtml(deepCustomerLabel(item.customer, item.customerKey))}</strong></td><td class="deep-center">${item.count}</td><td class="deep-center">${item.average.toFixed(0)} ngày</td><td class="deep-center">${deepFormatDate(item.last)}</td><td class="deep-center">${deepFormatDate(item.predicted)}</td><td><span class="deep-analysis-status-badge" style="background:${item.daysToNext <= 0 ? '#dcfce7' : '#fef3c7'};color:${item.daysToNext <= 0 ? '#166534' : '#92400e'}">${item.daysToNext <= 0 ? 'Đến hạn chăm sóc' : `Còn ${item.daysToNext} ngày`}</span></td></tr>`).join('') : deepEmptyRow(6, 'Chưa có khách có từ 2 đợt mua để tính chu kỳ.');
}

function deepRenderHeatmap(period) {
    const transactions = deepReadTransactions(period.asOf).filter(item => item.amount > 0 && item.date >= period.start && item.date <= period.end);
    const weekdayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
    const weekday = weekdayNames.map(name => ({ name, revenue: 0, count: 0 }));
    const days = Array.from({ length: period.end.getDate() }, (_, index) => ({ day: index + 1, revenue: 0, count: 0 }));
    transactions.forEach(item => {
        const weekdayIndex = (item.date.getDay() + 6) % 7;
        weekday[weekdayIndex].revenue += item.amount;
        weekday[weekdayIndex].count += 1;
        const day = days[item.date.getDate() - 1];
        if (day) { day.revenue += item.amount; day.count += 1; }
    });
    function cells(items, label) {
        const max = Math.max(...items.map(item => item.revenue), 0);
        return items.map(item => {
            const opacity = max > 0 && item.revenue > 0 ? (0.12 + (item.revenue / max) * 0.78).toFixed(2) : '0.06';
            return `<div class="deep-heatmap-cell" title="${escapeHtml(`${label}${item.name || item.day}: ${formatCurrency(item.revenue)} - ${item.count} giao dịch`)}" style="background:rgba(139,92,246,${opacity});"><strong>${escapeHtml(item.name || `Ngày ${item.day}`)}</strong><small>${escapeHtml(deepFormatShortMoney(item.revenue))}</small></div>`;
        }).join('');
    }
    const weekdayEl = document.getElementById('deepWeekdayHeatmap');
    const dayEl = document.getElementById('deepDayOfMonthHeatmap');
    if (weekdayEl) weekdayEl.innerHTML = cells(weekday, '');
    if (dayEl) dayEl.innerHTML = cells(days, '');
}

function populateDeepMonthSelect() {
    const select = document.getElementById('deepAnalysisMonthSelect');
    if (!select) return;
    const currentValue = select.value || document.getElementById('reportMonthSelect')?.value || `${new Date().getFullYear()}-${new Date().getMonth() + 1}`;
    select.innerHTML = '';
    const now = new Date();
    for (let i = 0; i < 24; i += 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const value = `${date.getFullYear()}-${date.getMonth() + 1}`;
        const option = document.createElement('option');
        option.value = value;
        option.textContent = i === 0 ? `Tháng ${date.getMonth() + 1}/${date.getFullYear()} (Tháng này)` : `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
        select.appendChild(option);
    }
    if (Array.from(select.options).some(option => option.value === currentValue)) select.value = currentValue;
}

function showDeepAnalysis() {
    populateDeepMonthSelect();
    const period = deepGetPeriod();
    const transactions = deepReadTransactions(period.asOf);
    const current = deepMetricsForRange(transactions, period.start, period.end);
    const previous = deepMetricsForRange(transactions, period.previousStart, period.previousEnd);
    const yearAgo = deepMetricsForRange(transactions, period.yearAgoStart, period.yearAgoEnd);
    const daysInMonth = period.end.getDate();
    const daysElapsed = period.asOf < period.start ? 0 : Math.min(daysInMonth, Math.max(1, period.asOf.getDate()));
    const daysRemaining = Math.max(0, daysInMonth - daysElapsed);
    const forecast = daysElapsed > 0 ? (current.net / daysElapsed) * daysInMonth : 0;
    const gap = Math.max(0, DEEP_ANALYSIS_KPI_TARGET - current.net);
    const dailyNeed = daysRemaining > 0 ? gap / daysRemaining : 0;
    const progress = Math.max(0, Math.min(100, (current.net / DEEP_ANALYSIS_KPI_TARGET) * 100));
    deepAnalysisLastResult = { period, current, previous, yearAgo, forecast, gap, dailyNeed };

    deepSetText('deepAnalysisPeriodLabel', `${period.label} • Đến ${deepFormatDate(period.asOf)} • Chỉ đọc dữ liệu hiện có`);
    deepSetText('deepKpiRevenue', formatCurrency(current.net));
    deepSetText('deepKpiRevenueSub', `${daysElapsed}/${daysInMonth} ngày đã qua • Dương ${formatCurrency(current.gross)} • Âm ${formatCurrency(current.negative)}`);
    deepSetText('deepKpiForecast', formatCurrency(forecast));
    deepSetText('deepKpiForecastSub', `Tốc độ bình quân ${formatCurrency(daysElapsed ? current.net / daysElapsed : 0)}/ngày`);
    deepSetText('deepKpiGap', formatCurrency(gap));
    deepSetText('deepKpiGapSub', current.net >= DEEP_ANALYSIS_KPI_TARGET ? 'Đã đạt/vượt KPI' : `KPI ${formatCurrency(DEEP_ANALYSIS_KPI_TARGET)}`);
    deepSetText('deepKpiDailyNeed', formatCurrency(dailyNeed));
    deepSetText('deepKpiDailyNeedSub', `${daysRemaining} ngày còn lại`);
    const progressEl = document.getElementById('deepKpiProgress');
    if (progressEl) progressEl.style.width = `${progress.toFixed(1)}%`;
    const statusEl = document.getElementById('deepForecastStatus');
    if (statusEl) { statusEl.textContent = forecast >= DEEP_ANALYSIS_KPI_TARGET ? 'Có khả năng đạt KPI' : 'Cần tăng tốc'; statusEl.style.background = forecast >= DEEP_ANALYSIS_KPI_TARGET ? '#dcfce7' : '#fef3c7'; statusEl.style.color = forecast >= DEEP_ANALYSIS_KPI_TARGET ? '#166534' : '#92400e'; }
    const forecastInsight = document.getElementById('deepForecastInsight');
    if (forecastInsight) forecastInsight.innerHTML = forecast >= DEEP_ANALYSIS_KPI_TARGET ? `Theo tốc độ hiện tại, dự báo cuối tháng <strong>${formatCurrency(forecast)}</strong>, cao hơn KPI khoảng <strong>${formatCurrency(forecast - DEEP_ANALYSIS_KPI_TARGET)}</strong>.` : `Để đạt KPI 650M, từ nay cần bình quân <strong>${formatCurrency(dailyNeed)}/ngày</strong>. Dự báo hiện tại đang ${formatCurrency(Math.max(0, DEEP_ANALYSIS_KPI_TARGET - forecast))} dưới KPI.`;

    deepSetText('deepCompareCurrent', formatCurrency(current.net));
    deepSetText('deepCompareCurrentLabel', period.label);
    deepSetText('deepComparePrevious', formatCurrency(previous.net));
    deepSetText('deepComparePreviousDelta', `So với tháng trước: ${deepChangeText(current.net, previous.net)}`);
    deepSetText('deepCompareYearAgo', formatCurrency(yearAgo.net));
    deepSetText('deepCompareYearAgoDelta', `So với cùng kỳ: ${deepChangeText(current.net, yearAgo.net)}`);
    const seasonality = document.getElementById('deepSeasonalityInsight');
    if (seasonality) seasonality.innerHTML = `Đối chiếu mùa vụ: tháng đang xem ${current.net >= yearAgo.net ? 'cao hơn' : 'thấp hơn'} cùng kỳ năm trước và ${current.net >= previous.net ? 'cao hơn' : 'thấp hơn'} tháng trước. Cần ưu tiên so với <strong>cùng kỳ năm trước</strong> khi hai cách so sánh cho tín hiệu trái chiều.`;

    const rfm = deepBuildRfm(period);
    deepRenderRfm(rfm);
    deepRenderChurn(rfm);
    deepRenderPareto(rfm);
    deepRenderAov(period);
    deepRenderPairs(period);
    deepRenderRepurchase(period);
    deepRenderHeatmap(period);
}
