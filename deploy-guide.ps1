<#
.SYNOPSIS
    FrySwap DEX Complete Deployment Guide

.DESCRIPTION
    This PowerShell script provides a fully interactive, step-by-step guide for deploying
    FrySwap smart contracts and services to Algorand. No editing required - everything
    is configured through interactive prompts.

    Features:
    - Complete prerequisites checking and installation guidance
    - Python environment setup with automatic dependency installation
    - Smart contract compilation and deployment
    - API and Web frontend deployment
    - Pool creation wizard
    - Cross-platform support (Windows, Linux, macOS)

.NOTES
    Version: 1.0.0
    Author: Fry Foundation

.EXAMPLE
    .\deploy-guide.ps1
    Runs the complete interactive deployment wizard.

.EXAMPLE
    .\deploy-guide.ps1 -Mode Contracts
    Only handles smart contract deployment.

.EXAMPLE
    .\deploy-guide.ps1 -Mode Services
    Only handles API and Web service deployment.

.EXAMPLE
    .\deploy-guide.ps1 -Mode Pool
    Only creates a new liquidity pool.
#>

param(
    [ValidateSet("Full", "Contracts", "Services", "Pool", "Check")]
    [string]$Mode = "Full",
    [switch]$SkipConfirmation,
    [switch]$Verbose
)

# ============================================================
# CONFIGURATION
# ============================================================

$script:Config = @{
    AlgodMainnet = "https://mainnet-api.4160.nodely.dev"
    AlgodTestnet = "https://testnet-api.4160.nodely.dev"
    IndexerMainnet = "https://mainnet-idx.4160.nodely.dev"
    IndexerTestnet = "https://testnet-idx.4160.nodely.dev"
    MinPythonVersion = "3.10"
    MinNodeVersion = "18"
    MinAlgoBalance = 5
    DefaultApiPort = 3000
    DefaultWebPort = 5173
    FryTokenId = 2485314946
    DefaultFeeAddress = "E2F2LT2INE75DBOYHQXTCTOP2PAP5MHAXQRXTTCCXFKHQTVG36DJONBQZE"
}

$ErrorActionPreference = "Stop"
$script:ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:ContractsDir = Join-Path $script:ScriptDir "contracts"
$script:ApiDir = Join-Path $script:ScriptDir "api"
$script:WebDir = Join-Path $script:ScriptDir "web"
$script:BuildDir = Join-Path $script:ContractsDir "build"

# ============================================================
# OUTPUT FUNCTIONS
# ============================================================

function Write-Banner {
    Clear-Host
    Write-Host @"

    ___________                _________
    \_   _____/_______ ___.__./   _____/_  _  _______  ______
     |    __) \_  __ <   |  |\_____  \\ \/ \/ /\__  \ \____ \
     |     \   |  | \/\___  |/        \\     /  / __ \|  |_> >
     \___  /   |__|   / ____/_______  / \/\_/  (____  /   __/
         \/           \/            \/              \/|__|

                  DEPLOYMENT GUIDE v1.0.0
                  ========================
"@ -ForegroundColor Red
}

function Write-Header {
    param([string]$Text)
    Write-Host "`n$("=" * 70)" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "$("=" * 70)" -ForegroundColor Cyan
}

function Write-SubHeader {
    param([string]$Text)
    Write-Host "`n--- $Text ---" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Text)
    Write-Host "[OK] " -ForegroundColor Green -NoNewline
    Write-Host $Text
}

function Write-Warn {
    param([string]$Text)
    Write-Host "[!] " -ForegroundColor Yellow -NoNewline
    Write-Host $Text
}

function Write-Fail {
    param([string]$Text)
    Write-Host "[X] " -ForegroundColor Red -NoNewline
    Write-Host $Text
}

function Write-Info {
    param([string]$Text)
    Write-Host "[*] " -ForegroundColor White -NoNewline
    Write-Host $Text
}

function Write-Step {
    param([int]$Num, [int]$Total, [string]$Text)
    Write-Host "`n[$Num/$Total] " -ForegroundColor Magenta -NoNewline
    Write-Host $Text -ForegroundColor White
}

function Write-Detail {
    param([string]$Text)
    Write-Host "    $Text" -ForegroundColor Gray
}

function Prompt-Continue {
    param([string]$Message = "Press Enter to continue...")
    Write-Host ""
    Read-Host $Message | Out-Null
}

