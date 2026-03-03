# Instrucciones para subir a GitHub

## 1. Crear el repositorio en GitHub

Ve a https://github.com/new y crea un nuevo repositorio (sin inicializar con README).

## 2. Conectar y subir

Una vez creado el repositorio en GitHub, ejecuta estos comandos:

```bash
cd /home/mangarci/Downloads/porra/v3

# Añade el remoto (reemplaza TU_USUARIO con tu usuario de GitHub)
git remote add origin https://github.com/TU_USUARIO/porra-f1-futbol.git

# Sube el código
git push -u origin main
```

## Si usas SSH en lugar de HTTPS:

```bash
git remote add origin git@github.com:TU_USUARIO/porra-f1-futbol.git
git push -u origin main
```

## Si GitHub te pide autenticación:

- Si usas HTTPS: GitHub te pedirá usuario y token (no contraseña)
  - Crea un token en: https://github.com/settings/tokens
  - Selecciona permisos: `repo`
  
- Si usas SSH: Asegúrate de tener tu clave SSH configurada en GitHub


