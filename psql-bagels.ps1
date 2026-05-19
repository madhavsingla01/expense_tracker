$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Psql = Join-Path $Root 'tools\pgsql\bin\psql.exe'

& $Psql -h 127.0.0.1 -U postgres -d bagels @Args