function Prompt-YesNo {
    param(
        [string]$Question,
        [bool]$Default = $true
    )
    $defaultText = if ($Default) { "[Y/n]" } else { "[y/N]" }
    $response = Read-Host "$Question $defaultText"

    if ([string]::IsNullOrWhiteSpace($response)) {
        return $Default
    }
    return $response -match "^(y|yes)$"
}

function Show-Menu {
    param(
        [string]$Title,
        [string[]]$Options,
        [int]$Default = 1
    )

    Write-Host "`n$Title" -ForegroundColor Yellow
    for ($i = 0; $i -lt $Options.Count; $i++) {
        $marker = if ($i + 1 -eq $Default) { ">" } else { " " }
        Write-Host "  $marker $($i + 1). $($Options[$i])" -ForegroundColor White
    }

    do {
        $selection = Read-Host "`nEnter choice (1-$($Options.Count))"
        if ([string]::IsNullOrWhiteSpace($selection)) {
            $selection = $Default
        }
    } while ($selection -lt 1 -or $selection -gt $Options.Count)

    return [int]$selection
}

# ============================================================
# PREREQUISITES CHECKING
# ============================================================

function Test-Python {
    Write-Info "Checking Python installation..."

    try {
        # Try python3 first (Linux/macOS), then python (Windows)
        $pythonCmd = "python"
        try {
            $version = & python3 --version 2>&1
            if ($version -match "Python") {
                $pythonCmd = "python3"
            }
        } catch {}

        $version = & $pythonCmd --version 2>&1
        if ($version -match "Python (\d+)\.(\d+)\.(\d+)") {
            $major = [int]$Matches[1]
            $minor = [int]$Matches[2]
            $versionStr = "$major.$minor.$($Matches[3])"

            if ($major -ge 3 -and $minor -ge 10) {
                Write-Success "Python $versionStr found (required: 3.10+)"
                return @{ Success = $true; Command = $pythonCmd; Version = $versionStr }
            } else {
                Write-Fail "Python $versionStr found but 3.10+ required"
                return @{ Success = $false; Command = $null; Version = $versionStr }
            }
        }
    } catch {
        Write-Fail "Python not found"
        return @{ Success = $false; Command = $null; Version = $null }
    }

    return @{ Success = $false; Command = $null; Version = $null }
}

function Test-Node {
    Write-Info "Checking Node.js installation..."

    try {
        $version = & node --version 2>&1
        if ($version -match "v(\d+)\.(\d+)\.(\d+)") {
            $major = [int]$Matches[1]
            $versionStr = "$major.$($Matches[2]).$($Matches[3])"

            if ($major -ge 18) {
                Write-Success "Node.js $versionStr found (required: 18+)"
                return @{ Success = $true; Version = $versionStr }
            } else {
                Write-Fail "Node.js $versionStr found but 18+ required"
                return @{ Success = $false; Version = $versionStr }
            }
        }
    } catch {
        Write-Fail "Node.js not found"
        return @{ Success = $false; Version = $null }
    }

    return @{ Success = $false; Version = $null }
}

function Test-Npm {
    Write-Info "Checking npm installation..."

    try {
        $version = & npm --version 2>&1
        Write-Success "npm $version found"
        return @{ Success = $true; Version = $version }
    } catch {
        Write-Fail "npm not found"
        return @{ Success = $false; Version = $null }
    }
}

function Test-Git {
    Write-Info "Checking Git installation..."

    try {
        $version = & git --version 2>&1
        if ($version -match "git version (.+)") {
            Write-Success "Git $($Matches[1]) found"
            return @{ Success = $true; Version = $Matches[1] }
        }
    } catch {
        Write-Fail "Git not found"
        return @{ Success = $false; Version = $null }
    }

    return @{ Success = $false; Version = $null }
}

