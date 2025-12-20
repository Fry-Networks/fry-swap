<#
.SYNOPSIS
    FrySwap DEX Deployment Script

.DESCRIPTION
    This PowerShell script walks you through deploying FrySwap smart contracts
    to Algorand mainnet. It handles:
    - Prerequisites checking
    - Python environment setup
    - Contract compilation
    - Contract deployment
    - Initialization

.NOTES
    Requirements:
    - Python 3.10+
    - pip (Python package manager)
    - Algorand account with at least 5 ALGO for deployment

.EXAMPLE
    .\deploy.ps1

    Runs the interactive deployment wizard.

.EXAMPLE
    .\deploy.ps1 -CompileOnly

    Only compiles contracts without deploying.
#>

param(
    [switch]$CompileOnly,
    [switch]$SkipPrereqs,
    [string]$Mnemonic,
    [string]$FeeAddress,
    [switch]$DeployPool,
    [int]$AssetA = 0,
    [int]$AssetB
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Header { param($text) Write-Host "`n$("=" * 60)" -ForegroundColor Cyan; Write-Host $text -ForegroundColor Cyan; Write-Host "$("=" * 60)`n" -ForegroundColor Cyan }
function Write-Success { param($text) Write-Host "[OK] $text" -ForegroundColor Green }
function Write-Warning { param($text) Write-Host "[!] $text" -ForegroundColor Yellow }
function Write-Error { param($text) Write-Host "[X] $text" -ForegroundColor Red }
function Write-Info { param($text) Write-Host "[*] $text" -ForegroundColor White }
function Write-Step { param($num, $text) Write-Host "`nStep $num`: $text" -ForegroundColor Magenta }

# Banner
Write-Host @"

    ____________  __  ______       ___    ____
   / ____/ __ \ \/ / / ___/ |     / / |  / / /
  / /_  / /_/ /\  /  \__ \| | /| / /| | / / /
 / __/ / _, _/ / /  ___/ /| |/ |/ / | |/ /_/
/_/   /_/ |_| /_/  /____/ |__/|__/  |___(_)

        Algorand DEX Deployment Script

"@ -ForegroundColor Red

Write-Host "Welcome to the FrySwap deployment wizard!" -ForegroundColor White
Write-Host "This script will guide you through deploying the FrySwap DEX contracts to Algorand mainnet.`n" -ForegroundColor Gray

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ContractsDir = Join-Path $ScriptDir "contracts"

# ============================================================
# STEP 1: Check Prerequisites
# ============================================================
if (-not $SkipPrereqs) {
    Write-Step 1 "Checking Prerequisites"

    # Check Python
    Write-Info "Checking Python installation..."
    try {
        $pythonVersion = & python --version 2>&1
        if ($pythonVersion -match "Python (\d+)\.(\d+)") {
            $major = [int]$Matches[1]
            $minor = [int]$Matches[2]
            if ($major -ge 3 -and $minor -ge 10) {
                Write-Success "Python $major.$minor found"
            } else {
                Write-Error "Python 3.10+ required, found $pythonVersion"
                exit 1
            }
        }
    } catch {
        Write-Error "Python not found. Please install Python 3.10+"
        Write-Info "Download from: https://www.python.org/downloads/"
        exit 1
    }

    # Check pip
    Write-Info "Checking pip installation..."
    try {
        $pipVersion = & pip --version 2>&1
        Write-Success "pip found: $pipVersion"
    } catch {
        Write-Error "pip not found. Please install pip"
        exit 1
    }

    # Check for venv or create one
    $venvDir = Join-Path $ContractsDir ".venv"
    if (-not (Test-Path $venvDir)) {
        Write-Info "Creating Python virtual environment..."
        & python -m venv $venvDir
        Write-Success "Virtual environment created at $venvDir"
    } else {
        Write-Success "Virtual environment found at $venvDir"
    }

    # Activate venv and install dependencies
    Write-Info "Activating virtual environment..."
    if ($IsWindows -or $env:OS -match "Windows") {
        $activateScript = Join-Path $venvDir "Scripts\Activate.ps1"
    } else {
        $activateScript = Join-Path $venvDir "bin/Activate.ps1"
    }

    if (Test-Path $activateScript) {
        . $activateScript
        Write-Success "Virtual environment activated"
    }

    Write-Info "Installing Python dependencies..."
    & pip install -q pyteal py-algorand-sdk
    Write-Success "Dependencies installed (pyteal, py-algorand-sdk)"
}

# ============================================================
# STEP 2: Compile Contracts
# ============================================================
Write-Step 2 "Compiling Smart Contracts"

$deployScript = Join-Path $ContractsDir "scripts\deploy.py"
$buildDir = Join-Path $ContractsDir "build"

Write-Info "Compiling contracts to TEAL..."
& python $deployScript --compile-only

if ($LASTEXITCODE -ne 0) {
    Write-Error "Contract compilation failed!"
    exit 1
}

Write-Success "Contracts compiled successfully!"
Write-Info "TEAL files saved to: $buildDir"

# List compiled files
Get-ChildItem -Path $buildDir -Filter "*.teal" | ForEach-Object {
    Write-Host "    - $($_.Name) ($([math]::Round($_.Length/1KB, 1)) KB)" -ForegroundColor Gray
}

if ($CompileOnly) {
    Write-Header "Compilation Complete"
    Write-Host "Contracts have been compiled to TEAL format." -ForegroundColor Green
    Write-Host "TEAL files are located in: $buildDir" -ForegroundColor Gray
    exit 0
}

# ============================================================
# STEP 3: Configure Deployment
# ============================================================
Write-Step 3 "Configuring Deployment"

Write-Host "`nYou will need:" -ForegroundColor Yellow
Write-Host "  1. An Algorand account mnemonic (25 words)" -ForegroundColor White
Write-Host "  2. At least 5 ALGO in the account for deployment costs" -ForegroundColor White
Write-Host "  3. (Optional) A fee recipient address`n" -ForegroundColor White

# Get mnemonic
if (-not $Mnemonic) {
    Write-Warning "SECURITY: Your mnemonic will be used only for this deployment."
    Write-Warning "Never share your mnemonic with anyone!`n"

    $secureString = Read-Host "Enter your 25-word mnemonic" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureString)
    $Mnemonic = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}

