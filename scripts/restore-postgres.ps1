param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$Database = "sgsst",
  [string]$User = "postgres",
  [string]$Container = "sgsst_postgres"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
  throw "No existe el archivo de backup: $BackupFile"
}

$fileName = Split-Path $BackupFile -Leaf
$containerPath = "/tmp/${fileName}"

docker cp $BackupFile "${Container}:${containerPath}"
docker exec $Container dropdb --username=$User --if-exists $Database
docker exec $Container createdb --username=$User $Database
docker exec $Container pg_restore --username=$User --dbname=$Database --clean --if-exists --no-owner --no-privileges $containerPath
docker exec $Container rm -f $containerPath

Write-Host "Restauracion completada desde: $BackupFile"
