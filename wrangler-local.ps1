$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeDir = Get-ChildItem -Path (Join-Path $ProjectRoot ".tools") -Directory -Filter "node-*-win-x64" |
  Sort-Object Name -Descending |
  Select-Object -First 1

if (-not $NodeDir) {
  Write-Error "Portable Node was not found in $ProjectRoot\.tools. Run the Wrangler install step again first."
  exit 1
}

$env:Path = "$($NodeDir.FullName);$env:Path"
$env:XDG_CONFIG_HOME = Join-Path $ProjectRoot ".wrangler-config"

& (Join-Path $NodeDir.FullName "npx.cmd") wrangler @args
