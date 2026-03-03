# Despliegue Automático a S3

Este repositorio está configurado para desplegar automáticamente a S3 cuando se hace push a la rama `main`.

## Configuración Requerida

### 1. Secrets de GitHub

Necesitas configurar los siguientes secrets en GitHub:
- Ve a: `Settings` → `Secrets and variables` → `Actions`
- Añade los siguientes secrets:

#### Requeridos:
- `AWS_ACCESS_KEY_ID`: Tu Access Key ID de AWS
- `AWS_SECRET_ACCESS_KEY`: Tu Secret Access Key de AWS
- `AWS_REGION`: Región de AWS (ej: `eu-west-1`, `us-east-1`)

#### Opcionales:
- `CLOUDFRONT_DISTRIBUTION_ID`: ID de distribución de CloudFront (si usas CloudFront)

### 2. Permisos IAM en AWS

El usuario/rol de AWS necesita los siguientes permisos:

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
        "arn:aws:s3:::porra-birreros-f1",
        "arn:aws:s3:::porra-birreros-f1/*"
      ]
    }
  ]
}
```

Si usas CloudFront, añade también:
```json
{
  "Effect": "Allow",
  "Action": [
    "cloudfront:CreateInvalidation"
  ],
  "Resource": "*"
}
```

### 3. Configuración del Bucket S3

Asegúrate de que el bucket `porra-birreros-f1` tenga:
- **Permisos públicos de lectura** para los archivos estáticos (o configura CloudFront)
- **Política de bucket** que permita el acceso desde GitHub Actions

Ejemplo de política de bucket:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::porra-birreros-f1/*"
    }
  ]
}
```

## Cómo Funciona

1. Cuando haces `git push origin main`, GitHub Actions se activa automáticamente
2. El workflow:
   - Hace checkout del código
   - Configura las credenciales de AWS
   - Sincroniza los archivos con S3 (excluyendo archivos innecesarios)
   - Opcionalmente invalida la caché de CloudFront

## Archivos Excluidos

Los siguientes archivos NO se suben a S3:
- `.git/` y `.github/`
- Archivos de documentación (`.md`)
- `node_modules/`
- `.env`
- `cors-proxy.py` (solo para desarrollo local)
- `clear-local-data.html` (herramienta de desarrollo)
- `test.html`

## Ejecución Manual

También puedes ejecutar el despliegue manualmente:
1. Ve a `Actions` en GitHub
2. Selecciona "Deploy to S3"
3. Haz clic en "Run workflow"

## Verificación

Después del despliegue, verifica que los archivos estén en S3:
```bash
aws s3 ls s3://porra-birreros-f1/
```

## Troubleshooting

### Error: "Access Denied"
- Verifica que las credenciales de AWS sean correctas
- Verifica los permisos IAM del usuario

### Error: "Bucket not found"
- Verifica que el bucket `porra-birreros-f1` exista
- Verifica que estés en la región correcta

### Los cambios no se ven
- Si usas CloudFront, verifica que la invalidación se haya ejecutado
- Verifica que el bucket tenga permisos públicos de lectura
- Limpia la caché del navegador (Ctrl+F5)

