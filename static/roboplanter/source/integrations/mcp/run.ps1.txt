param(
    [string]$Python = 'python',
    [ValidateSet('stdio', 'streamable-http')][string]$Transport = 'stdio',
    [ValidateRange(1024, 65535)][int]$Port = 8765
)
$ErrorActionPreference = 'Stop'
& $Python (Join-Path $PSScriptRoot 'server.py') --transport $Transport --port $Port
if ($LASTEXITCODE -ne 0) { throw 'MCP server exited with an error' }