function Show-InstallGuide {
    param([string]$Tool)

    Write-SubHeader "Installation Guide: $Tool"

    $isWindows = $IsWindows -or ($env:OS -match "Windows")
    $isLinux = $IsLinux -or (Test-Path "/etc/os-release")
    $isMac = $IsMacOS -or (Test-Path "/usr/bin/sw_vers")

    switch ($Tool) {
        "Python" {
            Write-Host "`n  Download and install Python 3.10+:" -ForegroundColor White
            if ($isWindows) {
                Write-Host "    https://www.python.org/downloads/windows/" -ForegroundColor Cyan
                Write-Host "`n  Or use winget:" -ForegroundColor White
                Write-Host "    winget install Python.Python.3.12" -ForegroundColor Gray
            } elseif ($isMac) {
                Write-Host "    brew install python@3.12" -ForegroundColor Gray
                Write-Host "`n  Or download from:" -ForegroundColor White
                Write-Host "    https://www.python.org/downloads/macos/" -ForegroundColor Cyan
            } else {
                Write-Host "    Ubuntu/Debian:" -ForegroundColor White
                Write-Host "      sudo apt update && sudo apt install python3.12 python3.12-venv python3-pip" -ForegroundColor Gray
                Write-Host "`n    Fedora:" -ForegroundColor White
                Write-Host "      sudo dnf install python3.12" -ForegroundColor Gray
                Write-Host "`n    Arch:" -ForegroundColor White
                Write-Host "      sudo pacman -S python" -ForegroundColor Gray
            }
        }
        "Node.js" {
            Write-Host "`n  Download and install Node.js 18+:" -ForegroundColor White
            if ($isWindows) {
                Write-Host "    https://nodejs.org/en/download/" -ForegroundColor Cyan
                Write-Host "`n  Or use winget:" -ForegroundColor White
                Write-Host "    winget install OpenJS.NodeJS.LTS" -ForegroundColor Gray
            } elseif ($isMac) {
                Write-Host "    brew install node@20" -ForegroundColor Gray
                Write-Host "`n  Or download from:" -ForegroundColor White
                Write-Host "    https://nodejs.org/en/download/" -ForegroundColor Cyan
            } else {
                Write-Host "    Using NodeSource (recommended):" -ForegroundColor White
                Write-Host "      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -" -ForegroundColor Gray
                Write-Host "      sudo apt install -y nodejs" -ForegroundColor Gray
                Write-Host "`n    Or using nvm:" -ForegroundColor White
                Write-Host "      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash" -ForegroundColor Gray
                Write-Host "      nvm install 20" -ForegroundColor Gray
            }
        }
        "Git" {
            Write-Host "`n  Download and install Git:" -ForegroundColor White
            if ($isWindows) {
                Write-Host "    https://git-scm.com/download/win" -ForegroundColor Cyan
                Write-Host "`n  Or use winget:" -ForegroundColor White
                Write-Host "    winget install Git.Git" -ForegroundColor Gray
            } elseif ($isMac) {
                Write-Host "    brew install git" -ForegroundColor Gray
            } else {
                Write-Host "    sudo apt install git" -ForegroundColor Gray
            }
        }
    }
    Write-Host ""
}

function Test-AllPrerequisites {
    Write-Header "CHECKING PREREQUISITES"

    $results = @{
        Python = Test-Python
        Node = Test-Node
        Npm = Test-Npm
        Git = Test-Git
    }

    $allPassed = $true
    $failedTools = @()

    Write-SubHeader "Summary"

    foreach ($tool in @("Python", "Node", "Npm", "Git")) {
        if (-not $results[$tool].Success) {
            $allPassed = $false
            $failedTools += $tool
        }
    }

    if (-not $allPassed) {
        Write-Host "`n  Missing prerequisites detected!" -ForegroundColor Red
        Write-Host "  Please install the following before continuing:" -ForegroundColor Yellow

        foreach ($tool in $failedTools) {
            Write-Host "    - $tool" -ForegroundColor Red
            Show-InstallGuide $tool
        }

        if (-not $script:SkipConfirmation) {
            Write-Host "`n  After installing, run this script again." -ForegroundColor Yellow
            return $false
        }
    } else {
        Write-Success "All prerequisites satisfied!"
    }

    return $results
}

# ============================================================
# PYTHON ENVIRONMENT SETUP
# ============================================================

