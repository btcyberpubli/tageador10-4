// --- Módulo para tagear chats ---
console.log('📦 [chatTagger] Iniciando carga...');

// 🔧 FUNCIÓN HELPER: Scrollear de manera inteligente hasta el TOPE
// ✅ MEJORADO: Tiempos aumentados para garantizar carga completa
async function scrollearMensajesAlTopeInteligente() {
  const messagesContainer = document.querySelector('.MuiBox-root.mui-ylizsf');
  
  if (!messagesContainer) {
    console.error('❌ Contenedor no encontrado');
    return;
  }
  
  console.log('🔍 Iniciando scroll inteligente al TOPE...');
  console.log(`📊 Posición inicial: ${messagesContainer.scrollTop}px`);
  
  let scrollAnterior = messagesContainer.scrollTop;
  let intentosSinCambio = 0;
  let intento = 0;
  const maxIntentos = 60; // Aumentado de 50 a 60
  
  while (intento < maxIntentos) {
    intento++;
    
    // Scrollear
    messagesContainer.scrollTop = 0;
    
    // ⏱️ ESPERA AUMENTADA para que Clientify virtualice el contenido
    // En chats largos, Clientify carga dinámicamente - necesita más tiempo
    const tiempoEspera = intento < 10 ? 300 : 500; // Primeros intentos 300ms, luego 500ms
    await new Promise(r => setTimeout(r, tiempoEspera));
    
    const scrollActual = messagesContainer.scrollTop;
    const cambio = scrollAnterior - scrollActual;
    
    console.log(`  Intento ${intento}: Scroll = ${scrollActual}px | Cambio = ${cambio}px | Espera: ${tiempoEspera}ms`);
    
    // ✅ DETECCIÓN INTELIGENTE: Si no cambió, ya no se puede scrollear más
    if (scrollAnterior === scrollActual) {
      intentosSinCambio++;
      
      if (intentosSinCambio >= 4) { // Aumentado de 3 a 4 para mayor confiabilidad
        console.log(`\n✅ ¡DETECTADO! Ya no se puede scrollear más (${intentosSinCambio} intentos sin cambio)`);
        console.log(`📍 Posición final: ${scrollActual}px`);
        console.log(`🎯 ¡Llegamos al TOPE de la conversación COMPLETAMENTE CARGADA!`);
        
        // ⏱️ ESPERA FINAL: Asegurarse que todo está renderizado
        console.log(`   ⏳ Esperando 2 segundos para confirmación de carga...`);
        await new Promise(r => setTimeout(r, 2000));
        
        return true;
      }
    } else {
      intentosSinCambio = 0; // Resetear contador si hubo cambio
    }
    
    scrollAnterior = scrollActual;
  }
  
  console.warn(`⚠️ Se alcanzó el máximo de intentos (${maxIntentos})`);
  console.log(`   ⚠️ POSIBLE CHAT MUY LARGO - Procediendo de todas formas`);
  return false;
}

