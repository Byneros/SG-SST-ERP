param(
  [string]$OutputDir = "backups/postgres",
  [string]$Database = "sgsst",
  [string]$User = "postgres",
  [string]$Container = "sgsst_postgres"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$fileName = "${Database}_${timestamp}.dump"
$containerPath = "/tmp/${fileName}"
$hostPath = Join-Path $OutputDir $fileName

docker exec $Container pg_dump --username=$User --dbname=$Database --format=custom --no-owner --no-privileges --file=$containerPath
docker cp "${Container}:${containerPath}" $hostPath
docker exec $Container rm -f $containerPath

Write-Host "Backup creado: $hostPath"
