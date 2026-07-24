# generate-cert.ps1
$certPath = "certs"
if (!(Test-Path $certPath)) {
    New-Item -ItemType Directory -Force -Path $certPath
}

# Gerar certificado auto-assinado
$cert = New-SelfSignedCertificate `
    -Subject "CN=localhost" `
    -FriendlyName "Localhost Development Certificate" `
    -Type SSLServerAuthentication `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -KeyExportPolicy Exportable `
    -NotAfter (Get-Date).AddYears(1) `
    -CertStoreLocation "Cert:\CurrentUser\My"

# Gerar senha aleatória para o certificado
$randomBytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($randomBytes)
$randomPassword = [Convert]::ToBase64String($randomBytes) -replace '[^a-zA-Z0-9]', ''
$certPassword = ConvertTo-SecureString -String $randomPassword -Force -AsPlainText

# Salvar senha em arquivo separado (adicionado ao .gitignore)
$passwordFile = Join-Path $certPath ".cert-password"
$randomPassword | Out-File -FilePath $passwordFile -Encoding utf8 -NoNewline
Write-Host "Senha do certificado salva em: $passwordFile" -ForegroundColor Yellow
Write-Host "GUARDE esta senha em local seguro." -ForegroundColor Red

# Exportar certificado
Export-PfxCertificate -Cert $cert -FilePath "$certPath\cert.pfx" -Password $certPassword

# Exportar separadamente (opcional)
Export-Certificate -Cert $cert -FilePath "$certPath\cert.crt"

# Converter para formato PEM se necessário
# (precisa do OpenSSL instalado)
if (Get-Command openssl -ErrorAction SilentlyContinue) {
    & openssl pkcs12 -in "$certPath\cert.pfx" -out "$certPath\cert.pem" -nodes -passin "pass:$randomPassword"
    & openssl pkcs12 -in "$certPath\cert.pfx" -out "$certPath\key.pem" -nodes -nocerts -passin "pass:$randomPassword"
    Write-Host "Certificados PEM gerados em: $certPath"
} else {
    Write-Host "OpenSSL nao encontrado. Certificados PEM nao foram gerados." -ForegroundColor Yellow
}

Write-Host "Certificados gerados em: $certPath"