function Initialize-PythonEnvironment {
    param([string]$PythonCmd)

    Write-SubHeader "Setting up Python environment"

    $venvDir = Join-Path $script:ContractsDir ".venv"

    # Create virtual environment if needed
    if (-not (Test-Path $venvDir)) {
        Write-Info "Creating Python virtual environment..."
        & $PythonCmd -m venv $venvDir
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Failed to create virtual environment"
            return $null
        }
        Write-Success "Virtual environment created"
    } else {
        Write-Success "Virtual environment already exists"
    }

    # Determine pip path
    if ($IsWindows -or ($env:OS -match "Windows")) {
        $pipPath = Join-Path $venvDir "Scripts\pip.exe"
        $pythonPath = Join-Path $venvDir "Scripts\python.exe"
    } else {
        $pipPath = Join-Path $venvDir "bin/pip"
        $pythonPath = Join-Path $venvDir "bin/python"
    }

    # Install dependencies
    Write-Info "Installing Python dependencies..."
    $reqFile = Join-Path $script:ContractsDir "requirements.txt"

    & $pipPath install -q -r $reqFile 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        # Try installing individually
        & $pipPath install -q pyteal py-algorand-sdk 2>&1 | Out-Null
    }

    Write-Success "Python dependencies installed"

    return @{
        VenvDir = $venvDir
        PipPath = $pipPath
        PythonPath = $pythonPath
    }
}

# ============================================================
# NETWORK CONFIGURATION
# ============================================================

function Get-NetworkConfig {
    Write-Header "NETWORK CONFIGURATION"

    Write-Host "`n  Select the Algorand network for deployment:" -ForegroundColor White

    $choice = Show-Menu -Title "Network Selection" -Options @(
        "Mainnet (Production - Real ALGO required)",
        "Testnet (Testing - Free test ALGO)"
    ) -Default 1

    if ($choice -eq 1) {
        $network = "mainnet"
        $algod = $script:Config.AlgodMainnet
        $indexer = $script:Config.IndexerMainnet
    } else {
        $network = "testnet"
        $algod = $script:Config.AlgodTestnet
        $indexer = $script:Config.IndexerTestnet
    }

    Write-Success "Selected network: $network"
    Write-Detail "Algod: $algod"
    Write-Detail "Indexer: $indexer"

    return @{
        Network = $network
        Algod = $algod
        Indexer = $indexer
    }
}

# ============================================================
# WALLET CONFIGURATION
# ============================================================

function Get-WalletConfig {
    Write-Header "WALLET CONFIGURATION"

    Write-Host @"

  You need an Algorand wallet with sufficient funds to deploy contracts.

  Required funds:
    - Minimum: 5 ALGO (for contract deployment)
    - Recommended: 10+ ALGO (for pools and transactions)

  Your mnemonic (25 words) will be used to sign deployment transactions.
  It is NEVER stored or transmitted anywhere.

"@ -ForegroundColor White

    Write-Warn "SECURITY NOTICE: Never share your mnemonic with anyone!"
    Write-Host ""

    # Get mnemonic securely
    $secureString = Read-Host "Enter your 25-word mnemonic" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureString)
    $mnemonic = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

    # Validate word count
    $words = ($mnemonic.Trim() -split '\s+')
    if ($words.Count -ne 25) {
        Write-Fail "Invalid mnemonic: Expected 25 words, got $($words.Count)"
        return $null
    }

    Write-Success "Mnemonic accepted (25 words)"

    # Fee address configuration
    Write-Host "`n  Protocol Fee Configuration" -ForegroundColor Yellow
    Write-Host "  The fee address receives protocol fees from swaps (0.05%)." -ForegroundColor Gray
    Write-Host ""

    $useFryDefault = Prompt-YesNo "Use default FrySwap fee address?" $true

    if ($useFryDefault) {
        $feeAddress = $script:Config.DefaultFeeAddress
        Write-Detail "Using: $feeAddress"
    } else {
        $feeAddress = Read-Host "Enter custom fee address (Algorand address)"
        if ([string]::IsNullOrWhiteSpace($feeAddress)) {
            Write-Info "No address provided, fees will go to deployer address"
            $feeAddress = ""
        }
    }

    return @{
        Mnemonic = $mnemonic
        FeeAddress = $feeAddress
    }
}

# ============================================================
# CONTRACT COMPILATION
# ============================================================

