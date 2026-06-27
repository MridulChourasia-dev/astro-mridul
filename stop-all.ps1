# stop-all.ps1
# AstroNLP AI - Unified Stop Script

Write-Host "Stopping all AstroNLP AI services..." -ForegroundColor Yellow

# 1. Kill backend and frontend processes listening on project ports
$ports = @(8080, 8081, 8082, 8083, 8084, 3000)
Write-Host "Releasing network ports..." -ForegroundColor Gray
foreach ($port in $ports) {
    $proc = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($proc) {
        $pids = $proc.OwningProcess | Select-Object -Unique
        foreach ($processId in $pids) {
            Write-Host "  -> Stopping process ID $processId listening on port $port..." -ForegroundColor DarkGray
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}

# 2. Stop Docker infrastructure
Write-Host "Stopping Docker containers..." -ForegroundColor Gray
docker compose down

Write-Host "All services stopped successfully!" -ForegroundColor Green
