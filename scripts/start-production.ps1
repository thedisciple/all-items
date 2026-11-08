param(
  [string]$ConfigPath,
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $ConfigPath) { throw 'Pass an explicit -ConfigPath outside the repository.' }
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$config = (Resolve-Path -LiteralPath $ConfigPath).Path
$inside = $repository.TrimEnd('\') + '\'
if ($config.StartsWith($inside,[StringComparison]::OrdinalIgnoreCase)) { throw 'Runtime configuration must be outside the repository.' }

$required = @('ALL_ITEMS_DOMAIN','ALL_ITEMS_ORIGIN','ALL_ITEMS_PROXY_MODE','ALL_ITEMS_PROXY_SECRET','ALL_ITEMS_DATA_DIR')
$allowed = $required + @('ALL_ITEMS_TELEGRAM_CLIENT_ID','ALL_ITEMS_TELEGRAM_CLIENT_SECRET')
$values = @{}
foreach ($line in (Get-Content -LiteralPath $config)) {
  if ($line.Trim().Length -eq 0 -or $line.TrimStart().StartsWith('#')) { continue }
  if ($line -notmatch '^([A-Z_]+)=(.*)$' -or $allowed -cnotcontains $Matches[1] -or $values.ContainsKey($Matches[1])) { throw 'Invalid or duplicate runtime setting.' }
  $values[$Matches[1]] = $Matches[2]
}
foreach ($name in $required) { if (-not $values.ContainsKey($name) -or -not $values[$name]) { throw "Missing runtime setting: $name" } }
if ($values['ALL_ITEMS_PROXY_MODE'] -cne 'https-proxy') { throw 'Only the explicit HTTPS proxy mode is accepted by this launcher.' }
if ($values['ALL_ITEMS_DOMAIN'].Length -gt 253 -or $values['ALL_ITEMS_DOMAIN'] -cnotmatch '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$') { throw 'Use an exact ASCII DNS name.' }
if ($values['ALL_ITEMS_ORIGIN'] -cne ('https://' + $values['ALL_ITEMS_DOMAIN'])) { throw 'Origin must exactly match the HTTPS domain.' }
if ($values['ALL_ITEMS_PROXY_SECRET'] -cnotmatch '^[A-Za-z0-9_-]{43}$') { throw 'Proxy secret must be 32 random bytes in base64url form.' }
if ($values['ALL_ITEMS_DATA_DIR'] -cnotmatch '^[A-Za-z]:\\') { throw 'Data directory must be an absolute local Windows drive path.' }
$dataDirectory = [IO.Path]::GetFullPath($values['ALL_ITEMS_DATA_DIR'])
if (-not (Test-Path -LiteralPath $dataDirectory -PathType Container)) { throw 'Data directory must already exist.' }
if ($dataDirectory.StartsWith($inside,[StringComparison]::OrdinalIgnoreCase) -or $dataDirectory -eq $repository) { throw 'Data directory must be outside the repository.' }

foreach ($name in $allowed) {
  if ($values.ContainsKey($name)) { [Environment]::SetEnvironmentVariable($name,$values[$name],'Process') }
  else { [Environment]::SetEnvironmentVariable($name,$null,'Process') }
}
Remove-Item Env:ALL_ITEMS_NEXT_DIST -ErrorAction SilentlyContinue
Push-Location $repository
try {
  & npm.cmd run config:check
  if ($LASTEXITCODE -ne 0) { throw 'Runtime preflight failed.' }
  if ($ValidateOnly) { Write-Output 'Validated private deployment configuration without starting the app.'; return }
  & npm.cmd start
  if ($LASTEXITCODE -ne 0) { throw 'Production app exited with an error.' }
} finally { Pop-Location }
