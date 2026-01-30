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

# Exportar para arquivos
$certPassword = ConvertTo-SecureString -String "password123" -Force -AsPlainText

# Exportar certificado
Export-PfxCertificate -Cert $cert -FilePath "$certPath\cert.pfx" -Password $certPassword

# Exportar separadamente (opcional)
Export-Certificate -Cert $cert -FilePath "$certPath\cert.crt"

# Converter para formato PEM se necessário
# (precisa do OpenSSL instalado)
& openssl pkcs12 -in "$certPath\cert.pfx" -out "$certPath\cert.pem" -nodes -passin pass:password123
& openssl pkcs12 -in "$certPath\cert.pfx" -out "$certPath\key.pem" -nodes -nocerts -passin pass:password123

Write-Host "Certificados gerados em: $certPath"
