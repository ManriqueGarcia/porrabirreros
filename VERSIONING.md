# Sistema de Versionado

Este proyecto usa un sistema de versionado basado en ramas Git siguiendo [Semantic Versioning](https://semver.org/).

## Formato de Versión

Las versiones siguen el formato: `vMAJOR.MINOR.PATCH`

- **MAJOR**: Cambios incompatibles con versiones anteriores
- **MINOR**: Nuevas funcionalidades compatibles hacia atrás
- **PATCH**: Correcciones de bugs compatibles

## Flujo de Trabajo

### 1. Crear una nueva rama de versión

```bash
# Desde main, crear nueva rama de versión
git checkout main
git pull origin main
git checkout -b v1.1.0  # Ejemplo: nueva versión menor
```

### 2. Trabajar en la rama de versión

- Hacer todos los cambios y commits en la rama de versión
- Probar exhaustivamente antes de hacer merge

### 3. Merge a main cuando esté listo

```bash
# Desde la rama de versión
git checkout main
git merge v1.1.0
git push origin main

# Crear tag de la versión
git tag -a v1.1.0 -m "Release v1.1.0: Descripción de cambios"
git push origin v1.1.0
```

## Versiones Actuales

- **v1.0.0**: Versión inicial con porra F1 y Fútbol completa

## Convenciones

- Las ramas de versión se crean desde `main`
- Siempre probar en la rama de versión antes de mergear
- Los tags se crean en `main` después del merge
- Mantener `main` siempre estable y funcional

