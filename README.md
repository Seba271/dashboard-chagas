# Dashboard Chagas - Región de Coquimbo

Sistema de visualización de indicadores epidemiológicos de la enfermedad de Chagas para la Región de Coquimbo, Chile.

## 📋 Descripción del Proyecto

Dashboard web académico desarrollado como Proyecto de Título en Ingeniería Civil en Computación e Informática. El sistema consume datos desde Supabase (PostgreSQL + Auth + RLS) y cumple con principios de seguridad, rendimiento y diseño modular.

## 🚀 Stack Tecnológico

- **Next.js 14** (App Router)
- **JavaScript** (ES6+)
- **Supabase** (@supabase/supabase-js)
- **React 18**

## 📁 Estructura del Proyecto

```
dashboard-chagas/
├── app/
│   ├── dashboard/
│   │   └── page.js          # Página protegida del dashboard
│   ├── login/
│   │   └── page.js          # Página de autenticación
│   ├── layout.js            # Layout raíz de la aplicación
│   ├── page.js              # Página principal (redirige)
│   └── globals.css          # Estilos globales
├── lib/
│   └── supabase.js          # Cliente Supabase reutilizable
├── middleware.js            # Middleware para protección de rutas
├── .env.local.example       # Ejemplo de variables de entorno
├── next.config.js           # Configuración de Next.js
└── package.json             # Dependencias del proyecto
```

## 🔧 Instalación

### Requisitos Previos

- **Node.js** (versión 18 o superior) - [Descargar aquí](https://nodejs.org/)
- **npm** (viene incluido con Node.js)
- **Cuenta de Supabase** - [Crear cuenta](https://supabase.com)

### Pasos de Instalación

1. **Verificar Node.js:**
   ```bash
   node --version
   npm --version
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   - Crea un archivo `.env.local` en la raíz del proyecto
   - Agrega tus credenciales de Supabase:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
     ```

4. **Verificar instalación (opcional):**
   ```bash
   node verificar-instalacion.js
   ```

5. **Ejecutar en desarrollo:**
   ```bash
   npm run dev
   ```

6. **Abrir en el navegador:**
   ```
   http://localhost:3000
   ```

> 📖 Guía mínima: `GUIA_RAPIDA.md`

## 🔐 Autenticación

### Flujo de Autenticación

1. **Usuario accede a la aplicación** (`/`)
   - La página principal verifica si hay una sesión activa
   - Si hay sesión → redirige a `/dashboard`
   - Si no hay sesión → redirige a `/login`

2. **Usuario inicia sesión** (`/login`)
   - Ingresa email y contraseña
   - Supabase Auth valida las credenciales
   - Si son válidas, se crea una sesión y se almacena en el navegador
   - El usuario es redirigido a `/dashboard`

3. **Usuario accede al dashboard** (`/dashboard`)
   - La página verifica la sesión antes de renderizar
   - Si no hay sesión → redirige a `/login`
   - Si hay sesión → muestra el contenido protegido

4. **Usuario cierra sesión**
   - Se llama a `supabase.auth.signOut()`
   - Se elimina la sesión del navegador
   - Redirige a `/login`

### Persistencia de Sesión

- Supabase Auth maneja automáticamente la persistencia de sesión usando cookies y localStorage
- La sesión se mantiene entre recargas de página
- Los tokens se refrescan automáticamente cuando es necesario

### Protección de Rutas

- **Página principal (`/`)**: Verifica sesión y redirige apropiadamente
- **Login (`/login`)**: Si ya hay sesión, redirige a dashboard
- **Dashboard (`/dashboard`)**: Requiere autenticación, redirige a login si no hay sesión

## 🛡️ Seguridad

### Buenas Prácticas Implementadas

1. **Solo Anon Key en Frontend**
   - El proyecto usa únicamente la `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Nunca se expone la Service Role Key
   - La seguridad se maneja mediante Row Level Security (RLS) en Supabase

2. **Protección de Rutas**
   - Verificación de sesión en cada página protegida
   - Redirección automática si no hay autenticación
   - Manejo de estados de carga y error

3. **Manejo de Errores**
   - Mensajes de error claros para el usuario
   - No se exponen detalles técnicos sensibles
   - Validación de formularios en el cliente

4. **Variables de Entorno**
   - Las credenciales se almacenan en `.env.local` (no se commitea)
   - Solo variables públicas con prefijo `NEXT_PUBLIC_`

## 📝 Estado del Proyecto

### ✅ Etapa 1 - Completada

- [x] Estructura base de Next.js 14 (App Router)
- [x] Cliente Supabase configurado
- [x] Página de login funcional
- [x] Página de dashboard protegida
- [x] Persistencia de sesión
- [x] Protección de rutas
- [x] Manejo de estados de carga y error

### 🔜 Próximas Etapas

- [ ] Implementación de KPIs epidemiológicos
- [ ] Visualización de gráficos y estadísticas
- [ ] Mapas interactivos de la Región de Coquimbo
- [ ] Filtros y búsquedas avanzadas
- [ ] Optimización de rendimiento
- [ ] Vistas agregadas (SQL Views) para KPIs

## 📚 Recursos

- [Documentación de Next.js](https://nextjs.org/docs)
- [Documentación de Supabase](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)

## 👤 Autor

Proyecto de Título - Ingeniería Civil en Computación e Informática

---

**Nota:** Este proyecto es académico y está en desarrollo activo.