if ([string]::IsNullOrWhiteSpace($Mnemonic)) {
    Write-Error "Mnemonic is required for deployment"
    exit 1
}

# Validate mnemonic word count
$wordCount = ($Mnemonic.Trim() -split '\s+').Count
if ($wordCount -ne 25) {
    Write-Error "Invalid mnemonic: Expected 25 words, got $wordCount"
    exit 1
}

Write-Success "Mnemonic accepted ($wordCount words)"

# Fee address
if (-not $FeeAddress) {
    Write-Host "`nProtocol fee address (leave blank to use deployer address):" -ForegroundColor Gray
    $FeeAddress = Read-Host "Fee address"
}

# ============================================================
# STEP 4: Confirm Deployment
# ============================================================
Write-Step 4 "Confirm Deployment"

Write-Host "`nDeployment Configuration:" -ForegroundColor Yellow
Write-Host "  Network:       Algorand Mainnet" -ForegroundColor White
Write-Host "  Algod Server:  https://mainnet-api.4160.nodely.dev" -ForegroundColor White
if ($FeeAddress) {
    Write-Host "  Fee Address:   $FeeAddress" -ForegroundColor White
} else {
    Write-Host "  Fee Address:   (same as deployer)" -ForegroundColor White
}

Write-Host "`nContracts to deploy:" -ForegroundColor Yellow
Write-Host "  1. Factory Contract - Pool registry and management" -ForegroundColor White
Write-Host "  2. Router Contract  - Swap routing and multi-hop" -ForegroundColor White
if ($DeployPool -and $AssetB) {
    Write-Host "  3. Pool Contract    - ALGO/$AssetB trading pair" -ForegroundColor White
}

Write-Host ""
$confirm = Read-Host "Proceed with deployment? (yes/no)"

if ($confirm -notmatch "^(yes|y)$") {
    Write-Warning "Deployment cancelled."
    exit 0
}

# ============================================================
# STEP 5: Deploy Contracts
# ============================================================
Write-Step 5 "Deploying Contracts"

Write-Host "`nThis may take a few minutes...`n" -ForegroundColor Gray

# Build command arguments
$deployArgs = @(
    $deployScript,
    "--mnemonic", $Mnemonic
)

if ($FeeAddress) {
    $deployArgs += "--fee-address", $FeeAddress
}

if ($DeployPool -and $AssetB) {
    $deployArgs += "--deploy-pool"
    $deployArgs += "--asset-a", $AssetA
    $deployArgs += "--asset-b", $AssetB
}

# Run deployment
try {
    & python @deployArgs

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Deployment failed!"
        exit 1
    }
} catch {
    Write-Error "Deployment error: $_"
    exit 1
}

# ============================================================
# STEP 6: Deployment Complete
# ============================================================
Write-Header "Deployment Successful!"

$deploymentFile = Join-Path $buildDir "deployment.json"
if (Test-Path $deploymentFile) {
    $deployment = Get-Content $deploymentFile | ConvertFrom-Json

    Write-Host "Deployed Contracts:" -ForegroundColor Green
    Write-Host "  Factory App ID: $($deployment.contracts.factory.app_id)" -ForegroundColor White
    Write-Host "  Router App ID:  $($deployment.contracts.router.app_id)" -ForegroundColor White

    if ($deployment.contracts.pools) {
        foreach ($pool in $deployment.contracts.pools) {
            Write-Host "  Pool App ID:    $($pool.app_id) (Assets: $($pool.asset_a)/$($pool.asset_b))" -ForegroundColor White
            Write-Host "  LP Token ID:    $($pool.lp_token_id)" -ForegroundColor White
        }
    }

    Write-Host "`nView on AlgoExplorer:" -ForegroundColor Cyan
    Write-Host "  https://algoexplorer.io/application/$($deployment.contracts.factory.app_id)" -ForegroundColor Gray
    Write-Host "  https://algoexplorer.io/application/$($deployment.contracts.router.app_id)" -ForegroundColor Gray
}

Write-Host "`nDeployment info saved to: $deploymentFile" -ForegroundColor Gray
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Update your web app with the new contract IDs" -ForegroundColor White
Write-Host "  2. Deploy additional pools for trading pairs" -ForegroundColor White
Write-Host "  3. Add initial liquidity to pools" -ForegroundColor White

Write-Host "`nThank you for using FrySwap!" -ForegroundColor Red
