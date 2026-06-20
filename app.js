// ========== DATA STORE ==========
const STORAGE_KEY = 'mullen_expense_tracker';
const CAT_KEY = 'mullen_categories';

const DEFAULT_CATEGORIES = {
    expense: ['Makanan', 'Transport', 'Belanja', 'Hiburan', 'Kesehatan', 'Tagihan', 'Pendidikan', 'Lainnya'],
    income: ['Gaji', 'Freelance', 'Investasi', 'Bonus', 'Lainnya']
};

function loadData() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch { return []; }
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadCategories() {
    try {
        const c = JSON.parse(localStorage.getItem(CAT_KEY));
        return c || DEFAULT_CATEGORIES;
    } catch { return { ...DEFAULT_CATEGORIES }; }
}

function saveCategories(cats) {
    localStorage.setItem(CAT_KEY, JSON.stringify(cats));
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
    const data = loadData();
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
function renderDashboard() {
    const data = loadData();
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

    // Category chart
    renderCategoryChart(todayTx);

    // Recent transactions
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
    const items = [];

    // Try to find total
    const totalPatterns = [
        /total\s*[:=]?\s*R?p?([\d.,]+)/i,
        /grand\s*total\s*[:=]?\s*R?p?([\d.,]+)/i,
        /bayar\s*[:=]?\s*R?p?([\d.,]+)/i,
        /TOTAL\s*R?p?([\d.,]+)/,
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

    // If no total found, sum all numbers
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
        if (numbers.length > 0) {
            total = Math.max(...numbers);
        }
    }

    // Auto-fill form
    document.getElementById('tanggal').value = todayStr();
    if (total > 0) {
        document.getElementById('jumlah').value = total;
    }

    // Try to guess category from text
    const cats = loadCategories();
    const expenseCats = cats.expense || [];
    const textLower = text.toLowerCase();
    const catMap = {
        'makanan': ['restoran', 'makan', 'food', 'cafe', 'kopi', 'warung', 'indomaret', 'alfamart', 'minuman', 'nasi', 'mie', 'sate', 'bakso'],
        'transport': ['bensin', 'bbm', 'ojek', 'taxi', 'grab', 'gojek', 'parkir', 'tol', 'bri', 'bca', 'transfer'],
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

    if (matchedCat) {
        document.getElementById('kategori').value = matchedCat;
    }

    // Use first line as description
    if (lines.length > 0) {
        document.getElementById('deskripsi').value = lines[0].substring(0, 60);
    }

    showToast('✅ Struk berhasil di-parse! Silakan periksa & lengkapi data.', 'success');
}

function parseNumber(str) {
    str = str.replace(/[^\d.,]/g, '');
    if (str.includes(',')) {
        str = str.replace(/\./g, '').replace(',', '.');
    }
    return parseInt(str, 10) || 0;
}

// Form submit
document.getElementById('transactionForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = loadData();
    const tx = {
        id: Date.now(),
        type: currentType,
        date: document.getElementById('tanggal').value,
        amount: parseInt(document.getElementById('jumlah').value) || 0,
        category: document.getElementById('kategori').value,
        description: document.getElementById('deskripsi').value.trim(),
        createdAt: new Date().toISOString()
    };
    data.push(tx);
    saveData(data);
    e.target.reset();
    document.getElementById('tanggal').value = todayStr();
    setType('expense');
    showToast('✅ Transaksi berhasil disimpan!', 'success');
    renderDashboard();
});

// ========== HISTORY ==========
function renderHistory() {
    const data = loadData();
    const list = document.getElementById('historyList');
    const monthFilter = document.getElementById('filterMonth').value;
    const typeFilter = document.getElementById('filterType').value;

    // Populate month filter
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

    // Group by date
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

function deleteTransaction(id) {
    if (!confirm('Hapus transaksi ini?')) return;
    let data = loadData();
    data = data.filter(t => t.id !== id);
    saveData(data);
    renderHistory();
    showToast('🗑️ Transaksi dihapus', 'success');
}

function clearAllData() {
    if (!confirm('Hapus SEMUA data transaksi? Tindakan ini tidak bisa dibatalkan!')) return;
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
    renderDashboard();
    showToast('🗑️ Semua data dihapus', 'success');
}

// Filter listeners
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
renderDashboard();
