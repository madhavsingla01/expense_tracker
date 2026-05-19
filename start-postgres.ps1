$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PgCtl = Join-Path $Root 'tools\pgsql\bin\pg_ctl.exe'
$PgReady = Join-Path $Root 'tools\pgsql\bin\pg_isready.exe'
$DataDir = Join-Path $Root 'tools\pgdata'
$LogFile = Join-Path $DataDir 'postgres.log'

$ready = & $PgReady -h 127.0.0.1 -p 5432 -U postgres 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Output $ready
  exit 0
}

& $PgCtl -D $DataDir -l $LogFile start
& $PgReady -h 127.0.0.1 -p 5432 -U postgres
