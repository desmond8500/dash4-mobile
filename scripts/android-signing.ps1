# Crée la clé de signature définitive de l'application Android et l'enregistre dans les secrets
# du dépôt GitHub dash4-mobile (ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS,
# ANDROID_KEY_PASSWORD). Les APK suivants seront signés avec cette clé.
#
# Prérequis : Java (keytool) et GitHub CLI connecté (winget install GitHub.cli, puis gh auth login).
# Utilisation, depuis le dossier dash4-mobile :  powershell -ExecutionPolicy Bypass -File scripts\android-signing.ps1
$ErrorActionPreference = 'Stop'
$repo = 'desmond8500/dash4-mobile'
$keystore = Join-Path (Get-Location) 'dash4.keystore'

if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) { throw "keytool introuvable : installez Java (JDK 21) ou ajoutez son dossier bin au PATH." }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "GitHub CLI introuvable : winget install GitHub.cli, puis gh auth login." }
gh auth status | Out-Null
if (Test-Path $keystore) { throw "dash4.keystore existe déjà ici : supprimez-le ou lancez le script ailleurs (ne perdez pas une clé déjà utilisée)." }

$secure = Read-Host 'Mot de passe de la clé (8 caractères au moins, à noter en lieu sûr)' -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
if ($password.Length -lt 8) { throw 'Le mot de passe doit faire 8 caractères au moins.' }

keytool -genkeypair -noprompt -keystore $keystore -alias dash4 -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass $password -keypass $password -dname 'CN=Dash4, O=Yonkou, C=SN'

$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keystore))
gh secret set ANDROID_KEYSTORE_BASE64 -R $repo --body $base64
gh secret set ANDROID_KEYSTORE_PASSWORD -R $repo --body $password
gh secret set ANDROID_KEY_ALIAS -R $repo --body 'dash4'
gh secret set ANDROID_KEY_PASSWORD -R $repo --body $password

Write-Host ''
Write-Host 'Les 4 secrets sont enregistrés dans le dépôt dash4-mobile.' -ForegroundColor Green
Write-Host "Gardez dash4.keystore et son mot de passe en lieu sûr (hors du dépôt) : sans eux, plus de mise à jour possible."
Write-Host 'Le prochain APK sera signé avec cette clé : désinstallez une dernière fois l application avant de l installer.'
