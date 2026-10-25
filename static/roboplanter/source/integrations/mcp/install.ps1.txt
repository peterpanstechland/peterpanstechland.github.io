param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$rpRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$rpPackages = Join-Path $rpRoot '.tools\mcp-python'
& $Python -m pip install --target $rpPackages --no-warn-script-location -r (Join-Path $PSScriptRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Workspace MCP dependency installation failed' }
