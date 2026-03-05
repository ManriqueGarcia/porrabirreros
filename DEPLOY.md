# Despliegue a AWS (S3 + CloudFront)

Guía para configurar el despliegue automático desde GitHub Actions a AWS S3.

## 1. Crear recursos en AWS

### Bucket S3 (Hosting)

Crea un bucket para servir los archivos estáticos:

```bash
aws s3 mb s3://TU-BUCKET-NOMBRE
```

Configura el bucket para Static Website Hosting o úsalo detrás de CloudFront.

### Bucket S3 (Datos — opcional, separado)

Si quieres almacenar el estado de la porra en S3, crea un bucket separado para los datos JSON.

### CloudFront (recomendado)

Crea una distribución de CloudFront apuntando al bucket de hosting:
- **Origin**: tu bucket S3
- **Default Root Object**: `index.html`
- **Custom domain**: tu dominio (requiere certificado ACM)
- **Cache Policy**: CachingOptimized para assets, CachingDisabled para `index.html`

## 2. Permisos IAM

Crea un usuario IAM (o usa OIDC) con los siguientes permisos:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::TU-BUCKET-NOMBRE",
        "arn:aws:s3:::TU-BUCKET-NOMBRE/*"
      ]
    }
  ]
}
```

Si usas CloudFront, añade:

```json
{
  "Effect": "Allow",
  "Action": "cloudfront:CreateInvalidation",
  "Resource": "arn:aws:cloudfront::TU-ACCOUNT-ID:distribution/TU-DISTRIBUTION-ID"
}
```

## 3. Configurar GitHub Secrets

Ve a tu repositorio en GitHub: `Settings → Secrets and variables → Actions`.

| Secret | Descripción | Ejemplo |
|--------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | Access Key ID del usuario IAM | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | Secret Access Key | `wJal...` |
| `CLOUDFRONT_DISTRIBUTION_ID` | *(opcional)* ID de distribución CF | `E1ABC2DEF3` |

## 4. Configurar el workflow

Edita `.github/workflows/deploy-s3.yml` y reemplaza el nombre del bucket:

```yaml
- name: Sincronizar dist/ con S3
  run: |
    aws s3 sync dist/ s3://TU-BUCKET-NOMBRE \
      --delete \
      --cache-control "public, max-age=31536000, immutable" \
      --exclude "index.html" \
      --exclude "*.gz"

    aws s3 cp dist/index.html s3://TU-BUCKET-NOMBRE/index.html \
      --cache-control "no-cache, no-store, must-revalidate"
```

Si tu bucket está en otra región, cambia `aws-region` en el paso de configuración de credenciales.

## 5. Despliegue

### Automático (recomendado)

Cada push a `main` activa el workflow:

1. `npm ci` — instala dependencias
2. `npm audit` — auditoría de seguridad
3. `node build.mjs` — compila JS (esbuild) y CSS (Tailwind)
4. `aws s3 sync dist/` — sube a S3
5. `aws cloudfront create-invalidation` — limpia caché CDN

### Manual

```bash
npm run build
aws s3 sync dist/ s3://TU-BUCKET-NOMBRE --delete
aws cloudfront create-invalidation --distribution-id TU_ID --paths "/*"
```

### Desde GitHub

1. Ve a `Actions` en tu repositorio
2. Selecciona "Build & Deploy to S3"
3. Clic en "Run workflow"

## Troubleshooting

| Error | Solución |
|-------|----------|
| Access Denied | Verifica credenciales AWS y permisos IAM |
| Bucket not found | Verifica nombre del bucket y región |
| Cambios no se ven | Invalida CloudFront + Ctrl+F5 en el navegador |
| Deploy falla | Revisa los logs en GitHub Actions; se crea un issue automáticamente |
