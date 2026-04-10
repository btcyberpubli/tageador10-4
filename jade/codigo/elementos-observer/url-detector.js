// ============================================
// URL DETECTOR - Extractor de URLs de mensajes
// ============================================

// Configuración de paneles (ID y nombres)
// Se usa búsqueda parcial para soportar variantes como "Goatgaming" y "Goatgaming2"
let PANELES_CONFIG = [
  {id: 10, nombres: ["Goatgaming", "Goatgaming2"]},
  {id: 12, nombres: ["ThiagoP", "ThiagoP2"]},
  {id: 1, nombres: ["Oporto"]},
  {id: 18, nombres: ["PruebaPY"]},
  {id: 22, nombres: ["Prueba2"]},
  {id: 23, nombres: ["TestRespond"]},
  {id: 24, nombres: ["Manga"]},
  {id: 26, nombres: ["Scalo"]},
  {id: 27, nombres: ["Pruebagg"]},
  {id: 5, nombres: ["Trebol", "Treboldorado", "Treboldorado2"]},
  {id: 20, nombres: ["Cocan"]},
  {id: 16, nombres: ["Escaloneta"]},
  {id: 32, nombres: ["Opulix"]},
  {id: 19, nombres: ["Denver"]},
  {id: 33, nombres: ["Godzilla"]},
  {id: 34, nombres: ["Nova"]},
  {id: 35, nombres: ["Martina"]},
  {id: 36, nombres: ["Florida"]}
];

// URL de la API para obtener paneles
const PANELES_API_URL = 'https://accountant-services.co.uk/paneles/?secret=tu_clave_super_secreta';

