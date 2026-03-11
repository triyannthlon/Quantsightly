Write-Host "🧼 Nettoyage..."
rm -r -fo node_modules
rm -fo pnpm-lock.yaml
rm -r -fo .next

Write-Host "🔐 Approbation des scripts..."
pnpm approve-builds

Write-Host "📦 Réinstallation..."
pnpm install

Write-Host "⬆️ Mise à jour..."
pnpm update --latest

Write-Host "🔐 Approbation des scripts..."
pnpm approve-builds

Write-Host "⬆️ Installation des dépendances du projet..."
pnpm install

Write-Host "🛠️ Prisma generate..."
pnpm prisma generate

