// ========== DATA STORE (API + LocalStorage hybrid) ==========
const STORAGE_KEY = 'mullen_expense_tracker';
const CAT_KEY = 'mullen_categories';

// API base URL — will be set after deploy
const API_BASE = localStorage.getItem('mullen_api_url') || '';

const DEFAULT_CATEGORIES = {
    expense: ['Makanan', 'Transport', 'Belanja', 'Hiburan', 'Kesehatan', 'Tagihan', 'Pendidikan', 'Lainnya'],
    income: ['Gaji', 'Freelance', 'Investasi', 'Bonus', 'Lainnya']
};

// ========== API CALLS ==========
async function apiGet(params = {}) {
    if (!API_BASE) return null;
    const qs = new URLSearchParams(params).toString();
    try {
        const res = await fetch(`${API_BASE}/api/transactions?${qs}`);
        return await res.json();
    } catch { return null; }
}

async function apiPost(data) {
    if (!API_BASE) return null;
    try {
        const res = await fetch(`${API_BASE}/api/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    } catch { return null; }
}

async function apiDelete(id) {
    if (!API_BASE) return null;
    try {
        const res = await fetch(`${API_BASE}/api/transactions/${id}`, { method: 'DELETE' });
        return await res.json();
    } catch { return null; }
}

// ========== LOCAL STORAGE ==========
function loadLocal() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
}

function saveLocal(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadCategories() {
    try {
        const c = JSON.parse(localStorage.getItem(CAT_KEY));
        return c || { ...DEFAULT_CATEGORIES };
    } catch { return { ...DEFAULT_CATEGORIES }; }
}

function saveCategories(cats) {
    localStorage.setItem(CAT_KEY, JSON.stringify(cats));
}

// ========== SYNC ==========
let useAPI = false;

async function trySync() {
    const url = localStorage.getItem('mullen_api_url');
    if (!url) return false;
    try {
        const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3000) });
        if (res.ok) { useAPI = true; return true; }
    } catch {}
    return false;
}

// Load from GitHub Pages raw JSON
async function loadFromGitHub() {
    try {
        // Try to load transactions.json from the same origin (GitHub Pages)
        const res = await fetch('./transactions.json', { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.transactions)) {
                return data.transactions;
            }
        }
    } catch {}
    return null;
}

async function loadData() {
    // 1. Try API first
    if (useAPI || await trySync()) {
        const data = await apiGet();
        if (data && Array.isArray(data)) {
            saveLocal(data);
            return data;
        }
    }

    // 2. Try loading from GitHub Pages JSON
    const githubData = await loadFromGitHub();
    if (githubData && githubData.length > 0) {
        // Merge with local data (avoid duplicates by id)
        const local = loadLocal();
        const localIds = new Set(local.map(t => t.id));
        const newItems = githubData.filter(t => !localIds.has(t.id));
        if (newItems.length > 0) {
            const merged = [...local, ...newItems];
            saveLocal(merged);
            return merged;
        }
        // If local is empty but GitHub has data, use GitHub data
        if (local.length === 0) {
            saveLocal(githubData);
            return githubData;
        }
    }

    // 3. Fallback to local only
    return loadLocal();
}

async function saveData(tx) {
    // Always save locally
    const local = loadLocal();
    local.push(tx);
    saveLocal(local);

    // Also save to API if available
    if (useAPI) {
        const result = await apiPost(tx);
        if (result) return result;
    }
    return tx;
}

async function removeData(id) {
    // Remove locally
    const local = loadLocal().filter(t => t.id !== id);
    saveLocal(local);

    // Remove from API if available
    if (useAPI) await apiDelete(id);
}

// ========== HELPERS ==========
function formatRp(n) {
    return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function formatDate(str) {
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatShortDate(str) {
    const d = new Date(str + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function getMonthOptions() {
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const opts = [];
    const data = loadLocal();
    const monthSet = new Set(data.map(t => t.date.substring(0, 7)));
    monthSet.forEach(m => opts.push(m));
    opts.sort().reverse();
    return opts.map(m => {
        const [y, mo] = m.split('-');
        return { value: m, label: `${months[parseInt(mo)-1]} ${y}` };
    });
}

// ========== TABS ==========
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
        if (tab.dataset.tab === 'dashboard') renderDashboard();
        if (tab.dataset.tab === 'history') renderHistory();
        if (tab.dataset.tab === 'categories') renderCategories();
        if (tab.dataset.tab === 'add') populateCategorySelect();
    });
});

// ========== DASHBOARD ==========
async function renderDashboard() {
    const data = await loadData();
    const today = todayStr();
    const todayTx = data.filter(t => t.date === today);

    const todayIncome = todayTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const todayExpense = todayTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalIncome = data.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = data.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    document.getElementById('todayIncome').textContent = formatRp(todayIncome);
    document.getElementById('todayExpense').textContent = formatRp(todayExpense);
    document.getElementById('todayBalance').textContent = formatRp(todayIncome - todayExpense);
    document.getElementById('totalBalance').textContent = formatRp(totalIncome - totalExpense);

    renderCategoryChart(todayTx);

    const recentList = document.getElementById('recentTransactions');
    const recent = data.slice(-5).reverse();
    if (recent.length === 0) {
        recentList.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>Belum ada transaksi</p></div>';
    } else {
        recentList.innerHTML = recent.map(t => `
            <div class="transaction-item">
                <span class="t-icon">${t.type === 'income' ? '📈' : '📉'}</span>
                <div class="t-info">
                    <div class="t-desc">${t.description}</div>
                    <div class="t-meta">${t.category} · ${formatShortDate(t.date)}</div>
                </div>
                <span class="t-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatRp(t.amount)}</span>
            </div>
        `).join('');
    }

    // Show connection status
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
        if (useAPI) {
            statusEl.textContent = '☁️ Connected to API';
            statusEl.className = 'connection-status online';
        } else {
            statusEl.textContent = '📱 Local Mode';
            statusEl.className = 'connection-status local';
        }
    }
}

function renderCategoryChart(todayTx) {
    const container = document.getElementById('categoryChart');
    const expenses = todayTx.filter(t => t.type === 'expense');
    if (expenses.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Belum ada pengeluaran hari ini</p></div>';
        return;
    }

    const catTotals = {};
    expenses.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
    const maxVal = Math.max(...Object.values(catTotals));
    const colors = ['#6c63ff', '#ff6584', '#00c853', '#ffd740', '#ff9800', '#e040fb', '#00bcd4', '#ff5252'];

    container.innerHTML = Object.entries(catTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, total], i) => {
            const pct = maxVal > 0 ? (total / maxVal) * 100 : 0;
            return `
                <div class="chart-bar-group">
                    <span class="chart-label">${cat}</span>
                    <div class="chart-bar-bg">
                        <div class="chart-bar" style="width:${Math.max(pct, 8)}%;background:${colors[i % colors.length]}">
                        </div>
                    </div>
                    <span class="chart-bar-value">${formatRp(total)}</span>
                </div>
            `;
        }).join('');
}

// ========== ADD TRANSACTION ==========
let currentType = 'expense';

function setType(type) {
    currentType = type;
    document.querySelectorAll('.toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.type === type);
    });
    populateCategorySelect();
}

function populateCategorySelect() {
    const cats = loadCategories();
    const select = document.getElementById('kategori');
    const list = cats[currentType] || [];
    select.innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join('');
}

// Upload handling
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const previewImage = document.getElementById('previewImage');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const ocrResult = document.getElementById('ocrResult');

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

function handleFile(file) {
    if (file.size > 5 * 1024 * 1024) {
        showToast('Ukuran file maksimal 5MB!', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewImage.style.display = 'block';
        uploadPlaceholder.style.display = 'none';
        ocrResult.classList.remove('hidden');
        document.getElementById('ocrText').value = '';
    };
    reader.readAsDataURL(file);
}

function parseOcrResult() {
    const text = document.getElementById('ocrText').value.trim();
    if (!text) {
        showToast('Tulis dulu hasil baca struknya!', 'error');
        return;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let total = 0;

    const totalPatterns = [
        /total\s*[:=]?\s*R?p?([\d.,]+)/i,
        /grand\s*total\s*[:=]?\s*R?p?([\d.,]+)/i,
        /bayar\s*[:=]?\s*R?p?([\d.,]+)/i,
        /TOTAL\s*R?p?([\d.,]+)/,
        /dibayar\s*konsumen\s*[:=]?\s*R?p?([\d.,]+)/i,
    ];

    for (const line of lines) {
        for (const pat of totalPatterns) {
            const m = line.match(pat);
            if (m) {
                total = parseNumber(m[1]);
                break;
            }
        }
    }

    if (total === 0) {
        const numbers = [];
        for (const line of lines) {
            const m = line.match(/([\d.,]{4,})/g);
            if (m) {
                m.forEach(n => {
                    const val = parseNumber(n);
                    if (val > 100) numbers.push(val);
                });
            }
        }
        if (numbers.length > 0) total = Math.max(...numbers);
    }

    document.getElementById('tanggal').value = todayStr();
    if (total > 0) document.getElementById('jumlah').value = total;

    const cats = loadCategories();
    const expenseCats = cats.expense || [];
    const textLower = text.toLowerCase();
    const catMap = {
        'makanan': ['restoran', 'makan', 'food', 'cafe', 'kopi', 'warung', 'indomaret', 'alfamart', 'minuman', 'nasi', 'mie', 'sate', 'bakso'],
        'transport': ['bensin', 'bbm', 'ojek', 'taxi', 'grab', 'gojek', 'parkir', 'tol', 'pertamina', 'spbu', 'shell', 'bp'],
        'belanja': ['indomaret', 'alfamart', 'supermarket', 'mall', 'tokopedia', 'shopee', 'lazada', 'belanja'],
        'hiburan': ['bioskop', 'netflix', 'spotify', 'game', 'hiburan', 'nonton'],
        'kesehatan': ['apotek', 'klinik', 'rumah sakit', 'dokter', 'obat', 'kesehatan'],
        'tagihan': ['listrik', 'air', 'pulsa', 'token', 'pln', 'pdam', 'internet', 'tagihan'],
        'pendidikan': ['buku', 'kursus', 'sekolah', 'kuliah', 'pendidikan', 'edukasi']
    };

    let matchedCat = '';
    for (const [cat, keywords] of Object.entries(catMap)) {
        if (keywords.some(kw => textLower.includes(kw)) && expenseCats.includes(cat.charAt(0).toUpperCase() + cat.slice(1))) {
            matchedCat = cat.charAt(0).toUpperCase() + cat.slice(1);
            break;
        }
    }

    if (matchedCat) document.getElementById('kategori').value = matchedCat;
    if (lines.length > 0) document.getElementById('deskripsi').value = lines[0].substring(0, 60);

    showToast('✅ Struk berhasil di-parse! Silakan periksa & lengkapi data.', 'success');
}

function parseNumber(str) {
    str = str.replace(/[^\d.,]/g, '');
    if (str.includes(',')) str = str.replace(/\./g, '').replace(',', '.');
    return parseInt(str, 10) || 0;
}

// Form submit
document.getElementById('transactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tx = {
        id: Date.now(),
        type: currentType,
        date: document.getElementById('tanggal').value,
        amount: parseInt(document.getElementById('jumlah').value) || 0,
        category: document.getElementById('kategori').value,
        description: document.getElementById('deskripsi').value.trim(),
        createdAt: new Date().toISOString()
    };

    await saveData(tx);
    e.target.reset();
    document.getElementById('tanggal').value = todayStr();
    setType('expense');
    showToast('✅ Transaksi berhasil disimpan!', 'success');
    renderDashboard();
});

// ========== HISTORY ==========
async function renderHistory() {
    const data = await loadData();
    const list = document.getElementById('historyList');
    const monthFilter = document.getElementById('filterMonth').value;
    const typeFilter = document.getElementById('filterType').value;

    const months = getMonthOptions();
    const currentMonth = document.getElementById('filterMonth').value;
    document.getElementById('filterMonth').innerHTML =
        '<option value="">Semua Bulan</option>' +
        months.map(m => `<option value="${m.value}" ${m.value === currentMonth ? 'selected' : ''}>${m.label}</option>`).join('');

    let filtered = data.filter(t => {
        if (monthFilter && !t.date.startsWith(monthFilter)) return false;
        if (typeFilter && t.type !== typeFilter) return false;
        return true;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>Tidak ada transaksi</p></div>';
        return;
    }

    const grouped = {};
    filtered.forEach(t => {
        if (!grouped[t.date]) grouped[t.date] = [];
        grouped[t.date].push(t);
    });

    const sortedDates = Object.keys(grouped).sort().reverse();

    list.innerHTML = sortedDates.map(date => {
        const txs = grouped[date];
        const dayIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const dayExpense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

        return `
            <div class="history-date-group">
                <div class="history-date-header">
                    <span>📅 ${formatDate(date)}</span>
                    <div class="history-date-summary">
                        ${dayIncome > 0 ? `<span class="inc">▲ ${formatRp(dayIncome)}</span>` : ''}
                        ${dayExpense > 0 ? `<span class="exp">▼ ${formatRp(dayExpense)}</span>` : ''}
                    </div>
                </div>
                ${txs.map(t => `
                    <div class="transaction-item" style="border-radius:0;border-bottom:1px solid var(--border);">
                        <span class="t-icon">${t.type === 'income' ? '📈' : '📉'}</span>
                        <div class="t-info">
                            <div class="t-desc">${t.description}</div>
                            <div class="t-meta">${t.category}</div>
                        </div>
                        <span class="t-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatRp(t.amount)}</span>
                        <button class="btn btn-sm" onclick="deleteTransaction(${t.id})">🗑️</button>
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');
}

async function deleteTransaction(id) {
    if (!confirm('Hapus transaksi ini?')) return;
    await removeData(id);
    await renderHistory();
    showToast('🗑️ Transaksi dihapus', 'success');
}

async function clearAllData() {
    if (!confirm('Hapus SEMUA data transaksi? Tindakan ini tidak bisa dibatalkan!')) return;
    localStorage.removeItem(STORAGE_KEY);
    await renderHistory();
    await renderDashboard();
    showToast('🗑️ Semua data dihapus', 'success');
}

document.getElementById('filterMonth').addEventListener('change', renderHistory);
document.getElementById('filterType').addEventListener('change', renderHistory);

// ========== CATEGORIES ==========
function renderCategories() {
    const cats = loadCategories();

    document.getElementById('expenseCategories').innerHTML = (cats.expense || []).map(c => `
        <li>
            <span>📉 ${c}</span>
            <button class="btn btn-sm" onclick="deleteCategory('expense', '${c}')">🗑️</button>
        </li>
    `).join('');

    document.getElementById('incomeCategories').innerHTML = (cats.income || []).map(c => `
        <li>
            <span>📈 ${c}</span>
            <button class="btn btn-sm" onclick="deleteCategory('income', '${c}')">🗑️</button>
        </li>
    `).join('');
}

function addCategory() {
    const name = document.getElementById('newCategoryName').value.trim();
    const type = document.getElementById('newCategoryType').value;
    if (!name) { showToast('Tulis nama kategori dulu!', 'error'); return; }

    const cats = loadCategories();
    if (cats[type].includes(name)) { showToast('Kategori sudah ada!', 'error'); return; }

    cats[type].push(name);
    saveCategories(cats);
    document.getElementById('newCategoryName').value = '';
    renderCategories();
    populateCategorySelect();
    showToast(`✅ Kategori "${name}" ditambahkan`, 'success');
}

function deleteCategory(type, name) {
    const cats = loadCategories();
    cats[type] = cats[type].filter(c => c !== name);
    saveCategories(cats);
    renderCategories();
    populateCategorySelect();
    showToast(`🗑️ Kategori "${name}" dihapus`, 'success');
}

// ========== TOAST ==========
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ========== INIT ==========
document.getElementById('currentDate').textContent = formatDate(todayStr());
document.getElementById('tanggal').value = todayStr();
setType('expense');
initApp();

async function initApp() {
    await loadData();        // wait for data to load
    renderDashboard();       // now render with populated data
}
