$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PgCtl = Join-Path $Root 'tools\pgsql\bin\pg_ctl.exe'
$DataDir = Join-Path $Root 'tools\pgdata'

& $PgCtl -D $DataDir stop -m fast