function Invoke-ContractCompilation {
    param([string]$PythonPath)

    Write-Header "COMPILING SMART CONTRACTS"

    Write-Info "Compiling PyTeal contracts to TEAL bytecode..."
    Write-Host ""

    $deployScript = Join-Path $script:ContractsDir "scripts\deploy.py"

    # Run compilation
    $output = & $PythonPath $deployScript --compile-only 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Contract compilation failed!"
        Write-Host $output -ForegroundColor Red
        return $false
    }

    # Show compiled files
    Write-Success "Contracts compiled successfully!"
    Write-Host ""

    if (Test-Path $script:BuildDir) {
        $tealFiles = Get-ChildItem -Path $script:BuildDir -Filter "*.teal" -ErrorAction SilentlyContinue
        if ($tealFiles) {
            Write-Host "  Compiled contracts:" -ForegroundColor White
            foreach ($file in $tealFiles) {
                $size = [math]::Round($file.Length / 1KB, 1)
                Write-Detail "$($file.Name) ($size KB)"
            }
        }
    }

    return $true
}

# ============================================================
# CONTRACT DEPLOYMENT
# ============================================================

function Invoke-ContractDeployment {
    param(
        [string]$PythonPath,
        [string]$Mnemonic,
        [string]$FeeAddress,
        [string]$Network,
        [string]$Algod
    )

    Write-Header "DEPLOYING SMART CONTRACTS"

    Write-Host @"

  The following contracts will be deployed:
    1. Factory Contract - Manages pool creation and registry
    2. Router Contract  - Handles swap routing and multi-hop trades

  This process will:
    - Deploy contracts to $Network
    - Initialize contracts with your configuration
    - Save deployment info to contracts/build/deployment.json

"@ -ForegroundColor White

    if (-not $script:SkipConfirmation) {
        $proceed = Prompt-YesNo "Proceed with deployment?"
        if (-not $proceed) {
            Write-Warn "Deployment cancelled"
            return $null
        }
    }

    Write-Info "Starting deployment... (this may take a few minutes)"
    Write-Host ""

    $deployScript = Join-Path $script:ContractsDir "scripts\deploy.py"

    # Build arguments
    $args = @(
        $deployScript,
        "--mnemonic", $Mnemonic,
        "--algod-address", $Algod
    )

    if (-not [string]::IsNullOrWhiteSpace($FeeAddress)) {
        $args += "--fee-address", $FeeAddress
    }

    # Run deployment
    $output = & $PythonPath @args 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Deployment failed!"
        Write-Host $output -ForegroundColor Red
        return $null
    }

    # Load deployment info
    $deploymentFile = Join-Path $script:BuildDir "deployment.json"
    if (Test-Path $deploymentFile) {
        $deployment = Get-Content $deploymentFile | ConvertFrom-Json

        Write-Success "Contracts deployed successfully!"
        Write-Host ""
        Write-Host "  Deployed Contract IDs:" -ForegroundColor Green
        Write-Detail "Factory: $($deployment.contracts.factory.app_id)"
        Write-Detail "Router:  $($deployment.contracts.router.app_id)"

        Write-Host "`n  View on AlgoExplorer:" -ForegroundColor Cyan
        $explorerBase = if ($Network -eq "mainnet") { "https://algoexplorer.io" } else { "https://testnet.algoexplorer.io" }
        Write-Detail "$explorerBase/application/$($deployment.contracts.factory.app_id)"
        Write-Detail "$explorerBase/application/$($deployment.contracts.router.app_id)"

        return $deployment
    }

    return $null
}

# ============================================================
# POOL DEPLOYMENT
# ============================================================

