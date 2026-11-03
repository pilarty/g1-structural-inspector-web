# Sube la version nueva del sitio a S3 y limpia la cache de CloudFront.
# Uso: abrir PowerShell en Documents\g1-structural-inspector-web y correr:  .\subir_sitio.ps1
# Requiere el AWS CLI configurado (aws configure) con la misma cuenta del sitio.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$Bucket = "s3://humanoid-inspector-web-834257582282"
$Distribucion = "EG38IOXP6RDDO"
$Respaldo = "respaldo-sitio-" + (Get-Date -Format "yyyyMMdd-HHmm")

# 1. Respaldo de lo que esta publicado hoy (por si hay que volver atras)
Write-Host "1/3 Guardando respaldo del sitio actual en $Respaldo ..."
aws s3 sync $Bucket ".\$Respaldo"

# 2. Subir el sitio (sin git, el script, los respaldos ni los archivos que ya no se usan)
Write-Host "2/3 Subiendo el sitio ..."
aws s3 sync "." $Bucket `
  --exclude ".git/*" --exclude ".github/*" --exclude ".gitignore" --exclude "subir_sitio.ps1" --exclude "respaldo-sitio-*" `
  --exclude "callback.js" --exclude "favicon.svg" --exclude "robot.jpg" --exclude "danos/LEEME.txt" `
  --cache-control "max-age=300"

# 3. Limpiar la cache de CloudFront para que se vea la version nueva
Write-Host "3/3 Limpiando la cache de CloudFront ..."
aws cloudfront create-invalidation --distribution-id $Distribucion --paths "/*" | Out-Null

Write-Host ""
Write-Host "Listo. En 2 o 3 minutos se ve la version nueva en https://g1structuralinspector.com"
Write-Host "Para volver atras: aws s3 sync .\$Respaldo $Bucket --delete"