const chatTagger = {
  stopProcess: false,
  scrollTimeoutId: null,
  
  scrollAndTagChats() {
    try {
      // ✅ Verificar que chatOpener está disponible (defensa contra race conditions)
      if (!window.chatOpener || typeof window.chatOpener.getFirst25ChatsWithoutScroll !== 'function') {
        console.error('❌ [Tagear] chatOpener no está disponible, reintentando en 300ms...');
        setTimeout(() => this.scrollAndTagChats(), 300);
        return;
      }

      const chatDivs = window.chatOpener.getFirst25ChatsWithoutScroll();
      console.log(`🚀 [Tagear] Iniciando tageo de ${chatDivs.length} chats sin scroll`);
      if (chatDivs.length === 0) {
        console.warn("⚠️ No se encontraron chats con emoji 🕐.");
        return;
      }
      this.iterateTagChats(chatDivs);
    } catch (error) {
      console.error('❌ [Tagear] Error en scrollAndTagChats:', error);
      setTimeout(() => this.scrollAndTagChats(), 300);
    }
  },
  
  iterateTagChats(chatDivs) {
    let index = 0;
    const self = this;
    
    async function procesarChat() {
      if (self.stopProcess) {
        console.log("⏹️ Proceso de tagear detenido por el usuario.");
        return;
      }
      
      if (index >= chatDivs.length) {
        console.log("✅ Terminó de tagear todos los chats.");
        return;
      }
      
      const chat = chatDivs[index];
      const chatNum = index + 1;
      const totalChats = chatDivs.length;
      
      console.log(`\n${'='.repeat(50)}`);
      console.log(`📌 PROCESANDO CHAT ${chatNum}/${totalChats}`);
      console.log(`${'='.repeat(50)}`);
      
      if (!chat) {
        console.warn(`❌ Chat ${chatNum}: Div NO está disponible`);
        index++;
        setTimeout(procesarChat, 3000);
        return;
      }
      
      // PASO 1: Click en el chat
      console.log(`1️⃣ STEP 1: Clickeando chat ${chatNum}...`);
      chat.scrollIntoView({ behavior: "smooth", block: "center" });
      chat.click();
      
      // Esperar a que se cargue el chat
      setTimeout(async () => {
        console.log(`   ⏳ Esperando a que cargue el contenido del chat...`);
        
        // PASO 2: Verificar que el chat se abrió
        let chatCargado = false;
        for (let intento = 0; intento < 5; intento++) {
          const chatWindow = document.querySelector('.mui-npbckn');
          if (chatWindow) {
            console.log(`   ✅ Chat window cargada en intento ${intento + 1}`);
            chatCargado = true;
            break;
          }
          await new Promise(r => setTimeout(r, 1000));
        }
        
        if (!chatCargado) {
          console.error(`   ❌ No se pudo cargar el chat window`);
          index++;
          setTimeout(procesarChat, 3000);
          return;
        }
        
        // PASO 3: Scrollear al TOPE de manera inteligente
        console.log(`2️⃣ STEP 2: Iniciando scroll inteligente al TOPE...`);
        const resultadoScroll = await scrollearMensajesAlTopeInteligente();
        if (resultadoScroll) {
          console.log(`✅ Scroll completado exitosamente - Chat completamente cargado`);
        } else {
          console.warn(`⚠️ Scroll completado pero con limitaciones - Chat muy largo`);
        }
        
        // ⏱️ ESPERA AUMENTADA: Crítico para garantizar que Clientify virtualizó todo el contenido
        console.log(`   ⏳ Esperando estabilización del DOM (3 segundos)...`);
        await new Promise(r => setTimeout(r, 3000));
        console.log(`   ✅ DOM estabilizado. Proceediendo a extraer información...`);
        
        // PASO 4: Extraer información (con reintentos) (con reintentos por si el DOM no estaba listo)
        console.log(`3️⃣ STEP 3: Extrayendo información del chat...`);
        let urlInfo = null;
        let intentosExtraccion = 0;
        const maxIntentosExtraccion = 3;
        
        while (!urlInfo && intentosExtraccion < maxIntentosExtraccion) {
          intentosExtraccion++;
          urlInfo = await window.urlDetector.extractUrlFromChat();
          
          if (!urlInfo) {
            console.warn(`   ⚠️ Intento ${intentosExtraccion}/${maxIntentosExtraccion}: No se obtuvo información`);
            if (intentosExtraccion < maxIntentosExtraccion) {
              // ⏱️ ESPERA AUMENTADA: Si no extrae URL en primer intento, esperar más
              await new Promise(r => setTimeout(r, 2500));
            }
          }
        }
        
        if (!urlInfo) {
          console.warn(`   ❌ No se pudo obtener información después de ${maxIntentosExtraccion} intentos`);
          index++;
          setTimeout(procesarChat, 3500);
          return;
        }
        
        console.log(`   ✅ urlInfo obtenida:`);
        console.log(`      - Panel: ${urlInfo.panel || 'sin panel'}`);
        console.log(`      - URL: ${urlInfo.url || 'sin URL'}`);
        console.log(`      - URLs de hoy: ${urlInfo.urlsDeHoy ? urlInfo.urlsDeHoy.length : 0}`);
        console.log(`      - Nomenclatura: ${urlInfo.nomenclatura || 'SIN NOMENCLATURA'}`);
        
        if (!urlInfo.nomenclatura) {
          console.log(`⏭️ Chat ${chatNum}: SALTADO - No tiene nomenclatura`);
          index++;
          setTimeout(procesarChat, 2500);
          return;
        }
        
        const nomenclatura = urlInfo.nomenclatura;
        console.log(`✅ Usando nomenclatura: "${nomenclatura}"`);
        
        // ⏱️ ESPERA AUMENTADA: Asegurar que el DOM está completamente listo antes de editar
        await new Promise(r => setTimeout(r, 1500));
        
        // PASO 5: Buscar sección Observaciones
        console.log(`4️⃣ STEP 4: Buscando sección "Observaciones"...`);
        const obsP = Array.from(document.querySelectorAll('p')).find(
          p => /Observaci[oó]n(es)?/i.test(p.textContent)
        );
        
        if (!obsP) {
          console.warn(`   ❌ NO se encontró sección "Observaciones"`);
          index++;
          setTimeout(procesarChat, 3000);
          return;
        }
        
        console.log(`   ✅ Sección Observaciones encontrada`);
        
        // PASO 6: Buscar botón de edición con reintentos
        console.log(`5️⃣ STEP 5: Buscando botón de edición...`);
        
        // Simular hover para que aparezca el botón
        obsP.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        
        // ⏱️ ESPERA AUMENTADA: Clientify necesita tiempo para mostrar el botón
        await new Promise(r => setTimeout(r, 1000));
        
        let editBtn = null;
        for (let intento = 0; intento < 10; intento++) {
          await new Promise(r => setTimeout(r, 500));
          editBtn = obsP.querySelector('button.btn-edit');
          if (editBtn) {
            console.log(`   ✅ Botón de edición encontrado en intento ${intento + 1}`);
            break;
          }
        }
        
        if (!editBtn) {
          console.warn(`   ❌ NO se encontró botón de edición`);
          index++;
          setTimeout(procesarChat, 3000);
          return;
        }
        
        // PASO 7: Click en botón de edición
        console.log(`6️⃣ STEP 6: Clickeando botón de edición...`);
        editBtn.click();
        
        // PASO 8: Buscar textarea
        console.log(`7️⃣ STEP 7: Buscando textarea para editar...`);
        
        let textarea = null;
        for (let intento = 0; intento < 10; intento++) {
          await new Promise(r => setTimeout(r, 500));
          textarea = document.querySelector('textarea.mui-16j0ffk');
          if (textarea) {
            console.log(`   ✅ Textarea encontrado en intento ${intento + 1}`);
            break;
          }
        }
        
        if (!textarea) {
          console.error(`   ❌ NO se encontró textarea tras 10 intentos`);
          index++;
          setTimeout(procesarChat, 3000);
          return;
        }
        
        // 🧰 FUNCIÓN HELPER: Extraer letra del código
        function extraerLetraDeCodigo(codigo) {
          // Formato: DD-MM-ID[LETRA][!]
          // Ejemplos: "01-04-47A", "01-04-47A!", "01-04-47"
          const match = codigo.match(/([A-Z])!?$/);
          return match ? match[1] : null;
        }
        
        // PASO 9: Modificar el textarea (LÓGICA CONSERVADORA - SOLO AGREGAR, NUNCA REEMPLAZAR)
        console.log(`8️⃣ STEP 8: Analizando etiquetas existentes...`);
        
        const actual = textarea.value.trim();
        let codigos = actual.split(',').map(c => c.trim()).filter(c => c.length > 0);
        
        console.log(`   📌 Etiquetas actuales: [${codigos.join(', ') || 'ninguna'}]`);
        console.log(`   ➕ Etiqueta a AGREGAR: "${nomenclatura}"`);
        
        let seGuardó = false;
        
        // 🔍 VERIFICACIÓN EXACTA: ¿Ya existe exactamente esta etiqueta?
        const yaExisteExactamente = codigos.some(codigo => codigo === nomenclatura);
        
        if (yaExisteExactamente) {
          console.log(`   ✅ Esta etiqueta YA existe exactamente: "${nomenclatura}"`);
          console.log(`   → Sin cambios (evitando duplicado)`);
          seGuardó = false; // No hay cambios
        } else {
          // 🆕 Etiqueta nueva - AGREGAR sin cuestionar (SOLUCIÓN INTEGRAL)
          console.log(`   ✅ Etiqueta nueva - AGREGANDO sin reemplazar nada`);
          codigos.push(nomenclatura);
          seGuardó = true;
          
          // 🧹 POST-PROCESAMIENTO MÍNIMO: Solo eliminar exactos duplicados (strings idénticos)
          // No modificar nada que otra máquina haya puesto
          console.log(`   🧹 Verificando duplicados exactos...`);
          const codigosUnicos = [];
          
          for (const codigo of codigos) {
            // Si NO está en la lista de únicos, agregarlo
            if (!codigosUnicos.includes(codigo)) {
              codigosUnicos.push(codigo);
            } else {
              console.log(`      ⚠️ Eliminando duplicado exacto: "${codigo}"`);
            }
          }
          
          if (codigosUnicos.length !== codigos.length) {
            console.log(`   ✅ Se eliminaron ${codigos.length - codigosUnicos.length} duplicados exactos`);
          } else {
            console.log(`   ✅ Sin duplicados exactos`);
          }
          
          codigos = codigosUnicos;
        }
        
        // PASO 10: Guardar si hay cambios
        if (!seGuardó) {
          console.log(`9️⃣ STEP 9: Sin cambios, cerrando sin guardar...`);
          const cancelBtn = document.querySelector('button[aria-label="Cancelar"]');
          if (cancelBtn) {
            cancelBtn.click();
            console.log(`   ✅ Modal cerrada`);
          }
        } else {
          console.log(`9️⃣ STEP 9: Guardando cambios...`);
          const nuevoValor = codigos.join(', ');
          textarea.value = nuevoValor;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          console.log(`   📝 Nuevo valor guardado: [${nuevoValor}]`);
          
          // Esperar a que se procese el change
          await new Promise(r => setTimeout(r, 500));
          
          // ⌨️ Forzar focus + Enter (cuando el CRM es caprichoso)
          console.log(`🔟 STEP 10: Simulando Enter completo...`);
          
          // 1. Forzar focus en el textarea
          textarea.focus();
          console.log(`   ✅ Textarea enfocado, valor: "${textarea.value}"`);
          
          // 2. Simular Enter con keydown + keypress + keyup
          textarea.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          
          textarea.dispatchEvent(new KeyboardEvent('keypress', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            charCode: 13,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          
          textarea.dispatchEvent(new KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          
          console.log(`   ⌨️ Eventos keydown + keypress + keyup despachados`);
          
          // 3. Esperar a que se procese
          await new Promise(r => setTimeout(r, 300));
          
          // 4. Enviar input + change
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`   ✅ Eventos input + change despachados`);
          
          // Esperar a que se guarde
          await new Promise(r => setTimeout(r, 2000));
          console.log(`✅ Chat ${chatNum}: PROCESADO Y GUARDADO ✓`);
        }
        }
        
        // PASO 11: Siguiente chat
        console.log(`\n⏳ Esperando antes del siguiente chat...`);
        index++;
        setTimeout(procesarChat, 3000);
        
      }, 2000); // Espera inicial después del click
    }
    
    procesarChat();
  },
  
  startTagIteration() {
    console.log('🏷️ Iniciando proceso de tageo automático con nomenclaturas del observer...');
    this.stopProcess = false;
    this.scrollAndTagChats();
  },
  
  stopTagIteration() {
    this.stopProcess = true;
    if (this.scrollTimeoutId) {
      clearTimeout(this.scrollTimeoutId);
      this.scrollTimeoutId = null;
      console.log("⏹️ [Tagear] Scroll automático detenido.");
    }
  }
};

// ✅ Hacer disponible globalmente
window.chatTagger = chatTagger;
console.log('✅ [chatTagger] Cargado y disponible en window.chatTagger');