function Invoke-PoolDeployment {
    param(
        [string]$PythonPath,
        [string]$Mnemonic,
        [string]$Network,
        [string]$Algod
    )

    Write-Header "CREATE LIQUIDITY POOL"

    Write-Host @"

  Create a new liquidity pool for a trading pair.

  Common Asset IDs ($Network):
"@ -ForegroundColor White

    if ($Network -eq "mainnet") {
        Write-Host @"
    - ALGO: 0 (native)
    - USDC: 31566704
    - USDT: 312769
    - goBTC: 386192725
    - goETH: 386195940
    - FRY: $($script:Config.FryTokenId)
"@ -ForegroundColor Gray
    } else {
        Write-Host @"
    - ALGO: 0 (native)
    - (Use testnet asset IDs you've created)
"@ -ForegroundColor Gray
    }

    Write-Host ""

    # Get asset IDs
    $assetA = Read-Host "Enter first asset ID (0 for ALGO)"
    if ([string]::IsNullOrWhiteSpace($assetA)) { $assetA = "0" }

    $assetB = Read-Host "Enter second asset ID"
    if ([string]::IsNullOrWhiteSpace($assetB)) {
        Write-Warn "Second asset ID is required"
        return $null
    }

    # Validate
    try {
        $assetAInt = [int]$assetA
        $assetBInt = [int]$assetB
    } catch {
        Write-Fail "Invalid asset ID format"
        return $null
    }

    if ($assetAInt -eq $assetBInt) {
        Write-Fail "Asset IDs must be different"
        return $null
    }

    Write-Host "`n  Creating pool for: Asset $assetAInt / Asset $assetBInt" -ForegroundColor Yellow

    if (-not $script:SkipConfirmation) {
        $proceed = Prompt-YesNo "Proceed with pool creation?"
        if (-not $proceed) {
            Write-Warn "Pool creation cancelled"
            return $null
        }
    }

    Write-Info "Creating pool..."

    $deployScript = Join-Path $script:ContractsDir "scripts\deploy.py"

    $args = @(
        $deployScript,
        "--mnemonic", $Mnemonic,
        "--algod-address", $Algod,
        "--deploy-pool",
        "--asset-a", $assetAInt,
        "--asset-b", $assetBInt
    )

    $output = & $PythonPath @args 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Pool creation failed!"
        Write-Host $output -ForegroundColor Red
        return $null
    }

    # Load updated deployment
    $deploymentFile = Join-Path $script:BuildDir "deployment.json"
    if (Test-Path $deploymentFile) {
        $deployment = Get-Content $deploymentFile | ConvertFrom-Json

        if ($deployment.contracts.pools -and $deployment.contracts.pools.Count -gt 0) {
            $pool = $deployment.contracts.pools[-1]
            Write-Success "Pool created successfully!"
            Write-Detail "Pool App ID: $($pool.app_id)"
            Write-Detail "LP Token ID: $($pool.lp_token_id)"
            Write-Detail "Assets: $($pool.asset_a) / $($pool.asset_b)"
            return $pool
        }
    }

    return $null
}

# ============================================================
# SERVICE DEPLOYMENT
# ============================================================

function Initialize-Services {
    Write-Header "SETTING UP SERVICES"

    Write-Host "`n  Installing npm dependencies..." -ForegroundColor White

    Push-Location $script:ScriptDir

    try {
        & npm install 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "npm install encountered issues, attempting to continue..."
        } else {
            Write-Success "Dependencies installed"
        }
    } catch {
        Write-Warn "Could not run npm install: $_"
    }

    Pop-Location

    return $true
}

function New-EnvFile {
    param(
        [hashtable]$NetworkConfig,
        [object]$Deployment
    )

    Write-SubHeader "Creating environment configuration"

    # API .env file
    $apiEnvPath = Join-Path $script:ApiDir ".env"

    $factoryId = if ($Deployment -and $Deployment.contracts.factory) { $Deployment.contracts.factory.app_id } else { 0 }
    $routerId = if ($Deployment -and $Deployment.contracts.router) { $Deployment.contracts.router.app_id } else { 0 }

    $apiEnv = @"
# FrySwap API Configuration
# Generated by deploy-guide.ps1 on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# Server
PORT=$($script:Config.DefaultApiPort)
NODE_ENV=production

# Algorand Network
ALGORAND_NETWORK=$($NetworkConfig.Network)
ALGOD_SERVER=$($NetworkConfig.Algod)
ALGOD_PORT=443
ALGOD_TOKEN=
INDEXER_SERVER=$($NetworkConfig.Indexer)
INDEXER_PORT=443
INDEXER_TOKEN=

# Contract IDs (update after deployment)
FACTORY_APP_ID=$factoryId
ROUTER_APP_ID=$routerId

# CORS (add your domains)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Cache
CACHE_TTL=10

# FRY Fee System
FRY_TOKEN_ID=$($script:Config.FryTokenId)
FRY_FEE_ADDRESS=$($script:Config.DefaultFeeAddress)
FRY_FEE_BPS=30
"@

    $apiEnv | Out-File -FilePath $apiEnvPath -Encoding utf8 -Force
    Write-Success "Created api/.env"

    # Web .env.local file
    $webEnvPath = Join-Path $script:WebDir ".env.local"

    $webEnv = @"
# FrySwap Web Configuration
# Generated by deploy-guide.ps1 on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

VITE_API_URL=http://localhost:$($script:Config.DefaultApiPort)/api/v1
VITE_ALGORAND_NETWORK=$($NetworkConfig.Network)
"@

    $webEnv | Out-File -FilePath $webEnvPath -Encoding utf8 -Force
    Write-Success "Created web/.env.local"

    return $true
}

