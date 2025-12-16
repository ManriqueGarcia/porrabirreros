# Configuración para Desarrollo Local

## Usuarios por Defecto

La aplicación crea automáticamente los siguientes usuarios al iniciar por primera vez:

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| Antonio | `B1rr3r0s` | Usuario |
| Carlos | `B1rr3r0s` | Usuario |
| Pere | `B1rr3r0s` | Usuario |
| Toni | `B1rr3r0s` | Usuario |
| Manrique | `B1rr3r0s` | Admin |

**Nota:** En el primer acceso, se pedirá cambiar la contraseña.

## Si no se crean los usuarios automáticamente

### Opción 1: Limpiar localStorage

Abre la consola del navegador (F12) y ejecuta:

```javascript
localStorage.removeItem('porra_f1_clean_v3');
location.reload();
```

Esto eliminará todos los datos locales y forzará la recreación de usuarios.

### Opción 2: Forzar recreación manualmente

En la consola del navegador:

```javascript
// Ver estado actual
const db = JSON.parse(localStorage.getItem('porra_f1_clean_v3') || '{}');
console.log('Usuarios:', Object.keys(db.users || {}));
console.log('Seeded:', db.meta?.seeded);

// Forzar recreación
const newDb = {
  ...db,
  meta: {
    ...(db.meta || {}),
    seeded: false
  }
};
localStorage.setItem('porra_f1_clean_v3', JSON.stringify(newDb));
location.reload();
```

### Opción 3: Crear usuarios desde Admin

Si ya tienes acceso como admin (Manrique), puedes crear usuarios desde:
- **Admin → Gestión de usuarios**

## Verificar que los usuarios existen

En la consola del navegador:

```javascript
const db = JSON.parse(localStorage.getItem('porra_f1_clean_v3') || '{}');
console.table(Object.values(db.users || {}).map(u => ({
  nombre: u.name,
  admin: u.isAdmin,
  bloqueado: u.blocked,
  debeCambiarPass: u.mustChange
})));
```

## Resetear completamente

Para empezar desde cero:

```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

