// Simple JSON-based database API
// File: /home/ubuntu/expense-tracker/api.js
// Run: node api.js

const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'transactions.json');
const PORT = 3000;

// Load or init database
function loadDB() {
    try {
        if (!fs.existsSync(DB_FILE)) return { transactions: [] };
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch { return { transactions: [] }; }
}

function saveDB(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function parseJSON(str) {
    try { return JSON.parse(str); } catch { return null; }
}

const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // GET /api/transactions - list all
    if (req.method === 'GET' && url.pathname === '/api/transactions') {
        const db = loadDB();
        const { month, type } = url.searchParams;
        let txs = db.transactions;
        if (month) txs = txs.filter(t => t.date.startsWith(month));
        if (type) txs = txs.filter(t => t.type === type);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(txs));
        return;
    }

    // POST /api/transactions - add new
    if (req.method === 'POST' && url.pathname === '/api/transactions') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const data = parseJSON(body);
            if (!data || !data.type || !data.amount || !data.category) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid data' }));
                return;
            }
            const db = loadDB();
            const tx = {
                id: Date.now(),
                type: data.type,
                date: data.date || new Date().toISOString().split('T')[0],
                amount: parseInt(data.amount) || 0,
                category: data.category,
                description: data.description || '',
                createdAt: new Date().toISOString()
            };
            db.transactions.push(tx);
            saveDB(db);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(tx));
        });
        return;
    }

    // DELETE /api/transactions/:id
    const delMatch = url.pathname.match(/^\/api\/transactions\/(\d+)$/);
    if (req.method === 'DELETE' && delMatch) {
        const id = parseInt(delMatch[1]);
        const db = loadDB();
        db.transactions = db.transactions.filter(t => t.id !== id);
        saveDB(db);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`🚀 Mullen API running on http://localhost:${PORT}`);
    console.log(`📊 Database: ${DB_FILE}`);
});