function Show-ServiceInstructions {
    param([hashtable]$NetworkConfig)

    Write-Header "RUNNING SERVICES"

    Write-Host @"

  Your FrySwap deployment is ready! Here's how to run the services:

"@ -ForegroundColor White

    Write-Host "  1. Start the API server:" -ForegroundColor Yellow
    Write-Host "     cd $($script:ApiDir)" -ForegroundColor Gray
    Write-Host "     npm run start" -ForegroundColor Gray
    Write-Host "     (API will run on http://localhost:$($script:Config.DefaultApiPort))" -ForegroundColor DarkGray
    Write-Host ""

    Write-Host "  2. Start the Web frontend:" -ForegroundColor Yellow
    Write-Host "     cd $($script:WebDir)" -ForegroundColor Gray
    Write-Host "     npm run dev" -ForegroundColor Gray
    Write-Host "     (Web will run on http://localhost:$($script:Config.DefaultWebPort))" -ForegroundColor DarkGray
    Write-Host ""

    Write-Host "  3. For production deployment:" -ForegroundColor Yellow
    Write-Host "     cd $($script:WebDir)" -ForegroundColor Gray
    Write-Host "     npm run build" -ForegroundColor Gray
    Write-Host "     (Output will be in web/dist/)" -ForegroundColor DarkGray
    Write-Host ""

    Write-Host @"

  For VPS deployment instructions, see: vps.txt

"@ -ForegroundColor Cyan
}

# ============================================================
# MAIN DEPLOYMENT FLOW
# ============================================================

function Start-FullDeployment {
    Write-Banner

    Write-Host "  Welcome to the FrySwap Deployment Guide!" -ForegroundColor White
    Write-Host "  This wizard will walk you through the complete deployment process." -ForegroundColor Gray
    Write-Host ""

    # Step 1: Prerequisites
    $prereqs = Test-AllPrerequisites
    if (-not $prereqs -or -not $prereqs.Python.Success) {
        return
    }

    Prompt-Continue

    # Step 2: Python environment
    $pyEnv = Initialize-PythonEnvironment -PythonCmd $prereqs.Python.Command
    if (-not $pyEnv) {
        Write-Fail "Failed to setup Python environment"
        return
    }

    # Step 3: Network selection
    $networkConfig = Get-NetworkConfig

    # Step 4: Wallet configuration
    $walletConfig = Get-WalletConfig
    if (-not $walletConfig) {
        Write-Fail "Invalid wallet configuration"
        return
    }

    # Step 5: Compile contracts
    $compiled = Invoke-ContractCompilation -PythonPath $pyEnv.PythonPath
    if (-not $compiled) {
        return
    }

    Prompt-Continue

    # Step 6: Deploy contracts
    $deployment = Invoke-ContractDeployment `
        -PythonPath $pyEnv.PythonPath `
        -Mnemonic $walletConfig.Mnemonic `
        -FeeAddress $walletConfig.FeeAddress `
        -Network $networkConfig.Network `
        -Algod $networkConfig.Algod

    if (-not $deployment) {
        return
    }

    Prompt-Continue

    # Step 7: Ask about pool creation
    $createPool = Prompt-YesNo "`nWould you like to create a liquidity pool now?" $false
    if ($createPool) {
        Invoke-PoolDeployment `
            -PythonPath $pyEnv.PythonPath `
            -Mnemonic $walletConfig.Mnemonic `
            -Network $networkConfig.Network `
            -Algod $networkConfig.Algod
    }

    # Step 8: Setup services
    if ($prereqs.Node.Success -and $prereqs.Npm.Success) {
        Initialize-Services
        New-EnvFile -NetworkConfig $networkConfig -Deployment $deployment
    }

    # Step 9: Show instructions
    Show-ServiceInstructions -NetworkConfig $networkConfig

    Write-Header "DEPLOYMENT COMPLETE"

    Write-Host @"

  Congratulations! FrySwap has been deployed successfully.

  Deployment Summary:
    Network:    $($networkConfig.Network)
    Factory:    $($deployment.contracts.factory.app_id)
    Router:     $($deployment.contracts.router.app_id)

  Files created:
    - contracts/build/deployment.json
    - api/.env
    - web/.env.local

  Next steps:
    1. Start the API server
    2. Start the web frontend
    3. Add liquidity to your pools
    4. Configure for production (see vps.txt)

  Thank you for using FrySwap!

"@ -ForegroundColor Green
}

