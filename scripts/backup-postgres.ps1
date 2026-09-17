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

try {
  docker exec $Container pg_dump --username=$User --dbname=$Database --format=custom --no-owner --no-privileges --file=$containerPath
  if ($LASTEXITCODE -ne 0) { throw "pg_dump fallo con codigo $LASTEXITCODE" }

  docker exec $Container pg_restore --list $containerPath | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "El backup generado no paso la validacion de pg_restore" }

  docker cp "${Container}:${containerPath}" $hostPath
  if ($LASTEXITCODE -ne 0) { throw "No fue posible copiar el backup al host" }
}
finally {
  docker exec $Container rm -f $containerPath 2>$null
}

Write-Host "Backup creado: $hostPath"
