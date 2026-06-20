#!/bin/bash
# Deploy Expense Tracker to GitHub Pages
# Usage: ./deploy.sh <github-username> <token>

set -e

USERNAME=$1
TOKEN=$2
REPO="expense-tracker"

if [ -z "$USERNAME" ] || [ -z "$TOKEN" ]; then
    echo "Usage: ./deploy.sh <github-username> <token>"
    echo ""
    echo "Cara dapat token:"
    echo "1. Buka https://github.com/settings/tokens/new"
    echo "2. Note: 'gh-pages deploy'"
    echo "3. Scope: centang 'repo'"
    echo "4. Generate & copy token"
    exit 1
fi

echo "🚀 Deploying to GitHub Pages..."

# Configure git
git config --global user.email "$USERNAME@users.noreply.github.com"
git config --global user.name "$USERNAME"

# Create repo via API
echo "📦 Creating repository..."
curl -s -X POST \
    -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/user/repos \
    -d "{\"name\":\"$REPO\",\"description\":\"💰 Expense Tracker - Pencatat Pengeluaran & Pemasukan\",\"public\":true}" \
    | head -1

# Initialize git in project dir
cd /home/ubuntu/expense-tracker
rm -rf .git
git init
git add index.html style.css app.js README.md
git commit -m "🎉 Initial commit - Expense Tracker"

# Push to GitHub
git remote add origin https://$USERNAME:$TOKEN@github.com/$USERNAME/$REPO.git
git branch -M main
git push -u origin main --force

# Enable GitHub Pages
echo "🌐 Enabling GitHub Pages..."
curl -s -X POST \
    -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/$USERNAME/$REPO/pages" \
    -d "{\"source\":{\"branch\":\"main\",\"path\":\"/\"}}" \
    | head -1

echo ""
echo "✅ Deploy selesai!"
echo "🌐 Website: https://$USERNAME.github.io/$REPO/"
echo ""
echo "📌 Catatan: Butuh waktu ~1-2 menit buat GitHub Pages aktif"