window.urlDetector = {
  panelesCache: null, // Cache SOLO en memoria de la API
  cacheTimestamp: null, // Timestamp del último cargue
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutos de duración de cache
  
  /**
   * Carga los paneles desde la API a través del service worker
   * (evita restricciones de CORS usando el background.js)
   * @returns {Promise<Array>}
   */
  async cargarPanelesDesdeAPI() {
    try {
      console.log('🔄 Solicitando paneles al service worker...');
      
      // Enviar mensaje al background.js para que haga el fetch
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: "obtenerPaneles" },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success) {
              resolve(response.paneles);
            } else {
              reject(new Error('Respuesta inválida del background'));
            }
          }
        );
      });
      
      if (response && Array.isArray(response) && response.length > 0) {
        this.panelesCache = response;
        this.cacheTimestamp = Date.now();
        console.log(`✅ ${response.length} paneles cargados desde API`);
        return response;
      }
      
      console.warn('⚠️ No se obtuvieron paneles');
      return this.panelesCache || [];
    } catch (error) {
      console.error('❌ Error consultando API de paneles:', error);
      console.log('⚠️ Usando cache anterior como fallback');
      return this.panelesCache || [];
    }
  },
  
  /**
   * Busca un panel por nombre consultando SIEMPRE la API primero
   * @param {string} nombreNormalizado - Nombre del panel normalizado
   * @returns {Promise<Object|null>} {id, nombre} o null si no se encuentra
   */
  async buscarPanelPorNombre(nombreNormalizado) {
    // 1. SIEMPRE consultar la API para tener datos actualizados
    console.log(`🔍 Buscando panel "${nombreNormalizado}"...`);
    const panelesAPI = await this.cargarPanelesDesdeAPI();
    
    // 2. PRIMERO: Buscar coincidencia EXACTA en la API
    for (const panel of panelesAPI) {
      // El servidor devuelve panel.nombre (singular, string), no panel.nombres (array)
      const nombre = panel.nombre;
      if (nombreNormalizado.toLowerCase() === nombre.toLowerCase()) {
        console.log(`✅ Panel encontrado (EXACTO) en API: ${nombre} (ID: ${panel.id})`);
        return { id: panel.id, nombre: nombre };
      }
    }
    
    // 3. SEGUNDO: Buscar coincidencia PARCIAL en la API (solo si el buscado es más largo)
    for (const panel of panelesAPI) {
      const nombre = panel.nombre;
      // Solo coincidir si el nombre buscado CONTIENE el nombre del panel
      // (no al revés) para evitar "Escaloneta" → "Scalo"
      if (nombreNormalizado.toLowerCase().includes(nombre.toLowerCase()) && 
          nombre.toLowerCase().length >= 4) { // Mínimo 4 caracteres para evitar falsos positivos
        console.log(`✅ Panel encontrado (PARCIAL) en API: ${nombre} (ID: ${panel.id})`);
        return { id: panel.id, nombre: nombre };
      }
    }
    
    // 4. FALLBACK: Si no está en API, buscar en configuración local
    console.log(`⚠️ Panel no encontrado en API, buscando en configuración local...`);
    for (const panel of PANELES_CONFIG) {
      // Si PANELES_CONFIG también usa nombres (plural), mantener ese formato
      const nombres = Array.isArray(panel.nombres) ? panel.nombres : [panel.nombre];
      for (const nombre of nombres) {
        if (nombreNormalizado.toLowerCase() === nombre.toLowerCase()) {
          console.log(`✅ Panel encontrado localmente (EXACTO): ${nombre} (ID: ${panel.id})`);
          return { id: panel.id, nombre: nombre };
        }
      }
    }
    
    for (const panel of PANELES_CONFIG) {
      const nombres = Array.isArray(panel.nombres) ? panel.nombres : [panel.nombre];
      for (const nombre of nombres) {
        if (nombreNormalizado.toLowerCase().includes(nombre.toLowerCase()) && 
            nombre.toLowerCase().length >= 4) {
          console.log(`✅ Panel encontrado localmente (PARCIAL): ${nombre} (ID: ${panel.id})`);
          return { id: panel.id, nombre: nombre };
        }
      }
    }
    
    return null; // No encontrado
  },
  
  /**
   * Extrae TODAS las URLs de Meta del chat que sean de HOY
   * Si no hay URLs pero el primer mensaje es de hoy, genera nomenclatura sin letra
   * @returns {Object|null} {url, panel, timestamp, nomenclatura, urlsDeHoy}
   */
  async extractUrlFromChat() {
    // Verificar que hay un chat abierto
    const chatWindow = document.querySelector('.mui-npbckn');
    if (!chatWindow) {
      console.warn('❌ [URL Detector] No hay chat window abierto');
      return null;
    }
    
    // 🚨 PRIMER PASO: Detectar si hay caída (Business Account locked) - CASE INSENSITIVE
    const messagesContainer = document.querySelector('.MuiBox-root.mui-ylizsf');
    if (messagesContainer) {
      const textoContenedor = (messagesContainer.innerText || messagesContainer.textContent || '').toLowerCase();
      if (textoContenedor.includes('business account locked')) {
        console.log('🚨 [URL Detector] ¡DETECTADA CAÍDA DE CUENTA! "Business Account locked"');
        // Procesar la alerta
        if (typeof window.alertManager !== 'undefined' && typeof window.alertManager.procesarCaida === 'function') {
          await window.alertManager.procesarCaida();
        }
        return { caida: true }; // Retornar flag para que observer salte este chat
      }
    }
    
    const panel = this.getPanelName();
    console.log(`📋 [URL Detector] Panel detectado: "${panel}"`);
    
    // Buscar TODOS los mensajes con URLs de Meta que sean de HOY
    const urlsDeHoy = this.getAllMetaUrlsFromToday();
    console.log(`🔗 [URL Detector] URLs de Meta encontradas: ${urlsDeHoy.length}`);
    
    // Si no hay URLs de Meta, verificar si el PRIMER mensaje es de hoy
    if (urlsDeHoy.length === 0) {
      console.log(`⚠️ [URL Detector] Sin URLs de Meta, buscando primer mensaje...`);
      const primerMensajeInfo = this.getFirstMessageTime();
      
      if (!primerMensajeInfo) {
        console.warn('❌ [URL Detector] No se pudo obtener tiempo del primer mensaje');
        return null;
      }
      
      console.log(`   Primer mensaje timestamp: "${primerMensajeInfo.fullTimestamp}"`);
      console.log(`   Relative time: "${primerMensajeInfo.relativeTime}"`);
      
      if (this.esMensajeDeHoy(primerMensajeInfo) || this.esDelDiaAnterior(primerMensajeInfo)) {
        console.log('✅ [URL Detector] Primer mensaje es de HOY o del día anterior - Generando nomenclatura sin URL');
        
        // Generar nomenclatura sin letra de campaña, usando la fecha del primer mensaje
        const nomenclaturaBase = await this.generarNomenclatura(panel, primerMensajeInfo);
        
        // Verificar si el cliente cargó
        const clienteCargo = this.detectarMensajeDeCarga();
        const nomenclaturaFinal = clienteCargo ? `${nomenclaturaBase}!` : nomenclaturaBase;
        
        const estadoCarga = clienteCargo ? '✅ CARGÓ' : '⏳ Pendiente';
        console.log(`🏷️ ${nomenclaturaFinal} [Sin URL] | ${estadoCarga}`);
        
        return {
          url: 'Sin URL',
          urlsDeHoy: [],
          cantidadUrlsHoy: 0,
          nomenclatura: nomenclaturaFinal,
          panelOriginal: panel || 'Sin panel',
          timestamp: primerMensajeInfo.fullTimestamp,
          relativeTime: primerMensajeInfo.relativeTime,
          calculatedTime: primerMensajeInfo.calculatedTime,
          letraCampana: null,
          tieneCampana: false,
          clienteCargo: clienteCargo
        };
      } else {
        console.warn(`❌ [URL Detector] Primer mensaje NO es de HOY ni del día anterior - Saltando chat`);
        console.warn(`   Timestamp: "${primerMensajeInfo.fullTimestamp}"`);
        return null;
      }
    }
    
    console.log(`✅ [URL Detector] Encontradas ${urlsDeHoy.length} URLs de Meta de HOY`);
    
    // Generar nomenclatura base (sin letra de campaña), usando la fecha de la primera URL
    const timeInfoPrimeraUrl = urlsDeHoy[0].timeInfo;
    const nomenclaturaBase = await this.generarNomenclatura(panel, timeInfoPrimeraUrl);
    
    // Verificar si el cliente cargó (mensaje de acreditación)
    const clienteCargo = this.detectarMensajeDeCarga();
    
    // Generar nomenclatura para CADA URL diferente
    const nomenclaturas = [];
    const urlsUnicas = new Map(); // Para evitar URLs duplicadas
    
    for (let i = 0; i < urlsDeHoy.length; i++) {
      const urlItem = urlsDeHoy[i];
      
      // Evitar URLs duplicadas
      if (urlsUnicas.has(urlItem.url)) continue;
      urlsUnicas.set(urlItem.url, true);
      
      // Obtener letra de campaña para esta URL (ahora async)
      const letraCampana = await urlMapper.getLetraCampana(urlItem.url, panel);
      
      // Si no tiene letra, esperar (pausar observer)
      if (!letraCampana) {
        // La primera URL sin letra pausa todo
        const result = {
          url: urlItem.url,
          urlsDeHoy: urlsDeHoy,
          cantidadUrlsHoy: urlsDeHoy.length,
          nomenclatura: nomenclaturaBase, // Sin letra aún
          panelOriginal: panel || 'Sin panel',
          timestamp: urlItem.timeInfo?.fullTimestamp || 'Sin timestamp',
          relativeTime: urlItem.timeInfo?.relativeTime || 'Sin hora',
          calculatedTime: urlItem.timeInfo?.calculatedTime || 'Sin hora calculada',
          letraCampana: null,
          tieneCampana: false,
          clienteCargo: clienteCargo
        };
        
        console.log(`⏸️ [URL Detector] URL sin letra, pausando...`);
        return result;
      }
      
      // Construir nomenclatura completa
      const nomenclaturaCompleta = `${nomenclaturaBase}${letraCampana}`;
      
      // Solo la PRIMERA nomenclatura lleva signo si hay carga
      const esPrimera = i === 0;
      const nomenclaturaFinal = (clienteCargo && esPrimera) 
        ? `${nomenclaturaCompleta}!`
        : nomenclaturaCompleta;
      
      nomenclaturas.push({
        nomenclatura: nomenclaturaFinal,
        letra: letraCampana,
        url: urlItem.url,
        tieneCarga: clienteCargo && esPrimera
      });
    }
    
    // Usar la primera URL como principal
    const urlPrincipal = urlsDeHoy[0].url;
    const timeInfo = urlsDeHoy[0].timeInfo;
    
    const result = {
      url: urlPrincipal,
      urlsDeHoy: urlsDeHoy,
      cantidadUrlsHoy: urlsDeHoy.length,
      nomenclatura: nomenclaturas[0].nomenclatura, // Primera nomenclatura (para compatibilidad)
      nomenclaturas: nomenclaturas, // TODAS las nomenclaturas generadas
      panelOriginal: panel || 'Sin panel',
      timestamp: timeInfo?.fullTimestamp || 'Sin timestamp',
      relativeTime: timeInfo?.relativeTime || 'Sin hora',
      calculatedTime: timeInfo?.calculatedTime || 'Sin hora calculada',
      letraCampana: nomenclaturas[0].letra,
      tieneCampana: true,
      clienteCargo: clienteCargo
    };
    
    // Log simplificado
    const estadoCarga = clienteCargo ? '✅ CARGÓ' : '⏳ Pendiente';
    const nomenclaturasStr = nomenclaturas.map(n => n.nomenclatura).join(', ');
    console.log(`🏷️ ${nomenclaturasStr} | ${urlsDeHoy.length} URL(s) de hoy | ${estadoCarga}`);
    
    return result;
  },
  
  /**
   * Detecta si hay mensaje de carga (acreditación) en la conversación
   * Busca solo en mensajes del agente de HOY
   * @returns {boolean}
   */
  detectarMensajeDeCarga() {
    console.log('🔍 [Carga] Iniciando detección de mensaje de carga...');
    const messagesContainer = document.querySelector('.MuiBox-root.mui-ylizsf');
    if (!messagesContainer) {
      console.log('❌ [Carga] No se encontró el contenedor de mensajes');
      return false;
    }
    
    // Función auxiliar para normalizar texto (eliminar tildes y caracteres especiales)
    const normalizarTexto = (texto) => {
      return texto
        .toLowerCase()
        // Eliminar tildes y acentos
        .replace(/á/g, 'a').replace(/à/g, 'a').replace(/ä/g, 'a').replace(/â/g, 'a')
        .replace(/é/g, 'e').replace(/è/g, 'e').replace(/ë/g, 'e').replace(/ê/g, 'e')
        .replace(/í/g, 'i').replace(/ì/g, 'i').replace(/ï/g, 'i').replace(/î/g, 'i')
        .replace(/ó/g, 'o').replace(/ò/g, 'o').replace(/ö/g, 'o').replace(/ô/g, 'o')
        .replace(/ú/g, 'u').replace(/ù/g, 'u').replace(/ü/g, 'u').replace(/û/g, 'u')
        .replace(/ñ/g, 'n')
        // Reemplazar puntuación con espacio (importante: no remover, para evitar que palabras se junten)
        .replace(/[.,!?¿¡;:\-—–]/g, ' ')
        // Normalizar espacios en blanco
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    // Frases y palabras clave que indican carga
    // Se buscan en orden de especificidad (frases completas primero)
    const patronesDeteccion = [
      // Frase completa principal (con variantes de números y vocales)
      'segu(i|í) los pasos a continuaci(o|ó)n para que tu acr3dit4ci(o|ó|0)n se procese sin demoras',
      'segu(i|í) los pasos a continuaci(o|ó)n para que tu acr3dit4cion se procese sin demoras',
      'segu(i|í) los pasos a continuaci(o|ó)n para que tu acreditaci(o|ó)n se procese sin demoras',
      
      // Fragmentos más cortos y flexibles
      'segu(i|í) los pasos',
      'pasos a continuaci(o|ó)n',
      'para que tu acr3dit4ci(o|ó|0)',
      
      // Palabras clave individuales (como fallback) - incluyendo variantes con 0
      'acreditacion',
      'acredit4cion',
      'acredit4ci0n',
      'acr3digitaci(o|ó)n',
      'acr3dit4ci(o|ó|0)n',
      'acr3dit4cion',
      'acr3dit4ci0n'
    ];
    
    console.log(`🎯 [Carga] Buscando patrones de detección de carga...`);
    
    // Obtener TODOS los mensajes
    const allMessages = messagesContainer.querySelectorAll('div[id^="message-"]');
    console.log(`📊 [Carga] Total de mensajes encontrados: ${allMessages.length}`);
    
    for (const message of allMessages) {
      // Buscar la frase en TODO el texto del mensaje
      const textoCompleto = message.textContent || '';
      
      // Normalizar: quitar tildes, puntuación y espacios extra
      const textoNormalizado = normalizarTexto(textoCompleto);
      
      console.log(`📝 [Carga] Revisando mensaje: "${textoNormalizado.substring(0, 100)}"`);
      
      // Buscar cualquiera de los patrones
      for (const patron of patronesDeteccion) {
        // Crear regex más flexible que permita variaciones
        try {
          const regex = new RegExp(patron.replace(/\(/g, '(?:').replace(/\|/g, '|'), 'i');
          if (regex.test(textoNormalizado)) {
            console.log(`✅ [Carga] Patrón ENCONTRADO: "${patron}"`);
            return true;
          }
        } catch (e) {
          console.warn(`⚠️ [Carga] Error con patrón regex: ${patron}`, e);
        }
      }
    }
    
    console.log('❌ [Carga] Ninguna palabra clave de carga encontrada');
    return false;
  },

  /**
   * FUNCIÓN DE DEBUG: Prueba la detección de cargas con detalle
   * Ejecutar desde la consola del navegador: window.urlDetector.debugDetectarCarga()
   * Muestra TODOS los mensajes encontrados y por qué sí/no coinciden
   */
  debugDetectarCarga() {
    console.log('\n========== DEBUG DETECCIÓN DE CARGAS ==========\n');
    
    const messagesContainer = document.querySelector('.MuiBox-root.mui-ylizsf');
    if (!messagesContainer) {
      console.error('❌ NO SE ENCONTRÓ el contenedor de mensajes');
      console.log('Buscando: .MuiBox-root.mui-ylizsf');
      return;
    }
    
    console.log('✅ Contenedor de mensajes encontrado');
    
    // Función auxiliar para normalizar (igual que en detectarMensajeDeCarga)
    const normalizarTexto = (texto) => {
      return texto
        .toLowerCase()
        .replace(/á/g, 'a').replace(/à/g, 'a').replace(/ä/g, 'a').replace(/â/g, 'a')
        .replace(/é/g, 'e').replace(/è/g, 'e').replace(/ë/g, 'e').replace(/ê/g, 'e')
        .replace(/í/g, 'i').replace(/ì/g, 'i').replace(/ï/g, 'i').replace(/î/g, 'i')
        .replace(/ó/g, 'o').replace(/ò/g, 'o').replace(/ö/g, 'o').replace(/ô/g, 'o')
        .replace(/ú/g, 'u').replace(/ù/g, 'u').replace(/ü/g, 'u').replace(/û/g, 'u')
        .replace(/ñ/g, 'n')
        .replace(/[.,!?¿¡;:\-—–]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const patronesDeteccion = [
      'segu(i|í) los pasos a continuaci(o|ó)n para que tu acr3dit4ci(o|ó)n se procese sin demoras',
      'segu(i|í) los pasos a continuaci(o|ó)n para que tu acr3dit4cion se procese sin demoras',
      'segu(i|í) los pasos a continuaci(o|ó)n para que tu acreditaci(o|ó)n se procese sin demoras',
      'segu(i|í) los pasos',
      'pasos a continuaci(o|ó)n',
      'para que tu acr3dit4ci(o|ó)n',
      'acreditacion',
      'acredit4cion',
      'acredit4ci0n',
      'acr3ditacion',
      'acr3dit4cion'
    ];
    
    const allMessages = messagesContainer.querySelectorAll('div[id^="message-"]');
    console.log(`📊 Total de mensajes encontrados: ${allMessages.length}\n`);
    
    let cargaEncontrada = false;
    
    allMessages.forEach((message, index) => {
      // Verificar si es del cliente
      const esDelCliente = message.querySelector('[data-contact-message="true"]') || 
                          message.classList.contains('contact-message');
      
      const textoCompleto = message.textContent || '';
      const textoNormalizado = normalizarTexto(textoCompleto);
      
      console.log(`\n📌 MENSAJE #${index}`);
      console.log(`   Tipo: ${esDelCliente ? '👤 CLIENTE' : '🤖 AGENTE'}`);
      console.log(`   Texto original (primeros 150 chars): "${textoCompleto.substring(0, 150)}..."`);
      console.log(`   Normalizado (primeros 150 chars): "${textoNormalizado.substring(0, 150)}..."`);
      
      if (esDelCliente) {
        console.log(`   ⏭️  SALTADO (es mensaje del cliente)`);
        return;
      }
      
      let encontroPatron = false;
      for (const patron of patronesDeteccion) {
        try {
          const regex = new RegExp(patron.replace(/\(/g, '(?:').replace(/\|/g, '|'), 'i');
          if (regex.test(textoNormalizado)) {
            console.log(`   ✅ COINCIDE CON: "${patron}"`);
            encontroPatron = true;
            cargaEncontrada = true;
            break;
          }
        } catch (e) {
          console.warn(`   ⚠️  Error en regex: ${patron}`);
        }
      }
      
      if (!encontroPatron) {
        console.log(`   ❌ NO COINCIDE CON NINGÚN PATRÓN`);
      }
    });
    
    console.log(`\n========== RESULTADO FINAL ==========`);
    console.log(`🔍 Carga detectada: ${cargaEncontrada ? '✅ SÍ' : '❌ NO'}`);
    console.log(`\n💡 TIPS SI NO DETECTA:`);
    console.log(`   1. Verifica que el selector '.MuiBox-root.mui-ylizsf' sea correcto`);
    console.log(`   2. Verifica que el mensaje sea del AGENTE (no del cliente)`);
    console.log(`   3. Copia el texto exacto del mensaje y búscalo en el texto normalizado`);
    console.log(`   4. Si la frase está cortada en múltiples elementos, podría no detectarse`);
    console.log('\n');
  },
  
  /**
   * Obtiene TODAS las URLs de Meta (fb.me, instagram.com/p/) que sean de HOY
   * @returns {Array} [{url, timeInfo, esDeHoy}, ...]
   */
  getAllMetaUrlsFromToday() {
    // IMPORTANTE: El contenedor NO está dentro de .mui-npbckn, está en el DOM raíz
    // Por eso buscamos directamente en document, no en chatWindow
    let messagesContainer = document.querySelector('.MuiBox-root.mui-ylizsf');
    
    // Si no lo encuentra, intentar selectores alternativos
    if (!messagesContainer) {
      console.log(`   ⚠️ Selector principal no funciona, buscando alternativas...`);
      
      // Alternativa 1: Buscar por clase parcial
      messagesContainer = document.querySelector('[class*="mui-ylizsf"]');
      
      // Alternativa 2: Buscar el div que contiene elementos con id^="message-"
      if (!messagesContainer) {
        messagesContainer = Array.from(document.querySelectorAll('div[class*="MuiBox"]'))
          .find(div => div.querySelector('div[id^="message-"]'));
      }
    }
    
    if (!messagesContainer) {
      console.warn('❌ [getAllMetaUrls] Container no encontrado con ningún selector');
      return [];
    }
    
    console.log(`✅ [getAllMetaUrls] Container encontrado (en DOM raíz, no dentro de chat window)`);
    
    // Obtener TODOS los mensajes
    const allMessages = messagesContainer.querySelectorAll('div[id^="message-"]');
    console.log(`🔍 [getAllMetaUrls] Buscando en ${allMessages.length} mensajes...`);
    
    const urlsDeHoy = [];
    
    allMessages.forEach((message, index) => {
      // Buscar enlaces de Meta (Facebook o Instagram)
      const links = message.querySelectorAll('a[href]');
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        
        // Verificar si es URL de Meta (Facebook Ads o Instagram)
        if (href && (href.startsWith('https://fb.me') || href.includes('instagram.com/p/'))) {
          console.log(`   [${index}] ✅ URL Meta: ${href}`);
          
          // Obtener información de tiempo de este mensaje
          const timeContainer = message.querySelector('.MuiBox-root.mui-186zjq8[aria-label]');
          
          if (timeContainer) {
            const fullTimestamp = timeContainer.getAttribute('aria-label');
            console.log(`       Timestamp: "${fullTimestamp}"`);
            
            // Obtener el tiempo relativo (ej: "16 minutos", "hace 2 horas")
            const timeElements = timeContainer.querySelectorAll('p.MuiTypography-root.mui-2ehu0i');
            let relativeTime = null;
            
            for (let i = timeElements.length - 1; i >= 0; i--) {
              const text = timeElements[i].textContent.trim();
              if (text.includes('minuto') || text.includes('hora') || text.includes('día')) {
                relativeTime = text;
                break;
              }
            }
            
            console.log(`       Relative time: "${relativeTime}"`);
            
            const timeInfo = {
              fullTimestamp: fullTimestamp,
              relativeTime: relativeTime,
              calculatedTime: this.calculateExactTime(relativeTime)
            };
            
            // ✅ FILTRAR: Solo agregar URLs de HOY o del día anterior
            if (this.esMensajeDeHoy(timeInfo) || this.esDelDiaAnterior(timeInfo)) {
              urlsDeHoy.push({
                url: href,
                timeInfo: timeInfo,
                messageIndex: index
              });
              
              console.log(`       ✅ Agregada a lista (es de HOY o del día anterior)`);
            } else {
              console.log(`       ⏭️ Ignorada (no es de HOY ni del día anterior)`);
            }
          } else {
            console.warn(`       ⚠️ No se encontró timestamp`);
          }
        }
      });
    });
    
    console.log(`📊 [getAllMetaUrls] TOTAL URLs encontradas: ${urlsDeHoy.length}`);
    return urlsDeHoy;
  },
  
  /**
   * Obtiene la URL del primer mensaje
   * @returns {string|null}
   */
  getFirstMessageURL() {
    // Esperar un momento para que cargue el contenedor
    let messagesContainer = document.querySelector('.MuiBox-root.mui-ylizsf');
    
    // Intentar selectores alternativos
    if (!messagesContainer) {
      messagesContainer = document.querySelector('[class*="mui-ylizsf"]');
    }
    
    if (!messagesContainer) {
      // Buscar directamente el mensaje en la ventana de chat
      const chatWindow = document.querySelector('.mui-npbckn');
      if (chatWindow) {
        const firstMsg = chatWindow.querySelector('div[id^="message-"]');
        if (firstMsg) {
          messagesContainer = firstMsg.parentElement;
        }
      }
    }
    
    if (!messagesContainer) {
      console.warn('[URL Detector] ❌ No se encontró el contenedor de mensajes');
      return null;
    }
    
    const firstMessage = messagesContainer.querySelector('div[id^="message-"]');
    if (!firstMessage) return null;
    
    const link = firstMessage.querySelector('a[href^="https://fb.me"]');
    if (!link) return null;
    
    return link.getAttribute('href');
  },
  
  /**
   * Obtiene el nombre del panel asignado
   * @returns {string|null}
   */
  getPanelName() {
    // FORMA 1: Buscar en el selector original
    let container = document.querySelector('div[aria-label="Asignar conversación"]');
    if (container) {
      const panelNameElement = container.querySelector('p.MuiTypography-root.MuiTypography-body1.mui-1586szk');
      if (panelNameElement) {
        const panel = panelNameElement.textContent.trim();
        console.log(`✅ [getPanelName] Panel encontrado (forma 1): "${panel}"`);
        return panel;
      }
    }
    
    // FORMA 2: Buscar entre TODOS los Typographies que contengan "Panel"
    const allTypographies = document.querySelectorAll('[class*="MuiTypography"]');
    for (const typo of allTypographies) {
      const text = typo.textContent.trim();
      if (text.includes('Panel') && text.length < 50) {
        console.log(`✅ [getPanelName] Panel encontrado (forma 2): "${text}"`);
        return text;
      }
    }
    
    // FORMA 3: Buscar en el aria-label del timeContainer (vimos que va ahí)
    const timeContainer = document.querySelector('.MuiBox-root.mui-186zjq8[aria-label]');
    if (timeContainer) {
      const label = timeContainer.getAttribute('aria-label');
      // El formato es "Panel-Nombre-Algo" al inicio
      const match = label.match(/^([A-Za-zñáéíóú]+(?:-[A-Za-zñáéíóú]+)?)/);
      if (match) {
        const panel = match[1];
        console.log(`✅ [getPanelName] Panel encontrado (forma 3): "${panel}"`);
        return panel;
      }
    }
    
    console.warn(`❌ [getPanelName] No se pudo encontrar el panel`);
    return null;
  },
  
  /**
   * Obtiene la información de tiempo del primer mensaje
   * @returns {Object|null} {fullTimestamp, relativeTime, calculatedTime}
   */
  getFirstMessageTime() {
    const messagesContainer = document.querySelector('.MuiBox-root.mui-ylizsf');
    if (!messagesContainer) return null;
    
    const firstMessage = messagesContainer.querySelector('div[id^="message-"]');
    if (!firstMessage) return null;
    
    const timeContainer = firstMessage.querySelector('.MuiBox-root.mui-186zjq8[aria-label]');
    if (!timeContainer) return null;
    
    const fullTimestamp = timeContainer.getAttribute('aria-label');
    const timeElements = timeContainer.querySelectorAll('p.MuiTypography-root.mui-2ehu0i');
    let relativeTime = null;
    
    for (let i = timeElements.length - 1; i >= 0; i--) {
      const text = timeElements[i].textContent.trim();
      if (text.includes('minuto') || text.includes('hora') || text.includes('día')) {
        relativeTime = text;
        break;
      }
    }
    
    return {
      fullTimestamp: fullTimestamp,
      relativeTime: relativeTime,
      calculatedTime: this.calculateExactTime(relativeTime)
    };
  },
  
  /**
   * Verifica si el mensaje es de HOY (no de días anteriores)
   * Solo procesa URLs/mensajes que sean del día actual
   * @param {Object} timeInfo - Información de tiempo del mensaje
   * @returns {boolean}
   */
  esMensajeDeHoy(timeInfo) {
    if (!timeInfo || !timeInfo.fullTimestamp) return false;
    
    const timestamp = timeInfo.fullTimestamp;
    
    // Si dice "Hace X minutos/horas" es de HOY
    if (timestamp.includes('minuto') || timestamp.includes('hora')) {
      return true;
    }
    
    // Si tiene fecha específica, VERIFICAR que sea de HOY
    const fechaMatch = timestamp.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (fechaMatch) {
      const dia = parseInt(fechaMatch[1], 10);
      const mes = parseInt(fechaMatch[2], 10);
      const anio = parseInt(fechaMatch[3], 10);
      
      // Obtener fecha actual en timezone Argentina
      const ahora = new Date();
      const fechaArgentina = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
      
      const diaActual = fechaArgentina.getDate();
      const mesActual = fechaArgentina.getMonth() + 1;
      const anioActual = fechaArgentina.getFullYear();
      
      console.log(`   📅 Comparando: ${dia}/${mes}/${anio} vs ${diaActual}/${mesActual}/${anioActual}`);
      
      // Solo retornar true si es la fecha de HOY
      if (dia === diaActual && mes === mesActual && anio === anioActual) {
        console.log(`   ✅ Es de HOY`);
        return true;
      } else {
        console.log(`   ❌ Es de otro día (${dia}/${mes}/${anio})`);
        return false;
      }
    }
    
    return false;
  },

  /**
   * ⭐ NUEVO: Detecta si el mensaje/URL es del día anterior
   * Si encontramos un chat que empezó ayer, lo etiquetamos con la fecha de ayer
   * sin importar a qué hora del día de hoy se procese
   * @param {Object} timeInfo - Información de tiempo del mensaje
   * @returns {boolean} true si el mensaje es del día anterior exactamente
   */
  esDelDiaAnterior(timeInfo) {
    if (!timeInfo || !timeInfo.fullTimestamp) return false;
    
    const timestamp = timeInfo.fullTimestamp;
    
    // Si ya dice "Hace X minutos/horas", es de HOY, así que no aplica
    if (timestamp.includes('minuto') || timestamp.includes('hora')) {
      return false;
    }
    
    // Extraer fecha del timestamp
    const fechaMatch = timestamp.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!fechaMatch) return false;
    
    const dia = parseInt(fechaMatch[1], 10);
    const mes = parseInt(fechaMatch[2], 10);
    const anio = parseInt(fechaMatch[3], 10);
    
    // Obtener fecha actual en timezone Argentina
    const ahora = new Date();
    const fechaArgentina = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    
    const diaActual = fechaArgentina.getDate();
    const mesActual = fechaArgentina.getMonth() + 1;
    const anioActual = fechaArgentina.getFullYear();
    
    // Calcular fecha de ayer
    const ayer = new Date(fechaArgentina);
    ayer.setDate(ayer.getDate() - 1);
    
    const diaAyer = ayer.getDate();
    const mesAyer = ayer.getMonth() + 1;
    const anioAyer = ayer.getFullYear();
    
    // Verificar si el mensaje es de AYER exactamente
    const esDeAyer = (dia === diaAyer && mes === mesAyer && anio === anioAyer);
    
    if (esDeAyer) {
      console.log(`   ✅ CHAT DEL DÍA ANTERIOR: Mensaje de ${dia}/${mes}/${anio} (hoy es ${diaActual}/${mesActual}/${anioActual})`);
      return true;
    } else {
      console.log(`   ⏭️ No es de ayer (${dia}/${mes}/${anio} vs ayer: ${diaAyer}/${mesAyer}/${anioAyer})`);
      return false;
    }
  },
  
  /**
   * Genera la nomenclatura del mensaje: DD-MM-ID (sin letra por defecto)
   * La letra de campaña se agrega después si existe
   * @param {string} panelNombre - Nombre del panel (puede incluir "Panel" como prefijo)
   * @param {Object} timeInfo - Información de tiempo del mensaje {fullTimestamp, relativeTime, calculatedTime}
   * @returns {Promise<string>} Nomenclatura base generada (sin letra)
   */
  async generarNomenclatura(panelNombre, timeInfo = null) {
    console.log(`\n📝 [generarNomenclatura] Generando para panel: "${panelNombre}"`);
    
    if (!panelNombre || panelNombre === 'Sin panel') {
      console.warn('[URL Detector] ⚠️ Panel inválido, usando nomenclatura por defecto');
      return this.generarNomenclaturaPorDefecto(timeInfo);
    }
    
    // Normalizar: quitar "Panel" del inicio y espacios
    let nombreNormalizado = panelNombre.replace(/^Panel\s*/i, '').trim();
    console.log(`   Nombre normalizado: "${nombreNormalizado}"`);
    
    // Buscar el panel (primero API, luego local)
    console.log(`   Buscando en API...`);
    const panelEncontrado = await this.buscarPanelPorNombre(nombreNormalizado);
    
    let panelId = '0';
    if (panelEncontrado) {
      panelId = String(panelEncontrado.id);
      console.log(`   ✅ Panel encontrado en API - ID: ${panelId}`);
    } else {
      console.warn(`   ❌ Panel "${nombreNormalizado}" NO encontrado en API`);
    }
    
    // Obtener fecha del timestamp del mensaje (NO la fecha actual)
    let dia, mes;
    
    if (timeInfo && timeInfo.fullTimestamp) {
      // Extraer fecha del timestamp (formato: "DD/MM/YYYY a las HH:MM")
      const match = timeInfo.fullTimestamp.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        dia = match[1].padStart(2, '0');
        mes = match[2].padStart(2, '0');
        console.log(`   📅 Fecha extraída del timestamp: ${dia}-${mes}`);
      } else {
        // Si no se puede extraer, usar fecha actual
        const now = new Date();
        const argDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
        dia = String(argDate.getDate()).padStart(2, '0');
        mes = String(argDate.getMonth() + 1).padStart(2, '0');
      }
    } else {
      // Fallback: usar fecha actual
      const now = new Date();
      const argDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
      dia = String(argDate.getDate()).padStart(2, '0');
      mes = String(argDate.getMonth() + 1).padStart(2, '0');
    }
    
    const nomenclatura = `${dia}-${mes}-${panelId}`;
    console.log(`   📊 NOMENCLATURA FINAL: "${nomenclatura}"`);
    
    // Devolver sin letra - la letra se agrega en extractUrlFromChat si existe
    return nomenclatura;
  },
  
  /**
   * Genera nomenclatura por defecto cuando no se encuentra el panel
   * Devuelve formato DD-MM-0 (sin letra)
   * @param {Object} timeInfo - Información de tiempo del mensaje {fullTimestamp, relativeTime, calculatedTime}
   * @returns {string}
   */
  generarNomenclaturaPorDefecto(timeInfo = null) {
    let dia, mes;
    
    if (timeInfo && timeInfo.fullTimestamp) {
      // Extraer fecha del timestamp
      const match = timeInfo.fullTimestamp.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        dia = match[1].padStart(2, '0');
        mes = match[2].padStart(2, '0');
      } else {
        // Si no se puede extraer, usar fecha actual
        const now = new Date();
        const argDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
        dia = String(argDate.getDate()).padStart(2, '0');
        mes = String(argDate.getMonth() + 1).padStart(2, '0');
      }
    } else {
      // Fallback: usar fecha actual
      const now = new Date();
      const argDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
      dia = String(argDate.getDate()).padStart(2, '0');
      mes = String(argDate.getMonth() + 1).padStart(2, '0');
    }
    
    return `${dia}-${mes}-0`; // 0 para panel desconocido, sin letra
  },
  
  /**
   * Obtiene el nombre del panel asociado a una nomenclatura
   * (Útil para cuando se necesite tagear)
   * @param {string} nomenclatura - Nomenclatura (ej: "11-12-19A")
   * @returns {string|null} Nombre del panel original
   */
  getPanelPorNomenclatura(nomenclatura) {
    try {
      const mappingStr = localStorage.getItem('clientify_nomenclatura_panel_mapping');
      if (!mappingStr) return null;
      
      const mapping = JSON.parse(mappingStr);
      return mapping[nomenclatura] || null;
    } catch (error) {
      console.error('[URL Detector] ❌ Error al obtener mapping:', error);
      return null;
    }
  },
  
  /**
   * Calcula la hora exacta basándose en el tiempo relativo
   * @param {string} relativeTime - Ej: "20 minutos", "1 hora"
   * @returns {string|null} Hora en formato "HH:MM"
   */
  calculateExactTime(relativeTime) {
    if (!relativeTime) {
      return null;
    }
    
    const now = new Date();
    const match = relativeTime.match(/(\d+)\s*(minuto|hora|día|mes|año)/i);
    if (!match) return null;
    
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    let diff = 0;
    switch (unit) {
      case 'minuto':
        diff = amount * 60 * 1000;
        break;
      case 'hora':
        diff = amount * 60 * 60 * 1000;
        break;
      case 'día':
        diff = amount * 24 * 60 * 60 * 1000;
        break;
      case 'mes':
        diff = amount * 30 * 24 * 60 * 60 * 1000;
        break;
      case 'año':
        diff = amount * 365 * 24 * 60 * 60 * 1000;
        break;
    }
    
    const messageDate = new Date(now.getTime() - diff);
    const hours = messageDate.getHours().toString().padStart(2, '0');
    const minutes = messageDate.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;
    
    console.log('[URL Detector] 🕐 Hora calculada:', formattedTime);
    return formattedTime;
  }
};