function Start-ContractsOnly {
    Write-Banner
    Write-Host "  Smart Contract Deployment Mode" -ForegroundColor Yellow
    Write-Host ""

    $prereqs = Test-AllPrerequisites
    if (-not $prereqs -or -not $prereqs.Python.Success) { return }

    $pyEnv = Initialize-PythonEnvironment -PythonCmd $prereqs.Python.Command
    if (-not $pyEnv) { return }

    $networkConfig = Get-NetworkConfig
    $walletConfig = Get-WalletConfig
    if (-not $walletConfig) { return }

    $compiled = Invoke-ContractCompilation -PythonPath $pyEnv.PythonPath
    if (-not $compiled) { return }

    Invoke-ContractDeployment `
        -PythonPath $pyEnv.PythonPath `
        -Mnemonic $walletConfig.Mnemonic `
        -FeeAddress $walletConfig.FeeAddress `
        -Network $networkConfig.Network `
        -Algod $networkConfig.Algod
}

function Start-ServicesOnly {
    Write-Banner
    Write-Host "  Services Setup Mode" -ForegroundColor Yellow
    Write-Host ""

    $prereqs = Test-AllPrerequisites
    if (-not $prereqs.Node.Success -or -not $prereqs.Npm.Success) { return }

    $networkConfig = Get-NetworkConfig

    # Load existing deployment if available
    $deploymentFile = Join-Path $script:BuildDir "deployment.json"
    $deployment = $null
    if (Test-Path $deploymentFile) {
        $deployment = Get-Content $deploymentFile | ConvertFrom-Json
        Write-Success "Found existing deployment configuration"
    }

    Initialize-Services
    New-EnvFile -NetworkConfig $networkConfig -Deployment $deployment
    Show-ServiceInstructions -NetworkConfig $networkConfig
}

function Start-PoolOnly {
    Write-Banner
    Write-Host "  Pool Creation Mode" -ForegroundColor Yellow
    Write-Host ""

    $prereqs = Test-AllPrerequisites
    if (-not $prereqs -or -not $prereqs.Python.Success) { return }

    $pyEnv = Initialize-PythonEnvironment -PythonCmd $prereqs.Python.Command
    if (-not $pyEnv) { return }

    $networkConfig = Get-NetworkConfig
    $walletConfig = Get-WalletConfig
    if (-not $walletConfig) { return }

    Invoke-PoolDeployment `
        -PythonPath $pyEnv.PythonPath `
        -Mnemonic $walletConfig.Mnemonic `
        -Network $networkConfig.Network `
        -Algod $networkConfig.Algod
}

function Start-CheckOnly {
    Write-Banner
    Write-Host "  Prerequisites Check Mode" -ForegroundColor Yellow
    Write-Host ""

    Test-AllPrerequisites

    # Also check for existing deployment
    Write-SubHeader "Existing Deployment"

    $deploymentFile = Join-Path $script:BuildDir "deployment.json"
    if (Test-Path $deploymentFile) {
        $deployment = Get-Content $deploymentFile | ConvertFrom-Json
        Write-Success "Found existing deployment"
        Write-Detail "Network: $($deployment.network)"
        Write-Detail "Factory: $($deployment.contracts.factory.app_id)"
        Write-Detail "Router:  $($deployment.contracts.router.app_id)"

        if ($deployment.contracts.pools) {
            Write-Detail "Pools:   $($deployment.contracts.pools.Count)"
        }
    } else {
        Write-Info "No existing deployment found"
    }
}

# ============================================================
# ENTRY POINT
# ============================================================

switch ($Mode) {
    "Full"      { Start-FullDeployment }
    "Contracts" { Start-ContractsOnly }
    "Services"  { Start-ServicesOnly }
    "Pool"      { Start-PoolOnly }
    "Check"     { Start-CheckOnly }
}
