param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$Database = "sgsst",
  [string]$User = "postgres",
  [string]$Container = "sgsst_postgres",
  [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"

function Invoke-DockerCommand {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo el comando docker: $($Arguments -join ' ')"
  }
}

if (-not (Test-Path $BackupFile)) {
  throw "No existe el archivo de backup: $BackupFile"
}
if (-not $ConfirmRestore) {
  throw "La restauracion elimina y recrea la base. Reintente con -ConfirmRestore en un ambiente controlado."
}

$fileName = Split-Path $BackupFile -Leaf
$containerPath = "/tmp/${fileName}"

Invoke-DockerCommand cp $BackupFile "${Container}:${containerPath}"
try {
  Invoke-DockerCommand exec $Container dropdb --username=$User --if-exists $Database
  Invoke-DockerCommand exec $Container createdb --username=$User $Database
  Invoke-DockerCommand exec $Container pg_restore --username=$User --dbname=$Database --clean --if-exists --no-owner --no-privileges $containerPath
}
finally {
  docker exec $Container rm -f $containerPath 2>$null
}

Write-Host "Restauracion completada desde: $BackupFile"