// ============================================
// FUNCIÓN DE TEST - Ejecutar en consola
// ============================================
window.testDeteccionCarga = function() {
  console.clear();
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 INICIANDO TEST DE DETECCIÓN DE CARGA');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const frasesObjetivo = [
    'segui los pasos a continuacion para que tu acr3dit4ci0n se procese sin demoras',
    'segui los pasos a continuacion para que tu acr3ditacion se procese sin demoras',
    'segui los pasos a continuacion para que tu acr3dit4cion se procese sin demoras'
  ];
  console.log('📝 Frases que se buscan (normalizadas):');
  frasesObjetivo.forEach((frase, i) => {
    console.log(`   [${i + 1}] "${frase}"`);
  });
  console.log();
  
  // 1. Verificar contenedor
  const messagesContainer = document.querySelector('.MuiBox-root.mui-ylizsf');
  if (!messagesContainer) {
    console.error('❌ ERROR: No se encontró el contenedor de mensajes');
    console.log('   Selector: .MuiBox-root.mui-ylizsf');
    return;
  }
  console.log('✅ Contenedor de mensajes encontrado\n');
  
  // 2. Obtener todos los mensajes
  const allMessages = messagesContainer.querySelectorAll('div[id^="message-"]');
  console.log(`📨 Total de mensajes en el chat: ${allMessages.length}\n`);
  
  if (allMessages.length === 0) {
    console.error('❌ ERROR: No se encontraron mensajes');
    return;
  }
  
  let mensajesDeHoyCount = 0;
  let mensajesDelAgenteCount = 0;
  let encontrado = false;
  
  allMessages.forEach((message, index) => {
    console.log(`\n─────────────────────────────────────────────────────────`);
    console.log(`📬 MENSAJE #${index + 1}`);
    
    // Verificar tiempo
    const timeContainer = message.querySelector('.MuiBox-root.mui-186zjq8[aria-label]');
    if (!timeContainer) {
      console.log('   ⏭️ Sin timestamp, saltando...');
      return;
    }
    
    const fullTimestamp = timeContainer.getAttribute('aria-label');
    console.log(`   🕐 Timestamp: ${fullTimestamp}`);
    
    // Verificar si es de hoy
    const timeElements = timeContainer.querySelectorAll('p.MuiTypography-root.mui-2ehu0i');
    let relativeTime = null;
    for (let i = timeElements.length - 1; i >= 0; i--) {
      const text = timeElements[i].textContent.trim();
      if (text.includes('minuto') || text.includes('hora') || text.includes('día')) {
        relativeTime = text;
        break;
      }
    }
    
    const timeInfo = {
      fullTimestamp: fullTimestamp,
      relativeTime: relativeTime,
      calculatedTime: urlDetector.calculateExactTime(relativeTime)
    };
    
    const esDeHoy = urlDetector.esMensajeDeHoy(timeInfo);
    console.log(`   📅 Es de HOY: ${esDeHoy ? '✅ SÍ' : '❌ NO'} (${relativeTime || 'sin hora relativa'})`);
    
    if (!esDeHoy) return;
    mensajesDeHoyCount++;
    
    // Verificar si es del agente o del cliente
    const esDelCliente = message.querySelector('[data-contact-message="true"]') || 
                        message.classList.contains('contact-message');
    console.log(`   👤 Tipo: ${esDelCliente ? '🟢 CLIENTE' : '🔵 AGENTE'}`);
    
    if (esDelCliente) return;
    mensajesDelAgenteCount++;
    
    // Buscar la frase
    const paragraphs = message.querySelectorAll('p');
    console.log(`   📝 Párrafos encontrados: ${paragraphs.length}`);
    
    paragraphs.forEach((p, pIndex) => {
      const textoOriginal = p.textContent;
      const textoNormalizado = textoOriginal
        .toLowerCase()
        .replace(/[áàäâ]/g, 'a')
        .replace(/[éèëê]/g, 'e')
        .replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o')
        .replace(/[úùüû]/g, 'u')
        .replace(/[.,!?¿¡]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`\n   📄 Párrafo #${pIndex + 1}:`);
      console.log(`      Original: "${textoOriginal.substring(0, 100)}${textoOriginal.length > 100 ? '...' : ''}"`);
      console.log(`      Normalizado: "${textoNormalizado.substring(0, 100)}${textoNormalizado.length > 100 ? '...' : ''}"`);
      
      // Buscar cualquiera de las 3 frases
      let fraseEncontrada = null;
      for (let frase of frasesObjetivo) {
        if (textoNormalizado.includes(frase)) {
          fraseEncontrada = frase;
          break;
        }
      }
      
      if (fraseEncontrada) {
        console.log(`\n   🎯🎯🎯 ¡ENCONTRADO! 🎯🎯🎯`);
        console.log(`   ✅ Este mensaje contiene la frase de carga`);
        encontrado = true;
      } else {
        console.log(`      ❌ No contiene ninguna variante buscada`);
      }
    });
  });
  
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('📊 RESUMEN DEL TEST');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📨 Total mensajes analizados: ${allMessages.length}`);
  console.log(`📅 Mensajes de HOY: ${mensajesDeHoyCount}`);
  console.log(`🔵 Mensajes del AGENTE (hoy): ${mensajesDelAgenteCount}`);
  console.log(`\n🎯 RESULTADO: ${encontrado ? '✅ MENSAJE DE CARGA DETECTADO' : '❌ NO SE DETECTÓ MENSAJE DE CARGA'}`);
  console.log('═══════════════════════════════════════════════════════\n');
  
  if (!encontrado && mensajesDelAgenteCount > 0) {
    console.log('💡 SUGERENCIA: Revisa si la frase en el mensaje es exactamente:');
    console.log('   "Seguí los pasos a continuación para que tu ACR3DIT4CI0N se procese sin demoras"');
  }
  
  return encontrado;
};

// Asegurar que la función se exponga globalmente
setTimeout(() => {
  if (typeof window.testDeteccionCarga === 'function') {
    console.log('✅ Función de test cargada. Para probar la detección de carga, ejecuta:');
    console.log('   testDeteccionCarga()');
  }
}, 1000);
