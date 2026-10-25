param(
    [ValidateSet('all', 'xiao', 'indicator')][string]$Target = 'all',
    [string]$Python = 'python'
)
$ErrorActionPreference = 'Stop'
$rpRoot = Split-Path -Parent $PSScriptRoot
$rpPythonPackages = Join-Path $rpRoot '.tools\python'
$rpOldPythonPath = $env:PYTHONPATH
$rpOldCore = $env:PLATFORMIO_CORE_DIR
$rpOldTelemetry = $env:PLATFORMIO_SETTING_ENABLE_TELEMETRY
try {
    if (-not (Test-Path -LiteralPath (Join-Path $rpPythonPackages 'platformio\__main__.py'))) {
        & $Python -m pip install --target $rpPythonPackages --no-warn-script-location 'platformio==6.1.18'
        if ($LASTEXITCODE -ne 0) { throw 'PlatformIO installation failed' }
    }
    $env:PYTHONPATH = $rpPythonPackages
    # Keep SDK include paths short: the ESP32 GCC 8 driver can exceed Windows'
    # child-process command-line limit with the longer .tools/platformio path.
    $env:PLATFORMIO_CORE_DIR = Join-Path $rpRoot '.pio'
    $env:PLATFORMIO_SETTING_ENABLE_TELEMETRY = 'no'
    $rpTargets = if ($Target -eq 'all') { @('xiao', 'indicator') } else { @($Target) }
    foreach ($rpTarget in $rpTargets) {
        & $Python -m platformio run --project-dir (Join-Path $rpRoot "firmware\$rpTarget")
        if ($LASTEXITCODE -ne 0) { throw "$rpTarget build failed" }
    }
} finally {
    $env:PYTHONPATH = $rpOldPythonPath
    $env:PLATFORMIO_CORE_DIR = $rpOldCore
    $env:PLATFORMIO_SETTING_ENABLE_TELEMETRY = $rpOldTelemetry
}
