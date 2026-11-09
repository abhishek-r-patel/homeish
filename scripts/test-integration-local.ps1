# Run database integration tests against a throwaway local PostgreSQL 17 server (no Docker needed).
# Usage: npm run test:integration:local
# Needs PostgreSQL server tools (initdb, pg_ctl, pg_isready). Set PG_BIN to their folder
# or put it on PATH. The server lives in a temporary folder and is deleted afterwards.
$ErrorActionPreference = 'Stop'

$bin = $env:PG_BIN
if (-not $bin) {
  $initdb = Get-Command initdb.exe -ErrorAction SilentlyContinue
  if (-not $initdb) {
    Write-Error 'PostgreSQL server tools were not found. Set PG_BIN to the PostgreSQL bin folder.'
  }
  $bin = Split-Path $initdb.Source
}
foreach ($tool in 'initdb.exe', 'pg_ctl.exe', 'pg_isready.exe') {
  if (-not (Test-Path (Join-Path $bin $tool))) {
    Write-Error "$tool was not found in $bin."
  }
}

$port = 54329
$data = Join-Path ([IO.Path]::GetTempPath()) "homeish-it-$([guid]::NewGuid().ToString('N'))"
$pgCtl = Join-Path $bin 'pg_ctl.exe'
$exitCode = 1
try {
  & (Join-Path $bin 'initdb.exe') -D $data -U supabase_admin --auth=trust -E UTF8 --no-locale *> $null
  if ($LASTEXITCODE -ne 0) { Write-Error 'initdb failed.' }

  # Start without waiting on the server's output handles, which stay open while it runs.
  Start-Process -FilePath $pgCtl -WindowStyle Hidden -ArgumentList @(
    '-D', "`"$data`"", '-l', "`"$data\server.log`"",
    '-o', "`"-p $port -c listen_addresses=127.0.0.1`"", 'start'
  ) | Out-Null
  $ready = $false
  for ($i = 0; $i -lt 60 -and -not $ready; $i++) {
    Start-Sleep -Milliseconds 500
    & (Join-Path $bin 'pg_isready.exe') -h 127.0.0.1 -p $port *> $null
    $ready = $LASTEXITCODE -eq 0
  }
  if (-not $ready) { Write-Error 'The temporary PostgreSQL server did not start.' }

  $env:INTEGRATION_DATABASE_URL = "postgres://supabase_admin@127.0.0.1:$port/postgres"
  npx vitest run --config vitest.integration.config.ts @args
  $exitCode = $LASTEXITCODE
}
finally {
  if (Test-Path (Join-Path $data 'postmaster.pid')) {
    & $pgCtl -D $data -m fast -w stop *> $null
  }
  Remove-Item -Recurse -Force $data -ErrorAction SilentlyContinue
}
exit $exitCode
