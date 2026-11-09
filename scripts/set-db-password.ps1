# Store a Supabase database password in .env.<profile>.local without showing or logging it.
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('testdb', 'demo', 'live')]
  [string]$Profile
)

$ErrorActionPreference = 'Stop'
$file = Join-Path (Get-Location) ".env.$Profile.local"
if (-not (Test-Path -LiteralPath $file)) {
  throw ".env.$Profile.local was not found. Run this from the project folder."
}

$secure = Read-Host "Database password for homeish-$Profile (hidden)" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
if ([string]::IsNullOrEmpty($plain)) {
  throw 'No password entered; nothing changed.'
}

$encoded = [Uri]::EscapeDataString($plain)
$plain = $null
$pattern = '^(SUPABASE_DB_URL=postgresql://postgres\.[a-z0-9]+:)[^@]*(@.+)$'
$found = $false
$lines = Get-Content -LiteralPath $file | ForEach-Object {
  if ($_ -match $pattern) {
    $found = $true
    $Matches[1] + $encoded + $Matches[2]
  } else {
    $_
  }
}
$encoded = $null
if (-not $found) {
  throw "SUPABASE_DB_URL was not found in .env.$Profile.local; nothing changed."
}

[IO.File]::WriteAllText($file, (($lines -join "`n") + "`n"))
Write-Host "Password saved to .env.$Profile.local."
