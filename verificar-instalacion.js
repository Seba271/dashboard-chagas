/**
 * Script de verificación de instalación
 * 
 * Ejecuta este script después de instalar Node.js para verificar
 * que todo esté configurado correctamente.
 * 
 * Uso: node verificar-instalacion.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando instalación del proyecto...\n');

let errores = [];
let advertencias = [];

// Verificar Node.js
console.log('1. Verificando Node.js...');
const nodeVersion = process.version;
console.log(`   ✅ Node.js ${nodeVersion} instalado`);

// Verificar npm
console.log('\n2. Verificando npm...');
try {
  const { execSync } = require('child_process');
  const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
  console.log(`   ✅ npm ${npmVersion} instalado`);
} catch (error) {
  errores.push('npm no está disponible');
  console.log('   ❌ npm no está disponible');
}

// Verificar package.json
console.log('\n3. Verificando package.json...');
if (fs.existsSync('package.json')) {
  console.log('   ✅ package.json encontrado');
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    console.log(`   ✅ Proyecto: ${packageJson.name}`);
  } catch (error) {
    errores.push('package.json está corrupto');
    console.log('   ❌ package.json está corrupto');
  }
} else {
  errores.push('package.json no encontrado');
  console.log('   ❌ package.json no encontrado');
}

// Verificar node_modules
console.log('\n4. Verificando dependencias...');
if (fs.existsSync('node_modules')) {
  console.log('   ✅ node_modules encontrado (dependencias instaladas)');
  
  // Verificar dependencias críticas
  const dependenciasCriticas = ['next', 'react', '@supabase/supabase-js'];
  dependenciasCriticas.forEach(dep => {
    if (fs.existsSync(`node_modules/${dep}`)) {
      console.log(`   ✅ ${dep} instalado`);
    } else {
      advertencias.push(`${dep} no está instalado`);
      console.log(`   ⚠️  ${dep} no está instalado`);
    }
  });
} else {
  advertencias.push('node_modules no encontrado - ejecuta: npm install');
  console.log('   ⚠️  node_modules no encontrado');
  console.log('   💡 Ejecuta: npm install');
}

// Verificar .env.local
console.log('\n5. Verificando variables de entorno...');
if (fs.existsSync('.env.local')) {
  console.log('   ✅ .env.local encontrado');
  
  // Leer y verificar variables
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const tieneUrl = envContent.includes('NEXT_PUBLIC_SUPABASE_URL');
  const tieneKey = envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  if (tieneUrl && tieneKey) {
    console.log('   ✅ Variables de Supabase configuradas');
    
    // Verificar que no sean valores de ejemplo
    if (envContent.includes('tu-proyecto.supabase.co') || 
        envContent.includes('tu_anon_key_aqui')) {
      advertencias.push('Las variables de entorno parecen ser valores de ejemplo');
      console.log('   ⚠️  Las variables parecen ser valores de ejemplo');
      console.log('   💡 Actualiza .env.local con tus credenciales reales de Supabase');
    }
  } else {
    advertencias.push('Faltan variables de Supabase en .env.local');
    console.log('   ⚠️  Faltan variables de Supabase');
  }
} else {
  advertencias.push('.env.local no encontrado');
  console.log('   ⚠️  .env.local no encontrado');
  console.log('   💡 Crea .env.local con tus credenciales de Supabase');
  console.log('   💡 Ver: ENV_SETUP.md para instrucciones');
}

// Verificar estructura de carpetas
console.log('\n6. Verificando estructura del proyecto...');
const carpetasNecesarias = ['app', 'lib'];
carpetasNecesarias.forEach(carpeta => {
  if (fs.existsSync(carpeta)) {
    console.log(`   ✅ ${carpeta}/ encontrado`);
  } else {
    errores.push(`Carpeta ${carpeta}/ no encontrada`);
    console.log(`   ❌ ${carpeta}/ no encontrado`);
  }
});

// Resumen
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMEN');
console.log('='.repeat(50));

if (errores.length === 0 && advertencias.length === 0) {
  console.log('\n✅ ¡Todo está configurado correctamente!');
  console.log('\n🚀 Puedes ejecutar el proyecto con:');
  console.log('   npm run dev');
} else {
  if (errores.length > 0) {
    console.log('\n❌ ERRORES ENCONTRADOS:');
    errores.forEach(error => console.log(`   - ${error}`));
  }
  
  if (advertencias.length > 0) {
    console.log('\n⚠️  ADVERTENCIAS:');
    advertencias.forEach(advertencia => console.log(`   - ${advertencia}`));
  }
  
  console.log('\n💡 Revisa los archivos de documentación:');
  console.log('   - GUIA_INSTALACION.md');
  console.log('   - PASOS_SIGUIENTES.md');
  console.log('   - ENV_SETUP.md');
}

console.log('\n');




