# Guía Rápida (lo mínimo para usar el Dashboard)

## 1) Instalar (solo la primera vez)

En la raíz del proyecto:

```powershell
npm install
```

## 2) Configurar Supabase (solo la primera vez)

1. En Supabase: **Settings → API**
2. Copia:
   - **Project URL**
   - **anon public key** (NO uses `service_role`)
3. Crea en la raíz del proyecto el archivo **`.env.local`** con:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

## 3) Ejecutar

```powershell
npm run dev
```

Abrir: `http://localhost:3000`

## 4) Login (para probar)

- Crea un usuario en Supabase: **Authentication → Users → Add user**
- En la app: entra con ese **email** y **password**

## Problemas típicos (rápido)

- **Dice que faltan variables de entorno**: revisa que exista `.env.local`, que tenga `NEXT_PUBLIC_...` y reinicia el servidor (Ctrl+C y `npm run dev`).
- **Credenciales inválidas**: revisa el usuario en Supabase (Authentication → Users).
- **Puerto ocupado**: prueba `npm run dev -- -p 3001`.

