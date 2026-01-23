# Pruebas Manuales - FASE 2 Dashboard Chagas

## Checklist de Validación

### 1. Verificar Funciones RPC en Supabase

**Pasos:**
1. Abrir Supabase Dashboard → SQL Editor
2. Ejecutar el archivo `supabase_rpc_functions.sql` completo
3. Verificar que no hay errores de sintaxis
4. Ejecutar consulta de verificación:
   ```sql
   SELECT 
     routine_name,
     routine_type
   FROM information_schema.routines
   WHERE routine_schema = 'public'
     AND routine_name IN (
       'get_exams_by_month',
       'get_notifications_by_month',
       'get_counts_by_comuna',
       'get_map_points'
     );
   ```
5. **Resultado esperado:** Deben aparecer las 4 funciones listadas

**Probar cada función manualmente:**
```sql
-- Probar get_exams_by_month
SELECT * FROM get_exams_by_month(12);

-- Probar get_notifications_by_month
SELECT * FROM get_notifications_by_month(12);

-- Probar get_counts_by_comuna
SELECT * FROM get_counts_by_comuna(10);

-- Probar get_map_points
SELECT * FROM get_map_points(100);
```

**Resultado esperado:** Cada función debe retornar datos (o tabla vacía si no hay datos en las tablas)

---

### 2. Verificar Autenticación y Protección

**Pasos:**
1. Abrir navegador en modo incógnito
2. Ir a `http://localhost:3000/dashboard`
3. **Resultado esperado:** Debe redirigir automáticamente a `/login`
4. Hacer login con credenciales válidas
5. **Resultado esperado:** Debe redirigir a `/dashboard` y mostrar el contenido

---

### 3. Verificar KPIs Principales

**Pasos:**
1. Estar logueado en `/dashboard`
2. Verificar que se muestran 7 tarjetas de KPIs:
   - Total Personas
   - Total Exámenes
   - Bajo Control
   - Casos Agudos
   - Gestantes
   - Inasistentes
   - Tratamientos
3. **Resultado esperado:** 
   - Las tarjetas muestran números (o 0 si no hay datos)
   - Si hay error, se muestra mensaje de error en rojo
   - Los números están formateados con separadores de miles

---

### 4. Verificar Gráfico de Tendencia Temporal

**Pasos:**
1. En la sección "Análisis Temporal y Geográfico"
2. Verificar que el gráfico "Tendencia Temporal" muestra:
   - Dos líneas: una azul (Exámenes) y una verde (Notificaciones)
   - Leyenda en la parte superior
   - Eje X con meses formateados (ej: "Ene 24", "Feb 24")
   - Eje Y con números formateados
   - Tooltip al pasar el mouse sobre los puntos
3. Probar el filtro "Período":
   - Cambiar a "6 meses" → El gráfico debe actualizarse
   - Cambiar a "12 meses" → El gráfico debe actualizarse
   - Cambiar a "24 meses" → El gráfico debe actualizarse
4. **Resultado esperado:**
   - El gráfico se actualiza sin recargar la página
   - Los datos cambian según el período seleccionado
   - Si no hay datos, muestra "No hay datos disponibles"

---

### 5. Verificar Gráfico de Distribución por Comuna

**Pasos:**
1. En la misma sección, verificar el gráfico "Distribución por Comuna"
2. Verificar que muestra:
   - Barras horizontales ordenadas de mayor a menor
   - Nombres de comunas en el eje Y
   - Valores en el eje X
   - Tooltip al pasar el mouse
3. Probar el filtro "Top":
   - Cambiar a "10" → Muestra top 10 comunas
   - Cambiar a "20" → Muestra top 20 comunas
4. **Resultado esperado:**
   - El gráfico se actualiza al cambiar el filtro
   - Las comunas están ordenadas correctamente

---

### 6. Verificar Mapa Interactivo

**Pasos:**
1. En la sección "Mapa Geográfico"
2. Verificar que el mapa muestra:
   - Mapa centrado en Coquimbo/La Serena
   - Puntos de colores según categoría:
     - Rojo: Casos Agudos
     - Rosa: Gestantes
     - Verde: Bajo Control
     - Azul: Persona
   - Leyenda de categorías en la parte superior
3. Hacer clic en un punto del mapa
4. **Resultado esperado:**
   - Se abre un popup mostrando:
     - Comuna
     - Provincia
     - Categoría
   - NO muestra: nombre, RUT, teléfono (datos sensibles)
5. Probar el filtro "Límite de puntos":
   - Cambiar a "500" → Carga hasta 500 puntos
   - Cambiar a "1000" → Carga hasta 1000 puntos
   - Cambiar a "2000" → Carga hasta 2000 puntos
6. **Resultado esperado:**
   - El mapa se actualiza al cambiar el límite
   - Los puntos se cargan correctamente

---

### 7. Verificar Manejo de Errores

**Pasos:**
1. Desconectar internet temporalmente
2. Recargar la página del dashboard
3. **Resultado esperado:**
   - Se muestran mensajes de error claros
   - No se rompe la aplicación
   - Los componentes muestran estados de error apropiados

---

### 8. Verificar Cerrar Sesión

**Pasos:**
1. Hacer clic en el botón "Cerrar Sesión"
2. **Resultado esperado:**
   - Se cierra la sesión
   - Redirige a `/login`
   - No se puede acceder a `/dashboard` sin volver a hacer login

---

## Casos de Prueba Adicionales

### Caso 1: Datos Vacíos
- Si las tablas en Supabase están vacías, el dashboard debe mostrar:
  - KPIs con valor 0
  - Gráficos con mensaje "No hay datos disponibles"
  - Mapa sin puntos (o mensaje apropiado)

### Caso 2: Datos con Valores Nulos
- Verificar que el sistema maneja correctamente:
  - Comunas NULL o vacías (no aparecen en el gráfico)
  - Coordenadas NULL (no aparecen en el mapa)
  - Fechas NULL (no aparecen en los gráficos temporales)

### Caso 3: Rendimiento
- Con muchos datos (ej: 2000 puntos en el mapa):
  - El mapa debe cargar sin congelar el navegador
  - Los gráficos deben renderizarse rápidamente
  - La página debe seguir siendo interactiva

---

## Notas Importantes

- **Seguridad:** Verificar que no se exponen datos sensibles (RUT, teléfono, nombre completo)
- **RLS:** Las funciones RPC deben validar autenticación (auth.uid() IS NOT NULL)
- **Permisos:** Solo usuarios autenticados pueden ejecutar las funciones RPC
- **Formato:** Los números deben mostrarse con formato chileno (separadores de miles)

---

## Solución de Problemas Comunes

### Error: "Usuario no autenticado"
- **Causa:** La función RPC no detecta la sesión
- **Solución:** Verificar que el usuario está logueado y que las funciones tienen SECURITY DEFINER

### Error: "No se recibieron datos del servidor"
- **Causa:** La función RPC retorna NULL o error
- **Solución:** Verificar que las tablas tienen datos y que las funciones SQL están correctas

### Mapa no carga
- **Causa:** Problema con Leaflet o coordenadas inválidas
- **Solución:** Verificar que los puntos tienen lat/lng válidos (entre -90/90 y -180/180)

### Gráficos vacíos
- **Causa:** No hay datos en el período seleccionado
- **Solución:** Verificar que hay datos en las tablas para el rango de fechas
