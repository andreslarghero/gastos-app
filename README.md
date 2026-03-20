# Gastos App

Aplicación de control de gastos con autenticación, CRUD, filtros y dashboard.

## Despliegue y configuración

### 1) Variables de entorno necesarias

Copiá `.env.example` como `.env` y configurá:

- `PORT`: puerto del backend (ej. `3001` en local).
- `PUBLIC_API_BASE_URL`: base URL que usará el frontend para llamar al backend.
  - En despliegue con mismo dominio/backend, dejalo vacío.
  - En frontend y backend separados, poné la URL completa del API.
- `PUBLIC_SUPABASE_URL`: URL del proyecto Supabase para el navegador.
- `PUBLIC_SUPABASE_ANON_KEY`: clave anónima pública de Supabase para el navegador.
- `SUPABASE_URL`: URL de Supabase para el backend.
- `SUPABASE_ANON_KEY`: clave de Supabase usada por el backend.

### 2) Cómo correr localmente

1. Instalar dependencias:
   - `npm install`
2. Configurar `.env` (basado en `.env.example`).
3. Iniciar:
   - `npm start`
4. Abrir:
   - `http://localhost:3001`

### 3) Qué desplegar primero

1. Crear/provisionar proyecto Supabase y tabla de gastos.
2. Configurar variables de entorno en el servicio donde desplegues Node/Express.
3. Desplegar esta app (backend + frontend estático servido por Express).

### 4) Qué probar después del deploy

- Registro, login y logout.
- Persistencia de sesión al refrescar.
- Crear, editar y eliminar gastos.
- Filtros por categoría/búsqueda.
- Dashboard (resumen + gráfico) con y sin gastos.
