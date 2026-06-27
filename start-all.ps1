# start-all.ps1
# AstroNLP AI - Unified Startup Script

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " AstroNLP AI - Unified Startup Script" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Step 1: Start Docker infrastructure
Write-Host "[1/4] Starting Docker infrastructure (PostgreSQL, Redis, Qdrant, MinIO, NATS)..." -ForegroundColor Yellow
docker compose up -d

# Wait for services to be ready
Write-Host "Waiting 5 seconds for databases to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Step 2: Check database connections
Write-Host "[2/4] Verifying infrastructure ports..." -ForegroundColor Yellow
$ports = @{
    "PostgreSQL" = 5432
    "Redis" = 6379
    "Qdrant" = 6333
    "NATS" = 4222
    "MinIO" = 9000
}

foreach ($service in $ports.Keys) {
    $port = $ports[$service]
    $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
    if ($connection.TcpTestSucceeded) {
        Write-Host "  [OK] $service is listening on port $port" -ForegroundColor Green
    } else {
        Write-Warning "  [FAIL] $service is NOT listening on port $port. Startup might fail."
    }
}

# Step 3: Start backend microservices
Write-Host "[3/4] Starting Backend Microservices in new terminals..." -ForegroundColor Yellow

# Start Go Services
Write-Host "  -> Starting Auth Service (Port 8081)..." -ForegroundColor Gray
Start-Process powershell -ArgumentList '-NoExit', '-Command', '$env:PORT=8081; go run services/auth/main.go' -WindowStyle Minimized

Write-Host "  -> Starting User Service (Port 8082)..." -ForegroundColor Gray
Start-Process powershell -ArgumentList '-NoExit', '-Command', '$env:PORT=8082; go run services/user/main.go' -WindowStyle Minimized

Write-Host "  -> Starting Chart Service (Port 8083)..." -ForegroundColor Gray
Start-Process powershell -ArgumentList '-NoExit', '-Command', '$env:PORT=8083; go run services/chart/main.go' -WindowStyle Minimized

# Start Python Service
Write-Host "  -> Starting Python Prediction Service (Port 8084)..." -ForegroundColor Gray
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd services/prediction; .\venv\Scripts\Activate.ps1; python main.py' -WindowStyle Minimized

# Start Go API Gateway
Write-Host "  -> Starting API Gateway (Port 8080)..." -ForegroundColor Gray
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'go run gateway/main.go' -WindowStyle Minimized

Write-Host "Waiting 5 seconds for microservices to bind to ports..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verify backend services started successfully
Write-Host "Verifying backend service ports..." -ForegroundColor Yellow
$backendPorts = @{
    "API Gateway (Port 8080)" = 8080
    "Auth Service (Port 8081)" = 8081
    "User Service (Port 8082)" = 8082
    "Chart Service (Port 8083)" = 8083
    "Prediction Service (Port 8084)" = 8084
}

$allRunning = $true
foreach ($service in $backendPorts.Keys) {
    $port = $backendPorts[$service]
    $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
    if ($connection.TcpTestSucceeded) {
        Write-Host "  [OK] $service is running" -ForegroundColor Green
    } else {
        Write-Warning "  [FAIL] $service failed to start! Open its minimized terminal window to inspect the error."
        $allRunning = $false
    }
}

# Step 4: Start Frontend
Write-Host "[4/4] Starting React Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd frontend; npm run dev' -WindowStyle Normal

Write-Host "==================================================" -ForegroundColor Green
if ($allRunning) {
    Write-Host " Cosmic dashboard is opening! Enjoy coding." -ForegroundColor Green
} else {
    Write-Warning " Some backend services failed to start. Please check the minimized terminals."
}
Write-Host " Run .\stop-all.ps1 to stop all services and containers." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
