/* ============================================================
   EMPANADAS QUE RICO
   Script principal — versión ordenada
   ============================================================ */

/* =========================
   1. CONFIGURACIÓN
   ========================= */
const CONFIG = {
  cajaPorPedido: 2500,

  // REEMPLAZA estos números por los WhatsApp reales.
  whatsapp: {
    punto1: "573000000001",
    punto2: "573148978258",
    punto3: "573024932188"
  },

  // Punto 1 NO hace domicilios.
  sucursales: {
    Centro: { punto: 1, domicilios: false, whatsapp: "punto1", ciudad:"Dosquebradas", direccion:"Manzana 10, Casa 16, Bombay 3" },
    Cuba: { punto: 2, domicilios: true, whatsapp: "punto2", ciudad:"Dosquebradas", direccion:"Calle 49 # 19-27, Barrio El Modelo" },
    Circunvalar: { punto: 3, domicilios: true, whatsapp: "punto3", ciudad:"Pereira", direccion:"Carrera 20 # 21-26, Barrio Providencia" }
  },

  tarifasDomicilio: {
    "Centro Pereira": 5000,
    "Cuba": 5000,
    "Circunvalar": 6000,
    "Alamos": 6000,
    "Dosquebradas Centro": 8000,
    "Dosquebradas - La Pradera": 8500,
    "Dosquebradas - La Badea": 9000,
    "Cerritos": 9000,
    "Cerritos - Zona rural": 12000
  }
};

const productos = [
  {id:"emp-carne",cat:"Empanadas",icon:"🥟",nombre:"Empanada de Carne",desc:"Empanada tradicional de carne.",precio:3000},
  {id:"emp-pollo",cat:"Empanadas",icon:"🥟",nombre:"Empanada de Pollo",desc:"Empanada tradicional de pollo.",precio:3000},
  {id:"emp-queso",cat:"Empanadas",icon:"🥟",nombre:"Empanada de Queso",desc:"Empanada rellena de queso.",precio:3500},
  {id:"emp-mixta",cat:"Empanadas",icon:"🥟",nombre:"Empanada Mixta",desc:"Deliciosa combinación de carne y pollo.",precio:4000},
];

let carrito = JSON.parse(localStorage.getItem("carritoEmpanadasQueRico") || "[]");
let pedidoActual = null;
let modalidadEntrega = null;
let configuracionDomiciliosPublica = [];
let configuracionCiudadesPublica = [];
let supabasePublico = null;
let supabasePublicoRealtimeChannel = null;

/* =========================
   2. UTILIDADES
   ========================= */
function dinero(valor) {
  return "$" + Number(valor || 0).toLocaleString("es-CO");
}

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function guardarCarrito() {
  localStorage.setItem("carritoEmpanadasQueRico", JSON.stringify(carrito));
}

function obtenerZonasPorCiudad(ciudad) {
  const filas = configuracionDomiciliosPublica.filter(d =>
    d.activo !== false && String(d.ciudad || "").trim() === String(ciudad || "").trim() &&
    (d.sucursal === v4GetPunto() || !d.sucursal)
  );
  const dinamicas = [...new Set(filas.map(d => String(d.zona || "").trim()).filter(Boolean))];
  if (dinamicas.length) return dinamicas;

  const zonasFallback = {
    Pereira: ["Centro Pereira","Cuba","Circunvalar","Alamos","Cerritos","Cerritos - Zona rural"],
    Dosquebradas: ["Dosquebradas Centro","Dosquebradas - La Pradera","Dosquebradas - La Badea"]
  };
  return zonasFallback[ciudad] || [];
}

function obtenerTarifaDomicilio(ciudad, zona, sucursal = v4GetPunto()) {
  const fila = configuracionDomiciliosPublica.find(d =>
    d.activo !== false &&
    String(d.ciudad || "").trim() === String(ciudad || "").trim() &&
    String(d.zona || "").trim() === String(zona || "").trim() &&
    String(d.sucursal || "") === String(sucursal || "")
  );
  if (fila) return Number(fila.precio || 0);
  return Number(CONFIG.tarifasDomicilio[zona] || 0);
}

async function cargarConfiguracionDomiciliosPublica() {
  try {
    if (!window.supabase || !window.SUPABASE_CONFIG?.url || !window.SUPABASE_CONFIG?.anonKey) return;
    supabasePublico ||= window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    const [domicilios, ciudades] = await Promise.all([
      supabasePublico.from("configuracion_domicilios").select("id,ciudad,zona,precio,sucursal,activo").eq("activo", true),
      supabasePublico.from("configuracion_ciudades_domicilios").select("id,ciudad,activo").eq("activo", true).order("ciudad")
    ]);
    if (!domicilios.error) configuracionDomiciliosPublica = domicilios.data || [];
    if (!ciudades.error) configuracionCiudadesPublica = ciudades.data || [];
    cargarCiudadesDomicilio();
    cargarZonas();
    actualizarDomicilio();
  } catch (e) {
    console.warn("No se pudo cargar la configuración de domicilios desde Supabase.", e);
  }
}

function cargarCiudadesDomicilio() {
  const select = document.getElementById("clienteCiudad");
  if (!select) return;
  const actuales = [...select.options].map(o => o.value).filter(Boolean);
  const dinamicas = configuracionCiudadesPublica.map(x => String(x.ciudad || "").trim()).filter(Boolean);
  const porZonas = configuracionDomiciliosPublica.map(x => String(x.ciudad || "").trim()).filter(Boolean);
  const ciudades = [...new Set([...dinamicas, ...porZonas, ...actuales])].filter(Boolean).sort((a,b)=>a.localeCompare(b,"es"));
  select.innerHTML = '<option value="">Selecciona</option>' + ciudades.map(c => `<option value="${escapar(c)}">${escapar(c)}</option>`).join("");
}


/* =========================
   3. MENÚ
   ========================= */
function renderMenu() {
  const cont = document.getElementById("menuContainer");
  const grupos = {};

  productos.forEach(p => (grupos[p.cat] ||= []).push(p));

  cont.innerHTML = Object.entries(grupos).map(([cat, lista]) => `
    <div class="menu-category" data-category="${escapar(cat)}">
      <div class="category-title"><h3>${escapar(cat)}</h3><div></div></div>
      <div class="product-grid">
        ${lista.map(p => `
          <article class="product" data-name="${escapar(p.nombre.toLowerCase())}">
            <div class="product-image">${p.icon}</div>
            <div class="product-content">
              <h4>${escapar(p.nombre)}</h4>
              <p>${escapar(p.desc)}</p>
              <div class="product-bottom">
                <span class="price">${dinero(p.precio)}</span>
                <button class="add" onclick="agregar('${p.id}')">+ Agregar</button>
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function filtrarProductos() {
  const q = document.getElementById("buscador").value.toLowerCase().trim();
  document.querySelectorAll(".product").forEach(card => {
    card.style.display = card.dataset.name.includes(q) ? "" : "none";
  });
  document.querySelectorAll(".menu-category").forEach(group => {
    const visibles = [...group.querySelectorAll(".product")].some(x => x.style.display !== "none");
    group.style.display = visibles ? "" : "none";
  });
}

/* =========================
   4. CARRITO
   ========================= */
function agregar(id) {
  if (v4GetPunto() === "Centro") {
    alert("El Punto 1 — Bombay 3 funciona únicamente como menú. No recibe pedidos ni domicilios.");
    return;
  }
  const p = productosPublicosV4.find(x => x.id === id) || productos.find(x => x.id === id);
  if (!p) return;

  const item = carrito.find(x => x.id === id);
  if (item) item.cantidad++;
  else carrito.push({id, cantidad:1});

  guardarCarrito();
  renderCarrito();
  abrirCarrito();
}

function cambiarCantidad(id, delta) {
  const item = carrito.find(x => x.id === id);
  if (!item) return;

  item.cantidad += delta;
  if (item.cantidad <= 0) carrito = carrito.filter(x => x.id !== id);

  guardarCarrito();
  renderCarrito();
}

function eliminar(id) {
  carrito = carrito.filter(x => x.id !== id);
  guardarCarrito();
  renderCarrito();
}

function calcular() {
  const subtotal = carrito.reduce((total, item) => {
    const p = productosPublicosV4.find(x => x.id === item.id) || productos.find(x => x.id === item.id);
    return total + (p ? p.precio * item.cantidad : 0);
  }, 0);

  let empaque = 0;
  let domicilio = 0;

  if (modalidadEntrega === "domicilio") {
    empaque = carrito.length ? CONFIG.cajaPorPedido : 0;
    const zona = document.getElementById("clienteZona")?.value || "";
    const ciudad = document.getElementById("clienteCiudad")?.value || "";
    const puntoDomicilio = document.getElementById("clienteSucursalDomicilio")?.value || v4GetPunto();
    domicilio = obtenerTarifaDomicilio(ciudad, zona, puntoDomicilio);
  }

  if (modalidadEntrega === "recoger") {
    const empaqueSeleccionado = document.querySelector('input[name="empaque"]:checked')?.value;
    empaque = empaqueSeleccionado === "caja" ? CONFIG.cajaPorPedido : 0;
  }

  return {subtotal, empaque, domicilio, total:subtotal + empaque + domicilio};
}

function renderCarrito() {
  const box = document.getElementById("carritoItems");
  const c = calcular();

  document.getElementById("contadorCarrito").textContent =
    carrito.reduce((s,i) => s + i.cantidad, 0);

  document.getElementById("subtotal").textContent = dinero(c.subtotal);
  document.getElementById("empaque").textContent = dinero(c.empaque);
  document.getElementById("domicilio").textContent = dinero(c.domicilio);
  document.getElementById("total").textContent = dinero(c.total);

  if (!carrito.length) {
    box.innerHTML = `<div class="cart-empty"><div>🛒</div><p>Tu carrito está vacío.</p><small>Agrega productos del menú para comenzar.</small></div>`;
    return;
  }

  box.innerHTML = carrito.map(i => {
    const p = productosPublicosV4.find(x => x.id === i.id) || productos.find(x => x.id === i.id);
    if (!p) return "";
    const imagen = p.imagen
      ? `<img src="${escapar(p.imagen)}" alt="${escapar(p.nombre)}" loading="lazy">`
      : `<span class="cart-product-icon">${p.icon || "🥟"}</span>`;
    const descripcion = p.desc || p.descripcion || "Producto";
    return `
      <div class="cart-row">
        <div class="cart-product-image">${imagen}</div>
        <div class="cart-product-info">
          <h4>${escapar(p.nombre)}</h4>
          <p class="cart-product-description">${escapar(descripcion)}</p>
          <small class="cart-product-price">${p.cat === "Salsas" ? "Gratis" : (p.precio == null ? "Precio no definido" : dinero(p.precio)+" c/u")}</small>
          <div class="qty">
            <button type="button" aria-label="Restar una unidad de ${escapar(p.nombre)}" onclick="cambiarCantidad('${p.id}',-1)">−</button>
            <strong>${i.cantidad}</strong>
            <button type="button" aria-label="Sumar una unidad de ${escapar(p.nombre)}" onclick="cambiarCantidad('${p.id}',1)">+</button>
            <button type="button" class="remove" onclick="eliminar('${p.id}')">Eliminar</button>
          </div>
        </div>
        <strong class="cart-item-total">${p.cat === "Salsas" ? "Gratis" : (p.precio == null ? "—" : dinero(p.precio * i.cantidad))}</strong>
      </div>
    `;
  }).join("");
}

function abrirCarrito() {
  document.getElementById("overlayCarrito").classList.remove("hidden");
}
function cerrarCarrito() {
  document.getElementById("overlayCarrito").classList.add("hidden");
}
function cerrarSiOverlay(e) {
  if (e.target.id === "overlayCarrito") cerrarCarrito();
}

/* =========================
   5. CHECKOUT
   ========================= */
function abrirCheckout() {
  if (v4GetPunto() === "Centro") {
    alert("El Punto 1 — Bombay 3 funciona únicamente como menú. No se pueden realizar pedidos desde este punto.");
    return;
  }
  if (!carrito.length) {
    alert("Agrega al menos un producto al carrito.");
    return;
  }

  cerrarCarrito();
  document.getElementById("overlayCheckout").classList.remove("hidden");
  document.getElementById("resumenInicial").innerHTML = resumenCarritoHTML();
  mostrarPaso("checkoutPaso0");
}

function cerrarCheckout() {
  document.getElementById("overlayCheckout").classList.add("hidden");
}

function mostrarPaso(id) {
  ["checkoutPaso0","checkoutPaso1","checkoutPaso2","checkoutPasoPago","checkoutResultado"].forEach(x => {
    const el = document.getElementById(x);
    if (el) el.classList.add("hidden");
  });
  const actual = document.getElementById(id);
  if (actual) actual.classList.remove("hidden");
}

function irADatosEntrega() {
  mostrarPaso("checkoutPaso1");
}

function seleccionarEntrega(tipo) {
  modalidadEntrega = tipo;

  document.getElementById("formEntrega").classList.remove("hidden");
  document.getElementById("camposDomicilio").classList.toggle("hidden", tipo !== "domicilio");
  document.getElementById("camposRecoger").classList.toggle("hidden", tipo !== "recoger");
  document.getElementById("avisoCajaDomicilio").classList.toggle("hidden", tipo !== "domicilio");

  document.getElementById("clienteCiudad").required = tipo === "domicilio";
  document.getElementById("clienteZona").required = tipo === "domicilio";
  document.getElementById("clienteDireccion").required = tipo === "domicilio";
  document.getElementById("clienteSucursal").required = tipo === "recoger";

  document.getElementById("resumenModalidad").innerHTML =
    tipo === "domicilio"
      ? "🛵 <strong>Domicilio seleccionado.</strong> La caja es obligatoria."
      : "🏪 <strong>Recoger en sucursal.</strong> Puedes elegir caja o bolsa.";

  renderCarrito();
}

function cargarZonas() {
  const ciudad = document.getElementById("clienteCiudad").value;
  const zona = document.getElementById("clienteZona");

  zona.innerHTML = '<option value="">Selecciona tu barrio o zona</option>';

  obtenerZonasPorCiudad(ciudad).forEach(nombre => {
    const option = document.createElement("option");
    option.value = nombre;
    option.textContent = nombre;
    zona.appendChild(option);
  });

  actualizarDomicilio();
}

function actualizarDomicilio() {
  const zona = document.getElementById("clienteZona")?.value || "";
  const ciudad = document.getElementById("clienteCiudad")?.value || "";
  const puntoDomicilio = document.getElementById("clienteSucursalDomicilio")?.value || v4GetPunto();
  const valor = obtenerTarifaDomicilio(ciudad, zona, puntoDomicilio);
  const aviso = document.getElementById("avisoDomicilio");
  if (aviso) aviso.classList.toggle("hidden", !zona);
  const valorEl = document.getElementById("valorDomicilio");
  if (valorEl) valorEl.textContent = dinero(valor);
  renderCarrito();
}

function mostrarPago(e) {
  e.preventDefault();

  if (!modalidadEntrega) {
    alert("Selecciona domicilio o recoger en sucursal.");
    return;
  }

  if (modalidadEntrega === "domicilio") {
    const zona = document.getElementById("clienteZona").value;
    const direccion = document.getElementById("clienteDireccion").value.trim();
    const sucursalDom = document.getElementById("clienteSucursalDomicilio").value;

    if (!zona || !direccion || !sucursalDom) {
      alert("Completa ciudad, barrio/zona, dirección y selecciona el punto que prepara el domicilio.");
      return;
    }
  }

  if (modalidadEntrega === "recoger") {
    const sucursal = document.getElementById("clienteSucursal").value;
    if (!sucursal) {
      alert("Selecciona la sucursal donde recogerás.");
      return;
    }
  }

  pedidoActual = {
    numero: nuevoNumeroPedido(),
    cliente: datosCliente(),
    modalidad: modalidadEntrega,
    items: carrito.map(i => ({...i})),
    ...calcular()
  };

  document.getElementById("resumenCheckout").innerHTML = resumenCompletoHTML();
  mostrarPaso("checkoutPaso2");
}

function volverEntrega() {
  mostrarPaso("checkoutPaso1");
}

function irAlPago() {
  const opciones = document.getElementById("paymentOptions");
  if (opciones) {
    opciones.innerHTML = `
      <button class="payment-card" type="button" onclick="seleccionarPago('transferencia')">
        <span>🏦</span><strong>Transferencia / Nequi</strong><small>Paga el total y envía el comprobante por WhatsApp.</small>
      </button>
      <button class="payment-card" type="button" onclick="seleccionarPago('efectivo')">
        <span>💵</span><strong>Efectivo</strong><small>Paga al recibir o al recoger tu pedido.</small>
      </button>`;
  }
  mostrarPaso("checkoutPasoPago");
}

function datosCliente() {
  return {
    nombre: document.getElementById("clienteNombre").value.trim(),
    telefono: document.getElementById("clienteTelefono").value.trim(),
    direccion: document.getElementById("clienteDireccion").value.trim(),
    ciudad: document.getElementById("clienteCiudad").value,
    zona: document.getElementById("clienteZona").value,
    sucursal: modalidadEntrega === "domicilio"
      ? document.getElementById("clienteSucursalDomicilio").value
      : document.getElementById("clienteSucursal").value,
    empaque: document.querySelector('input[name="empaque"]:checked')?.value || "caja",
    nota: document.getElementById("clienteNota").value.trim()
  };
}

function nuevoNumeroPedido() {
  const n = Number(localStorage.getItem("ultimoPedidoEmpanadasQueRico") || "0") + 1;
  localStorage.setItem("ultimoPedidoEmpanadasQueRico", String(n));
  return String(n).padStart(6,"0");
}

function listaPedidoTexto() {
  return pedidoActual.items.map(i => {
    const p = productosPublicosV4.find(x => x.id === i.id) || productos.find(x => x.id === i.id);
    return p.cat === "Salsas"
      ? `${i.cantidad} x ${p.nombre} — Gratis`
      : `${i.cantidad} x ${p.nombre} — ${dinero(p.precio)} c/u = ${dinero(p.precio * i.cantidad)}`;
  }).join("\n");
}

function resumenCarritoHTML() {
  const c = calcular();
  const items = carrito.map(i => {
    const x = productosPublicosV4.find(y => y.id === i.id) || productos.find(y => y.id === i.id);
    if (!x) return "";
    const imagen = x.imagen
      ? `<img src="${escapar(x.imagen)}" alt="${escapar(x.nombre)}">`
      : `<span>${escapar(x.icon || "🥟")}</span>`;
    return `<div class="receipt-product">
      <div class="receipt-product-image">${imagen}</div>
      <div class="receipt-product-info">
        <strong>${escapar(x.nombre)}</strong>
        <p>${escapar(x.desc || x.descripcion || "Producto")}</p>
        <small>${x.cat === "Salsas" ? `${i.cantidad} × Gratis = <b>Gratis</b>` : `${i.cantidad} × ${dinero(x.precio)} = <b>${dinero(x.precio*i.cantidad)}</b>`}</small>
      </div>
    </div>`;
  }).join("");
  return `<div class="receipt-head"><div><strong>🧾 RECIBO DEL PEDIDO</strong><small>Revisa todo antes de continuar.</small></div><strong>${carrito.reduce((s,i)=>s+i.cantidad,0)} producto(s)</strong></div>
    <div class="receipt-products">${items}</div>
    <div class="invoice-totals">
      <div class="summary-line"><span>Productos</span><strong>${dinero(c.subtotal)}</strong></div>
      <div class="summary-line"><span>Empaque</span><strong>${dinero(c.empaque)}</strong></div>
      <div class="summary-line"><span>Domicilio</span><strong>${dinero(c.domicilio)}</strong></div>
      <div class="invoice-total"><span>TOTAL</span><strong>${dinero(c.total)}</strong></div>
    </div>`;
}

function resumenCompletoHTML() {
  const p = pedidoActual;
  const c = p;

  const entrega = p.modalidad === "domicilio"
    ? `🛵 Domicilio<br>Ciudad: ${escapar(p.cliente.ciudad)}<br>Zona: ${escapar(p.cliente.zona)}<br>Dirección: ${escapar(p.cliente.direccion)}`
    : `🏪 Recoger en sucursal: ${escapar(p.cliente.sucursal)}`;

  return `
    <div class="summary-section"><strong>🧾 Pedido #${escapar(p.numero)}</strong></div>
    <div class="summary-section"><strong>👤 Cliente:</strong> ${escapar(p.cliente.nombre)}<br>📱 ${escapar(p.cliente.telefono)}</div>
    <div class="summary-section"><strong>📍 Entrega</strong><br>${entrega}</div>
    <div class="summary-section"><strong>🍽️ Productos</strong><div class="receipt-products">${p.items.map(i => {
      const x = productosPublicosV4.find(y => y.id === i.id) || productos.find(y => y.id === i.id);
      if (!x) return "";
      const imagen = x.imagen ? `<img src="${escapar(x.imagen)}" alt="${escapar(x.nombre)}">` : `<span>${escapar(x.icon || "🥟")}</span>`;
      return `<div class="receipt-product"><div class="receipt-product-image">${imagen}</div><div class="receipt-product-info"><strong>${escapar(x.nombre)}</strong><p>${escapar(x.desc || x.descripcion || "Producto")}</p><small>${i.cantidad} × ${dinero(x.precio)} = <b>${dinero(x.precio*i.cantidad)}</b></small></div></div>`;
    }).join("")}</div></div>
    <div class="summary-line"><span>Empaque</span><strong>${p.cliente.empaque === "bolsa" && p.modalidad === "recoger" ? "Bolsa — $0" : "Caja — " + dinero(c.empaque)}</strong></div>
    <div class="summary-line"><span>Domicilio</span><strong>${dinero(c.domicilio)}</strong></div>
    <div class="summary-line total"><span>TOTAL</span><strong>${dinero(c.total)}</strong></div>
  `;
}

/* =========================
   6. PAGOS + WHATSAPP
   ========================= */
function seleccionarPago(metodo) {
  pedidoActual.metodo = metodo;

  if (metodo === "transferencia") {
    const esProvidencia = pedidoActual?.cliente?.sucursal === "Circunvalar";
    const datosTransferencia = `
      <div class="payment-info">
        <h3>🏦 Datos para transferencia</h3>
        <p>Transfiere exactamente <strong>${dinero(pedidoActual.total)}</strong>.</p>
        <div class="bank-data">
          ${esProvidencia ? `
            <div><span>Cuenta</span><strong>Ahorros Bancolombia</strong></div>
            <div><span>Número de cuenta</span><strong>72500010039</strong></div>
            <div><span>Nombre de la cuenta</span><strong>Que Rico 3</strong></div>
            <div><span>Titular</span><strong>Maribel Rico</strong></div>
            <div><span>Llave de Bre-B</span><strong>0092338157</strong></div>
            <div><span>Nombre de la llave</span><strong>Que Rico 3</strong></div>
            <div><span>Nequi</span><strong>320 9321767</strong></div>
            <div><span>Nombre de Nequi</span><strong>Marco Alfredo Rico</strong></div>
          ` : `
            <div><span>Nequi</span><strong>314 897 8258</strong></div>
            <div><span>Llave</span><strong>314 897 8258</strong></div>
            <div><span>A nombre de</span><strong>Maribel Rico Ceballos</strong></div>
          `}
        </div>
        <p class="warning">Después del pago, envía el comprobante por WhatsApp. El pedido quedará 🟡 EN VERIFICACIÓN hasta que el negocio lo valide.</p>
      </div>`;

    document.getElementById("checkoutResultado").innerHTML = `
      ${datosTransferencia}
      <button class="primary-btn full" onclick="enviarPedidoYComprobante()">📲 Enviar pedido y comprobante</button>
      <button class="secondary-btn full" onclick="mostrarReciboPendiente()">Ver resumen</button>`;
  } else {
    document.getElementById("checkoutResultado").innerHTML = `
      <div class="success">
        <div class="success-icon">🧾</div>
        <span class="order-code">Pedido #${pedidoActual.numero}</span>
        <h2>Pedido listo para enviar</h2>
        ${resumenCompletoHTML()}
        <p><strong>💵 Total a pagar: ${dinero(pedidoActual.total)}</strong></p>
      </div>
      <button class="primary-btn full" onclick="enviarPedidoEfectivo()">📲 Enviar pedido al WhatsApp</button>`;
  }

  mostrarPaso("checkoutResultado");
}

function numeroWhatsAppParaPedido() {
  if (pedidoActual.modalidad === "recoger") {
    const sucursal = CONFIG.sucursales[pedidoActual.cliente.sucursal];
    return CONFIG.whatsapp[sucursal.whatsapp];
  }

  // Domicilios solo para puntos 2 y 3.
  const sucursal = CONFIG.sucursales[pedidoActual.cliente.sucursal];
  if (sucursal) return CONFIG.whatsapp[sucursal.whatsapp];

  // Si no se eligió sucursal para domicilio, por defecto se informa al punto 2.
  return CONFIG.whatsapp.punto2;
}

function mensajePedido(estadoPago) {
  const p = pedidoActual;
  const modalidad = p.modalidad === "domicilio" ? "🛵 DOMICILIO" : "🏪 RECOGER EN SUCURSAL";

  return `*EMPANADAS QUE RICO — PEDIDO #${p.numero}*

👤 *CLIENTE*
Nombre: ${p.cliente.nombre}
Teléfono: ${p.cliente.telefono}

📍 *ENTREGA*
Modalidad: ${modalidad}
${p.modalidad === "domicilio"
  ? `Ciudad: ${p.cliente.ciudad}
Zona: ${p.cliente.zona}
Dirección: ${p.cliente.direccion}`
  : `Sucursal: ${p.cliente.sucursal}`}

🍽️ *PRODUCTOS*
${listaPedidoTexto()}

📦 Empaque: ${p.cliente.empaque === "bolsa" && p.modalidad === "recoger" ? "Bolsa — $0" : "Caja — " + dinero(p.empaque)}
🛵 Domicilio: ${dinero(p.domicilio)}
💰 *TOTAL: ${dinero(p.total)}*

💳 Método: ${p.metodo === "transferencia" ? "Transferencia" : "Efectivo"}
🟡 *ESTADO: ${estadoPago}*

📝 Observación: ${p.cliente.nota || "Sin observaciones"}`;
}

function abrirWhatsApp(numero, mensaje) {
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
}

async function guardarPedidoEnSupabase() {
  if (!window.supabase || !window.SUPABASE_CONFIG?.url || !window.SUPABASE_CONFIG?.anonKey) {
    throw new Error("No está disponible la conexión con Supabase.");
  }
  supabasePublico ||= window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
  if (!pedidoActual?.cliente?.sucursal) throw new Error("No se encontró la sucursal del pedido.");

  const { data, error } = await supabasePublico.rpc("registrar_pedido_publico", {
    p_sucursal: pedidoActual.cliente.sucursal,
    p_modalidad: pedidoActual.modalidad,
    p_metodo_pago: pedidoActual.metodo,
    p_cliente: pedidoActual.cliente,
    p_items: pedidoActual.items,
    p_subtotal: pedidoActual.subtotal,
    p_empaque: pedidoActual.empaque,
    p_domicilio: pedidoActual.domicilio,
    p_total: pedidoActual.total
  });
  if (error) throw error;

  const fila = Array.isArray(data) ? data[0] : data;
  if (fila?.numero_pedido) pedidoActual.numero = String(fila.numero_pedido);
  if (fila?.tracking_token) pedidoActual.tracking_token = fila.tracking_token;
  pedidoActual.estado = fila?.estado || "verificacion";
  localStorage.setItem(`pedido_${pedidoActual.numero}`, JSON.stringify({
    estado: pedidoActual.estado,
    numero: pedidoActual.numero,
    tracking_token: pedidoActual.tracking_token || null
  }));
  iniciarSeguimiento(pedidoActual.numero);
  return fila;
}

async function enviarPedidoYComprobante() {
  const boton = event?.currentTarget;
  if (boton) { boton.disabled = true; boton.textContent = "Guardando pedido…"; }
  try {
    await guardarPedidoEnSupabase();
    const numero = numeroWhatsAppParaPedido();
    abrirWhatsApp(numero, mensajePedido("PAGO REALIZADO — COMPROBANTE PENDIENTE DE VERIFICACIÓN") +
      "\n\n⚠️ *ADJUNTA AQUÍ EL COMPROBANTE DE TRANSFERENCIA.*");
    mostrarPantallaVerificacion();
  } catch (error) {
    console.error("No se pudo registrar el pedido en Supabase:", error);
    alert("No pudimos registrar el pedido en el sistema. No se enviará todavía por WhatsApp.\n\nDetalle: " + (error?.message || "Error desconocido"));
    if (boton) { boton.disabled = false; boton.textContent = "📲 Enviar pedido y comprobante"; }
  }
}

async function enviarPedidoEfectivo() {
  const boton = event?.currentTarget;
  if (boton) { boton.disabled = true; boton.textContent = "Guardando pedido…"; }
  try {
    await guardarPedidoEnSupabase();
    abrirWhatsApp(numeroWhatsAppParaPedido(), mensajePedido("PAGO EN EFECTIVO — PENDIENTE DE ENTREGA"));
    mostrarPantallaVerificacion("efectivo");
  } catch (error) {
    console.error("No se pudo registrar el pedido en Supabase:", error);
    alert("No pudimos registrar el pedido en el sistema. No se enviará todavía por WhatsApp.\n\nDetalle: " + (error?.message || "Error desconocido"));
    if (boton) { boton.disabled = false; boton.textContent = "📲 Enviar pedido al WhatsApp"; }
  }
}

function mostrarPantallaVerificacion(metodo = "transferencia") {
  const url = crearEnlaceSeguimiento("verificacion");

  document.getElementById("checkoutResultado").innerHTML = `
    <div class="verification-screen">
      <div class="status-icon yellow">🟡</div>
      <span class="order-code">Pedido #${pedidoActual.numero}</span>
      <h2>Pedido en verificación</h2>
      <p>Tu pedido fue enviado al negocio.</p>
      <p>${metodo === "transferencia"
        ? "Recibimos el aviso de pago. El negocio verificará el comprobante antes de validar el pedido."
        : "El pedido fue recibido y el negocio continuará con la preparación."}</p>
      <div class="status-note">No cierres esta información si necesitas consultar el número de pedido.</div>
      <button class="secondary-btn full" onclick="copiarSeguimiento()">🔗 Copiar enlace de seguimiento</button>
      <button class="primary-btn full" onclick="cerrarYLimpiar()">Finalizar</button>
    </div>`;

  localStorage.setItem(`pedido_${pedidoActual.numero}`, JSON.stringify({
    estado: "verificacion",
    numero: pedidoActual.numero
  }));
}

function mostrarReciboPendiente() {
  document.getElementById("checkoutResultado").innerHTML = `
    <div class="receipt">
      <span class="eyebrow">Pedido #${pedidoActual.numero}</span>
      <h2>Resumen</h2>
      ${resumenCompletoHTML()}
      <p>🟡 Estado: en verificación después de enviar el comprobante.</p>
    </div>
    <button class="primary-btn full" onclick="enviarPedidoYComprobante()">📲 Enviar comprobante</button>`;
}

function cerrarYLimpiar() {
  carrito = [];
  guardarCarrito();
  renderCarrito();
  cerrarCheckout();
  modalidadEntrega = null;
}

/* =========================
   7. SEGUIMIENTO
   ========================= */
let seguimientoTimer = null;
let seguimientoNumero = null;

function crearEnlaceSeguimiento(estado = "verificacion") {
  const base = window.location.href.split("#")[0].split("?")[0];
  return `${base}?pedido=${encodeURIComponent(pedidoActual.numero)}#seguimientoPedido`;
}

function detenerSeguimiento(){
  if(seguimientoTimer){ clearInterval(seguimientoTimer); seguimientoTimer=null; }
  seguimientoNumero=null;
}

async function obtenerEstadoPedido(numero){
  const {data,error}=await supabasePublico.rpc("consultar_pedido_por_numero",{p_numero:String(numero)});
  if(error) throw error;
  const fila=Array.isArray(data)?data[0]:data;
  return fila||null;
}

async function actualizarSeguimiento(numero, mostrarError=false){
  try{
    const fila=await obtenerEstadoPedido(numero);
    if(!fila){
      if(mostrarError) alert("No encontramos ese pedido. Verifica el número e inténtalo de nuevo.");
      return;
    }
    const estado=fila.estado||"verificacion";
    const guardado=JSON.parse(localStorage.getItem(`pedido_${numero}`)||"null")||{};
    localStorage.setItem(`pedido_${numero}`,JSON.stringify({
      ...guardado, estado, numero:String(numero)
    }));
    mostrarEstadoPedido(numero,estado,fila.motivo_invalido);
  }catch(error){
    console.warn("No se pudo consultar el estado del pedido.",error);
    if(mostrarError) alert("No pudimos consultar el estado del pedido. Inténtalo nuevamente.\n\nDetalle: "+(error?.message||"Error desconocido"));
  }
}

function iniciarSeguimiento(numero){
  detenerSeguimiento();
  seguimientoNumero=String(numero);
  actualizarSeguimiento(seguimientoNumero);
  // Consulta periódica segura mediante RPC. No expone públicamente todos los pedidos.
  seguimientoTimer=setInterval(()=>actualizarSeguimiento(seguimientoNumero),5000);
}

async function consultarPedido() {
  const numero = document.getElementById("consultaPedido").value.trim().replace("#","");
  if (!numero) {
    alert("Escribe el número de pedido.");
    return;
  }
  await actualizarSeguimiento(numero,true);
  iniciarSeguimiento(numero);
}

function mostrarEstadoPedido(numero, estado, motivo=null) {
  const card = document.getElementById("estadoPedidoCard");
  const data = {
    verificacion: {icon:"🟡", clase:"yellow", titulo:"Pedido en verificación", texto:"Recibimos tu pedido. El negocio está verificando la información."},
    validado: {icon:"🟢", clase:"green", titulo:"¡Pedido validado!", texto:"El negocio validó tu pedido. Puedes continuar con el proceso de preparación y entrega."},
    preparacion: {icon:"👨‍🍳", clase:"green", titulo:"Pedido en preparación", texto:"Tu pedido está siendo preparado."},
    en_domicilio: {icon:"🛵", clase:"green", titulo:"Pedido en domicilio", texto:"Tu pedido salió para entrega."},
    entregado: {icon:"✅", clase:"green", titulo:"¡Pedido entregado!", texto:"Tu pedido fue entregado correctamente."},
    rechazado: {icon:"🔴", clase:"red", titulo:"Pedido rechazado", texto:motivo ? `El negocio no pudo validar el pedido: ${motivo}` : "El negocio no pudo validar el pedido. Comunícate con el punto correspondiente."}
  };
  const e = data[estado] || data.verificacion;
  card.innerHTML = `
    <div class="status-icon ${e.clase}">${e.icon}</div>
    <span class="order-code">Pedido #${escapar(numero)}</span>
    <h3>${e.titulo}</h3>
    <p>${escapar(e.texto)}</p>
  `;
  card.scrollIntoView({behavior:"smooth",block:"center"});
}

function copiarSeguimiento() {
  if(!pedidoActual?.numero){ alert("Primero debes tener un pedido registrado."); return; }
  const url = crearEnlaceSeguimiento();
  navigator.clipboard?.writeText(url).then(() => alert("Enlace de seguimiento copiado."));
}

function cargarEstadoDesdeURL() {
  const q = new URLSearchParams(window.location.search);
  const pedido = q.get("pedido");
  if (pedido) {
    document.getElementById("consultaPedido").value = pedido;
    iniciarSeguimiento(pedido);
  }
}

/* =========================
   8. INICIO
   ========================= */
// Inicialización segura: esperar a que exista el DOM antes de tocar #menuContainer y el carrito.
function inicializarIndexBase(){
  renderMenu();
  renderCarrito();
  cargarEstadoDesdeURL();
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", inicializarIndexBase);
else inicializarIndexBase();


/* =========================================================
   SUCURSAL DE DESTINO: DOMICILIO = SUCURSAL 2 O 3
   ========================================================= */
(function () {
  const sucursal = document.getElementById('sucursalDestino');
  const bloque = document.getElementById('sucursalEntrega');

  if (!sucursal || !bloque) return;

  function textoNormalizado(v) {
    return String(v || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function esDomicilio() {
    const radios = document.querySelectorAll(
      'input[type="radio"][name*="entrega" i], input[type="radio"][name*="delivery" i], input[type="radio"]'
    );
    for (const r of radios) {
      if (r.checked) {
        const t = textoNormalizado(r.value + ' ' + r.id + ' ' + r.parentElement?.textContent);
        if (t.includes('domicilio')) return true;
      }
    }
    return textoNormalizado(document.body.textContent).includes('domicilio') &&
           !!document.querySelector('#domicilio, #datosDomicilio, .datos-domicilio');
  }

  function actualizarSucursal() {
    const domicilio = esDomicilio();
    bloque.style.display = domicilio ? '' : 'none';
    if (!domicilio) sucursal.value = '';
  }

  document.addEventListener('change', actualizarSucursal);
  actualizarSucursal();

  // Expose the value so the existing order/WhatsApp logic can use it.
  window.obtenerSucursalDestino = function () {
    return sucursal.value || '';
  };
})();

/* Añade la sucursal al texto final de WhatsApp cuando sea necesario. */
window.agregarSucursalAlMensaje = function (mensaje) {
  const s = window.obtenerSucursalDestino ? window.obtenerSucursalDestino() : '';
  if (!s) return mensaje;
  return String(mensaje) + "\n🏪 Sucursal de preparación/envío: " + s;
};

/* =========================================================
   EMPANADAS QUE RICO V4 — SUCURSALES, HORARIOS Y MENÚS
   ========================================================= */
const V4_PUNTOS = {
  Centro: {
    numero: 1, nombre: "Punto 1 — Bombay 3", ciudad:"Dosquebradas, Risaralda",
    direccion:"Manzana 10, Casa 16, Bombay 3",
    horario:"Lunes a sábado desde las 3:00 PM", domicilios:false,
    mapa:"https://www.google.com/maps/search/?api=1&query=Manzana+10+Casa+16+Bombay+3+Dosquebradas+Risaralda"
  },
  Cuba: {
    numero: 2, nombre: "Punto 2 — Barrio El Modelo", ciudad:"Dosquebradas, Risaralda",
    direccion:"Calle 49 # 19-27, Barrio El Modelo",
    horario:"Lunes a sábado desde las 2:00 PM", domicilios:true,
    mapa:"https://www.google.com/maps/search/?api=1&query=Calle+49+19-27+Barrio+El+Modelo+Dosquebradas+Risaralda"
  },
  Circunvalar: {
    numero: 3, nombre: "Punto 3 — Barrio Providencia", ciudad:"Pereira, Risaralda",
    direccion:"Carrera 20 # 21-26, Barrio Providencia",
    horario:"Lunes a sábado desde las 3:00 PM", domicilios:true,
    mapa:"https://www.google.com/maps/search/?api=1&query=Carrera+20+21-26+Barrio+Providencia+Pereira+Risaralda"
  }
};

const V4_HORARIOS = {
  Centro:{inicio:15*60, domicilioInicio:null},
  Cuba:{inicio:14*60, domicilioInicio:15*60},
  Circunvalar:{inicio:15*60, domicilioInicio:15*60}
};

const V4_SALSAS = [
  ["salsa-pimenton","Pimentón","Salsa para acompañar.",null],
  ["salsa-aji","Aji","Salsa para acompañar.",null],
  ["salsa-jalapeno","Jalapeño","Salsa para acompañar.",null],
  ["salsa-miel-jalapeno","miel de jalapeño","Salsa para acompañar.",null],
  ["salsa-guacamole-picante","Guacamole picante","Salsa para acompañar.",null],
  ["salsa-miel-mostaza-picante","Miel mostaza picante","Salsa para acompañar.",null],
  ["salsa-miel-mostaza","Miel mostaza","Salsa para acompañar.",null],
  ["salsa-pina-picante","Piña picante","Salsa para acompañar.",null],
  ["salsa-pina","Piña","Salsa para acompañar.",null],
  ["salsa-aji-puro","Aji puro","Salsa para acompañar.",null],
  ["salsa-mayonesa-jalapeno","mayonesa jalapeño","Salsa para acompañar.",null],
  ["salsa-queso","Queso","Salsa para acompañar.",null],
  ["salsa-maiz","Maíz","Salsa para acompañar.",null],
  ["salsa-rosada","Rosada","Salsa para acompañar.",null],
  ["salsa-tartara","Tártara","Salsa para acompañar.",null],
  ["salsa-crema-lena","Crema de leña","Salsa para acompañar.",null],
  ["salsa-maracuya","Maracuyá","Salsa para acompañar.",null],
  ["salsa-maracuya-picante","Maracuyá picante","Salsa para acompañar.",null],
  ["salsa-guacamole","Guacamole","Salsa para acompañar.",null],
  ["salsa-tocineta","Tocineta","Salsa para acompañar.",null],
  ["salsa-rosada-pepinillos","Rosada con pepinillos","Salsa para acompañar.",null],
  ["salsa-mora","Mora","Salsa para acompañar.",null],
  ["salsa-ochua","Ochua","Salsa para acompañar.",null],
  ["salsa-mayomostaza","Mayomostaza","Salsa para acompañar.",null],
  ["salsa-bbq","BBQ","Salsa para acompañar.",null],
  ["salsa-ajo","Ajo","Salsa para acompañar.",null],
  ["salsa-ceviche","Ceviche","Salsa para acompañar.",null],
  ["salsa-ceviche-picante","Ceviche picante","Salsa para acompañar.",null],
  ["salsa-encurtido","Encurtido","Salsa para acompañar.",null],
  ["salsa-cilantro","Cilantro","Salsa para acompañar.",null]
];
const V4_GASEOSAS = [
  ["jugo-del-valle-mango-fresa-500","MANGO FRESA 500ML","Jugo Del Valle.",5000],
  ["jugo-del-valle-mango-500","MANGO 500ML","Jugo Del Valle.",5000],
  ["jugo-del-valle-salpicon-500","SALPICON 500ML","Jugo Del Valle.",5000],
  ["power-mountain-blast-500","POWER MOUNTAIN BLAST 500ML","Bebida Power.",5000],
  ["power-frutas-tropicales-500","POWER FRUTAS TROPICALES 500ML","Bebida Power.",5000],
  ["fuzetea-400","FUZETEA 400ML","Bebida fría.",4000],
  ["coca-cola-original-400","COCA-COLA ORIGINAL 400ML","Bebida gaseosa.",4000],
  ["coca-cola-zero-400","COCA-COLA ZERO 400ML","Bebida gaseosa sin azúcar.",4000],
  ["brisa-agua-pura-1l","BRISA AGUA PURA 1L","Agua.",3000],
  ["brisa-agua-pura-600","BRISA AGUA PURA 600ML","Agua.",2000],
  ["brisa-gas-600","BRISA CON GAS 600ML","Agua con gas.",2000],
  ["brisa-gas-maracuya-600","BRISA CON GAS MARACUYÁ 600ML","Agua con gas.",4000],
  ["brisa-gas-manzana-600","BRISA CON GAS MANZANA 600ML","Agua con gas.",40000],
  ["coca-cola-original-1-5l","COCA-COLA ORIGINAL 1.5L","Bebida gaseosa.",7000],
  ["coca-cola-zero-1-5l","COCA-COLA ZERO 1.5L","Bebida gaseosa sin azúcar.",7000],
  ["coca-cola-original-1l","COCA-COLA ORIGINAL 1L","Bebida gaseosa.",null],
  ["avena-casera","AVENA CASERA","Bebida.",5000],
  ["quatro-original-toronja-400","QUATRO SABOR ORIGINAL TORONJA 400L","Bebida gaseosa.",4000],
  ["soda-schweppes-400","SODA SCHEPPES 400ML","Bebida gaseosa.",4000],
  ["premio-rojo-400","PREMIO ROJO 400ML","Bebida gaseosa.",4000],
  ["sprite-original-400","SPRITE SABOR ORIGINAL LIMA LIMON 400ML","Bebida gaseosa.",4000],
  ["del-valle-ponche-400","DEL VALLE PONCHE DE FRUTAS 400ML","Jugo Del Valle.",4000],
  ["del-valle-frutas-criticas-400","DEL VALLE FRUTAS CRITICAS 400ML","Jugo Del Valle.",4000],
  ["ginger-ale-schweppes-400","GINGER ALE SCHEPPES 400ML","Bebida gaseosa.",4000],
  ["coca-cola-lata-original-330","COCA-COLA EN LATA ORIGINAL 330ML","Bebida gaseosa.",4000],
  ["coca-cola-zero-250","COCA-COLA ZERO 250ML","Bebida gaseosa sin azúcar.",3000],
  ["coca-cola-original-250","COCA-COLA ORIGINAL 250ML","Bebida gaseosa.",3000],
  ["fanta-naranja-269","FANTA NARANJA 269ML","Bebida gaseosa.",4000],
  ["fanta-roja-269","FANTA ROJA 269 ML","Bebida gaseosa.",4000],
  ["brisa-gas-manzana-280","BRISA CON GAS MANZANA 280ML","Agua con gas.",3000],
  ["brisa-gas-maracuya-280","BRISA CON GAS MARACUYÁ 280ML","Agua con gas.",3000],
  ["del-valle-ponche-1-5l","DEL VALLE PONCHE DE FRUTAS 1.5L","Jugo Del Valle.",7000],
  ["del-valle-mango-1-2l","DEL VALLE MANGO 1.2 L","Jugo Del Valle.",6000],
  ["del-valle-mango-fresa-1-2l","DEL VALLE MANGO FRESA 1.2L","Jugo Del Valle.",6000],
  ["del-valle-mora-1-2l","DEL VALLE MORA 1.2L","Jugo Del Valle.",6000],
  ["coca-cola-original-2-5l","COCA-COLA ORIGINAL 2.5L","Bebida gaseosa.",9000],
  ["sprite-original-1-5l","SPRITE SABOR ORIGINAL LIMA LIMON 1.5L","Bebida gaseosa.",7000],
  ["quatro-original-toronja-1-5l","QUATRO SABOR ORIGINAL TORONJA 1.5L","Bebida gaseosa.",7000],
  ["del-valle-frutas-criticas-1-5l","DEL VALLE FRUTAS CRITICAS 1.5L","Jugo Del Valle.",7000]
];
const V4_CONGELADAS = [
  ["cong-carne","Empanadas congeladas de carne x12","Paquete de 12 unidades.",24000],
  ["cong-pollo","Empanadas congeladas de pollo x12","Paquete de 12 unidades.",24000],
  ["cong-mixta","Empanadas congeladas mixtas x12","Paquete de 12 unidades.",24000],
  ["cong-queso","Empanadas congeladas de queso x12","Paquete de 12 unidades.",30000],
  ["cong-barril","Empanadas congeladas de carne al barril x12","Paquete de 12 unidades.",30000],
  ["cong-ranchera","Empanadas congeladas rancheras x12","Paquete de 12 unidades.",30000],
  ["cong-chicharron","Empanadas congeladas de chicharrón x12","Paquete de 12 unidades.",30000]
];

function v4HoraColombia(){
  return new Date(new Date().toLocaleString("en-US",{timeZone:"America/Bogota"}));
}
function v4MinutosActuales(){
  const d=v4HoraColombia(); return d.getHours()*60+d.getMinutes();
}
function v4DiaCerrado(){
  return v4HoraColombia().getDay()===0;
}
function v4AbiertoPunto(p){
  if(v4DiaCerrado()) return false;
  return v4MinutosActuales() >= V4_HORARIOS[p].inicio;
}
function v4DomicilioDisponible(p){
  if(v4DiaCerrado() || !V4_PUNTOS[p].domicilios) return false;
  const m=v4MinutosActuales();
  return m>=15*60 && m<=22*60+30;
}
function v4EstadoPunto(p){
  if(v4DiaCerrado()) return "🔴 Cerrado hoy (domingo)";
  const h=V4_HORARIOS[p].inicio;
  if(v4MinutosActuales()<h) return "🕒 Abre desde "+(p==="Cuba"?"2:00 PM":"3:00 PM");
  return "🟢 Abierto";
}
function v4EstadoDomicilio(p){
  if(!V4_PUNTOS[p].domicilios) return "❌ Sin servicio a domicilio";
  if(v4DiaCerrado()) return "🔴 Domicilios cerrados hoy";
  const m=v4MinutosActuales();
  if(m<15*60) return "🕒 Domicilios desde las 3:00 PM";
  if(m>22*60+30) return "🔴 Domicilios cerrados · hasta las 10:30 PM";
  return "🟢 Domicilios disponibles · 3:00 PM a 10:30 PM";
}

function v4Producto(base, id, cat, icon, nombre, desc, precio){
  return {id,cat,icon,nombre,desc,precio,puntos:base};
}

const V4_PRODUCTOS_EXTRA = [
  ...V4_SALSAS.map(x=>v4Producto(["Centro","Cuba","Circunvalar"],x[0],"Salsas","🧂",x[1],x[2],x[3])),
  ...V4_GASEOSAS.map(x=>v4Producto(["Cuba","Circunvalar"],x[0],"Gaseosas Coca-Cola","🥤",x[1],x[2],x[3])),
  ...V4_CONGELADAS.map(x=>v4Producto(["Cuba","Circunvalar"],x[0],"Empanadas congeladas","🧊",x[1],x[2],x[3]))
];
const V4_BASE_PRODUCTS = [
  {id:"mega-tradicional",cat:"Mega empanadas de 30 cm",icon:"🥟",nombre:"Mega Tradicional",desc:"Mega empanada tradicional de 30 cm.",precio:12000,puntos:["Centro","Cuba","Circunvalar"]},
  {id:"mega-carne-desmechada",cat:"Mega empanadas de 30 cm",icon:"🥟",nombre:"Mega de Carne Desmechada",desc:"Mega empanada de 30 cm con carne desmechada.",precio:15000,puntos:["Centro","Cuba","Circunvalar"]},
  {id:"mega-barril",cat:"Mega empanadas de 30 cm",icon:"🥟",nombre:"Mega Barril",desc:"Mega empanada de 30 cm.",precio:15000,puntos:["Centro","Cuba","Circunvalar"]},
  {id:"mega-arroz-arecho",cat:"Mega empanadas de 30 cm",icon:"🥟",nombre:"Mega de Arroz Arecho",desc:"Mega empanada de 30 cm con arroz arecho.",precio:15000,puntos:["Centro","Cuba","Circunvalar"]},
  {id:"emp-carne",cat:"Empanadas",icon:"🥟",nombre:"Empanada de Carne",desc:"Empanada tradicional de carne.",precio:3000,puntos:["Centro","Cuba","Circunvalar"]},
  {id:"emp-pollo",cat:"Empanadas",icon:"🥟",nombre:"Empanada de Pollo",desc:"Empanada tradicional de pollo.",precio:3000,puntos:["Centro","Cuba","Circunvalar"]},
  {id:"emp-queso",cat:"Empanadas",icon:"🥟",nombre:"Empanada de Queso",desc:"Empanada rellena de queso.",precio:3500,puntos:["Centro","Cuba","Circunvalar"]},
  {id:"emp-mixta",cat:"Empanadas",icon:"🥟",nombre:"Empanada Mixta",desc:"Deliciosa combinación de carne y pollo.",precio:4000,puntos:["Centro","Cuba","Circunvalar"]},
];
const PRODUCTOS_V4=[...V4_BASE_PRODUCTS,...V4_PRODUCTOS_EXTRA];
let productosPublicosV4=[...PRODUCTOS_V4];

async function cargarProductosPublicos(){
  try{
    if(!window.supabase || !window.SUPABASE_CONFIG?.url || !window.SUPABASE_CONFIG?.anonKey) return;
    supabasePublico ||= window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
    const {data,error}=await supabasePublico.from("productos")
      .select("id,categoria,icono,nombre,descripcion,precio,sucursales,activo,imagen_url")
      .eq("activo",true)
      .order("categoria",{ascending:true})
      .order("nombre",{ascending:true});
    if(error) throw error;
    // Supabase es la fuente de verdad. El menú local solo queda como respaldo
    // si la base no está disponible; no se mezclan listas hardcodeadas con la DB.
    productosPublicosV4=(data||[]).map(x=>({
      id:String(x.id),
      cat:String(x.categoria||"Extras"),
      icon:String(x.icono||"🍽️"),
      imagen:String(x.imagen_url||""),
      nombre:String(x.nombre||x.id),
      desc:String(x.descripcion||""),
      precio:x.precio==null?null:Number(x.precio),
      puntos:Array.isArray(x.sucursales)?x.sucursales:[]
    })).filter(x=>x.puntos.length>0);
  }catch(e){
    console.warn("No se pudieron cargar los productos desde Supabase. Se usará el menú local de respaldo.",e);
    productosPublicosV4=[...PRODUCTOS_V4];
  }
}

function activarRealtimePublico(){
  if(!supabasePublico || supabasePublicoRealtimeChannel) return;
  supabasePublicoRealtimeChannel=supabasePublico.channel("menu-publico-live")
    .on("postgres_changes",{event:"*",schema:"public",table:"productos"},async()=>{
      await cargarProductosPublicos();
      renderMenu();
      v4ActualizarUI();
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"configuracion_domicilios"},async()=>{
      await cargarConfiguracionDomiciliosPublica();
      v4ActualizarUI();
      renderMenu();
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"configuracion_ciudades_domicilios"},async()=>{
      await cargarConfiguracionDomiciliosPublica();
      v4ActualizarUI();
    })
    .subscribe();
}

function v4SetPunto(p){
  if(!Object.prototype.hasOwnProperty.call(V4_PUNTOS,p)) return false;
  localStorage.setItem("sucursalEmpanadasQueRico",p);
  localStorage.setItem("puntoSeleccionado",String(V4_PUNTOS[p].numero));
  localStorage.setItem("sucursalSeleccionada",p);
  window.sucursalSeleccionadaV4=p;
  // Clear incompatible cart items when switching points.
  carrito = carrito.filter(i=>productosPublicosV4.find(x=>x.id===i.id)?.puntos.includes(p));
  guardarCarrito();
  renderMenu();
  renderCarrito();
  v4ActualizarUI();
  return true;
}
function v4GetPunto(){
  const p=localStorage.getItem("sucursalEmpanadasQueRico")||"";
  return Object.prototype.hasOwnProperty.call(V4_PUNTOS,p) ? p : "";
}

let categoriaMenuActiva = "all";

function obtenerCategoriasMenu(lista){
  const ordenPreferido = [
    "Empanadas",
    "Mega empanadas de 30 cm",
    "Empanadas congeladas",
    "Congeladas",
    "Extras",
    "Papas rellenas",
    "Arepas",
    "Gaseosas Coca-Cola",
    "Salsas"
  ];
  const existentes = [...new Set(lista.map(x=>String(x.cat||"").trim()).filter(Boolean))];
  return [
    ...ordenPreferido.filter(c=>existentes.includes(c)),
    ...existentes.filter(c=>!ordenPreferido.includes(c))
  ];
}

function renderMenuCategoryTabs(lista){
  const tabs=document.getElementById("menuCategoryTabs");
  if(!tabs)return;
  const cats=obtenerCategoriasMenu(lista);
  if(!cats.length){tabs.innerHTML="";return;}
  if(categoriaMenuActiva!=="all" && !cats.includes(categoriaMenuActiva)) categoriaMenuActiva="all";
  const iconos={
    "Mega empanadas de 30 cm":"📏",
    "Empanadas":"🥟",
    "Empanadas congeladas":"🧊",
    "Congeladas":"🧊",
    "Extras":"➕",
    "Papas rellenas":"🥔",
    "Arepas":"🫓",
    "Coca-Cola":"🥤",
    "Postobón":"🥤",
    "Gaseosas Coca-Cola":"🥤",
    "Salsas":"🧂"
  };
  tabs.innerHTML=[
    `<button type="button" class="menu-category-tab ${categoriaMenuActiva==="all"?"active":""}" data-menu-cat="all" role="tab" aria-selected="${categoriaMenuActiva==="all"}">🍽️ Todo el menú</button>`,
    ...cats.map(cat=>`<button type="button" class="menu-category-tab ${categoriaMenuActiva===cat?"active":""}" data-menu-cat="${escapar(cat)}" role="tab" aria-selected="${categoriaMenuActiva===cat}">${iconos[cat]||"•"} ${escapar(cat)}</button>`)
  ].join("");
  tabs.querySelectorAll(".menu-category-tab").forEach(btn=>btn.addEventListener("click",()=>{
    categoriaMenuActiva=btn.dataset.menuCat||"all";
    renderMenu();
    const menu=document.getElementById("menu");
    if(menu) menu.scrollIntoView({behavior:"smooth",block:"start"});
  }));
}

function renderMenu(){
  const cont=document.getElementById("menuContainer"); if(!cont)return;
  const p=v4GetPunto();
  if(!p){
    categoriaMenuActiva="all";
    const tabs=document.getElementById("menuCategoryTabs"); if(tabs)tabs.innerHTML="";
    cont.innerHTML=`<div class="empty-menu"><div>📍</div><h3>Primero elige tu punto</h3><p>Selecciona una sucursal arriba para ver el menú disponible.</p><button class="primary-btn" onclick="mostrarSelectorSucursal()">Elegir sucursal</button></div>`;
    return;
  }
  const lista=productosPublicosV4.filter(x=>x.puntos.includes(p));
  renderMenuCategoryTabs(lista);
  const listaFiltrada=categoriaMenuActiva==="all" ? lista : lista.filter(x=>x.cat===categoriaMenuActiva);
  const grupos={}; listaFiltrada.forEach(x=>(grupos[x.cat]??=[]).push(x));
  cont.innerHTML=Object.entries(grupos).map(([cat,arr])=>`
    <section class="menu-category" data-category="${escapar(cat)}">
      <div class="category-title"><h3>${escapar(cat)}</h3><span>${arr.length} opciones</span></div>
      <div class="product-grid">${arr.map(x=>`
        <article class="product" data-name="${escapar(x.nombre.toLowerCase())}">
          <div class="product-image">${x.imagen?`<img src="${escapar(x.imagen)}" alt="${escapar(x.nombre)}" loading="lazy">`:x.icon}</div>
          <div class="product-content"><h4>${escapar(x.nombre)}</h4><p>${escapar(x.desc)}</p>
          <div class="product-bottom"><strong class="price">${x.cat === "Salsas" ? "Gratis" : (x.precio == null ? "Precio no definido" : dinero(x.precio))}${p === "Centro" ? "" : `<button class="add" onclick="agregar('${x.id}')">+ Agregar</button>`}</div>
          </div>
        </article>`).join("")}</div>
    </section>`).join("") || `<div class="empty-menu"><div>🔎</div><h3>No hay productos en esta ventana</h3><p>Prueba otra categoría.</p></div>`;
  const tituloSucursalMenu=document.getElementById("tituloSucursalMenu");
  if(tituloSucursalMenu) tituloSucursalMenu.textContent=V4_PUNTOS[p].nombre;
  const subtituloSucursalMenu=document.getElementById("subtituloSucursalMenu");
  if(subtituloSucursalMenu) subtituloSucursalMenu.textContent=V4_PUNTOS[p].horario+" · "+v4EstadoDomicilio(p);
}
function v4ActualizarUI(){
  const p=v4GetPunto();
  const b=document.getElementById("sucursalActualBanner");
  if(b) b.innerHTML=p ? (p === "Centro"
    ? `📍 <strong>${V4_PUNTOS[p].nombre}</strong> · ${V4_PUNTOS[p].ciudad}<br><small>${V4_PUNTOS[p].direccion} · ${v4EstadoPunto(p)} · <strong>Solo menú · sin pedidos ni domicilios</strong></small><button class="link-btn" onclick="mostrarSelectorSucursal()">Cambiar punto</button>`
    : `📍 <strong>${V4_PUNTOS[p].nombre}</strong> · ${V4_PUNTOS[p].ciudad}<br><small>${V4_PUNTOS[p].direccion} · ${v4EstadoPunto(p)} · ${v4EstadoDomicilio(p)}</small><button class="link-btn" onclick="mostrarSelectorSucursal()">Cambiar punto</button>`) : "";
  const cartBtn=document.querySelector(".cart-button");
  if(cartBtn) {
    cartBtn.style.display = p === "Centro" ? "none" : "";
    cartBtn.setAttribute("aria-hidden", p === "Centro" ? "true" : "false");
  }
  const heroTitle=document.querySelector(".hero h1");
  const heroText=document.querySelector(".hero-copy > p");
  if(heroTitle && p === "Centro") heroTitle.innerHTML="Consulta el menú.<br><span>Bombay 3</span>";
  if(heroTitle && p !== "Centro") heroTitle.innerHTML="Elige tu punto.<br><span>Arma tu pedido.</span>";
  if(heroText && p === "Centro") heroText.textContent="Punto 1 — Bombay 3: consulta nuestro menú. Este punto funciona únicamente como menú; no recibe pedidos ni domicilios.";
  if(heroText && p !== "Centro") heroText.textContent="Selecciona una sucursal y disfruta el menú disponible. Puedes pedir para recoger o solicitar domicilio cuando el punto tenga ese servicio.";
  document.querySelectorAll("[data-v4-punto]").forEach(el=>{
    const q=el.dataset.v4Punto;
    el.classList.toggle("selected",q===p);
    const st=el.querySelector(".v4-status"); if(st)st.textContent=v4EstadoPunto(q);
    const ds=el.querySelector(".v4-delivery"); if(ds)ds.textContent=v4EstadoDomicilio(q);
  });
  renderMenu();
  const dom=document.querySelector('.delivery-choice[data-tipo="domicilio"]');
  if(dom){
    const allowed=p && V4_PUNTOS[p].domicilios && v4DomicilioDisponible(p);
    dom.disabled=!allowed;
    dom.classList.toggle("disabled",!allowed);
    dom.querySelector("small").textContent=allowed?"3:00 PM a 10:30 PM":(p&&V4_PUNTOS[p].domicilios?"Disponible de 3:00 PM a 10:30 PM":"Solo puntos 2 y 3");
  }
}
function mostrarSelectorSucursal(){
  const o=document.getElementById("overlaySucursal");
  if(!o){ console.error("No existe #overlaySucursal"); return false; }
  // Reconstruir siempre el contenido si está vacío.
  if(!o.querySelector(".v4-simple-options")) v4CrearSelector();
  // .hidden usa !important; por eso se elimina antes de mostrar.
  o.classList.remove("hidden");
  o.style.setProperty("display","grid","important");
  o.setAttribute("aria-hidden","false");
  return false;
}
function cerrarSelectorSucursal(){
  const o=document.getElementById("overlaySucursal");
  if(!o)return false;
  o.classList.add("hidden");
  o.style.removeProperty("display");
  o.setAttribute("aria-hidden","true");
  return false;
}
function seleccionarSucursal(nombre){
  if(!Object.prototype.hasOwnProperty.call(V4_PUNTOS,nombre)){
    console.error("Sucursal no válida:",nombre); return false;
  }
  if(!v4SetPunto(nombre)) return false;

  // Bombay 3 es únicamente informativo: no permite pedidos, carrito ni domicilios.
  if(nombre === "Centro") {
    carrito = [];
    modalidadEntrega = null;
    guardarCarrito();
  }

  const overlay=document.getElementById("overlaySucursal");
  if(overlay){
    overlay.classList.add("hidden");
    overlay.style.removeProperty("display");
    overlay.setAttribute("aria-hidden","true");
  }

  const recoger=document.getElementById("clienteSucursal");
  if(recoger)recoger.value=nombre;

  const domicilio=document.getElementById("clienteSucursalDomicilio");
  if(domicilio)domicilio.value=(nombre==="Cuba"||nombre==="Circunvalar")?nombre:"";
  return false;
}
// Exponer explícitamente las funciones usadas por los botones HTML.
window.mostrarSelectorSucursal = mostrarSelectorSucursal;
window.cerrarSelectorSucursal = cerrarSelectorSucursal;
window.seleccionarSucursal = seleccionarSucursal;
function seleccionarEntrega(tipo){
  const p=v4GetPunto();
  if(tipo==="domicilio" && (!p || !V4_PUNTOS[p].domicilios || !v4DomicilioDisponible(p))){
    alert(p && V4_PUNTOS[p].domicilios ? "Los domicilios están disponibles de 3:00 PM a 10:30 PM, de lunes a sábado." : "El punto seleccionado no tiene servicio a domicilio.");
    return;
  }
  modalidadEntrega=tipo;
  document.getElementById("formEntrega").classList.remove("hidden");
  document.getElementById("camposDomicilio").classList.toggle("hidden",tipo!=="domicilio");
  document.getElementById("camposRecoger").classList.toggle("hidden",tipo!=="recoger");
  document.getElementById("avisoCajaDomicilio").classList.toggle("hidden",tipo!=="domicilio");
  document.getElementById("clienteCiudad").required=tipo==="domicilio";
  document.getElementById("clienteZona").required=tipo==="domicilio";
  document.getElementById("clienteDireccion").required=tipo==="domicilio";
  document.getElementById("clienteSucursalDomicilio").required=tipo==="domicilio";
  document.getElementById("clienteSucursal").required=tipo==="recoger";
  if(tipo==="domicilio"){
    const sel=document.getElementById("clienteSucursalDomicilio");
    sel.value=p==="Cuba"?"Cuba":p==="Circunvalar"?"Circunvalar":"";
  } else {
    const sel=document.getElementById("clienteSucursal"); if(sel)sel.value=p||"";
  }
  document.getElementById("resumenModalidad").innerHTML=tipo==="domicilio"
    ? `🛵 <strong>Domicilio seleccionado.</strong> ${V4_PUNTOS[p].nombre} · 3:00 PM a 10:30 PM.`
    : `🏪 <strong>Recoger en sucursal.</strong> ${V4_PUNTOS[p]?.nombre||"Selecciona el punto"}.`;
  renderCarrito();
}
function v4CrearSelector(){
  const o=document.getElementById("overlaySucursal");
  if(!o)return;

  o.innerHTML=`<div class="v4-selector v4-selector-simple">
    <button type="button" class="v4-simple-close" aria-label="Cerrar" onclick="cerrarSelectorSucursal()">✕</button>
    <div class="v4-logo">🥟</div>
    <span class="eyebrow">EMPANADAS QUE RICO</span>
    <h1>Elige tu sucursal</h1>
    <p>Selecciona el punto donde quieres realizar tu pedido.</p>

    <div class="v4-simple-options">
      ${Object.entries(V4_PUNTOS).map(([k,p])=>`
        <button type="button" class="v4-simple-option" data-sucursal="${k}" onclick="seleccionarSucursal('${k}')">
          <span class="v4-simple-number">0${p.numero}</span>
          <span class="v4-simple-icon">📍</span>
          <span class="v4-simple-info">
            <strong>${p.nombre}</strong>
            <small>${p.ciudad} · ${p.direccion}</small>
            <small>🕒 ${p.horario}</small>
          </span>
          <span class="v4-simple-arrow">→</span>
        </button>`).join("")}
    </div>

    <div class="v4-sunday">🔴 <strong>Domingo: cerrado.</strong></div>
  </div>`;
}
function v4CrearPuntos(){
  const s=document.getElementById("puntosFisicos"); if(!s)return;
  s.innerHTML=Object.entries(V4_PUNTOS).map(([k,p])=>`
    <article class="location-card">
      <div class="location-top"><span>0${p.numero}</span><span>📍</span></div>
      <h3>${p.nombre}</h3><p>${p.direccion}</p><strong>${p.ciudad}</strong>
      <div class="location-info">🕒 ${p.horario}</div>
      <div class="location-info">${v4EstadoDomicilio(k)}</div>
      <a href="${p.mapa}" target="_blank" rel="noopener" class="map-button">🗺️ Ver ubicación en Google Maps</a>
      <button class="secondary-btn full" data-sucursal="${k}" onclick="seleccionarSucursal('${k}')">Elegir este punto</button>
    </article>`).join("");
}
async function v4Inicial(){
  await cargarConfiguracionDomiciliosPublica();
  await cargarProductosPublicos();
  activarRealtimePublico();
  v4CrearSelector();
  v4CrearPuntos();
  const overlay=document.getElementById("overlaySucursal");
  const p=v4GetPunto();
  if(p){
    v4ActualizarUI();
    if(overlay) overlay.classList.add("hidden");
  }else{
    // Sin sucursal elegida, el selector debe quedar disponible al pulsar “Elegir sucursal”.
    if(overlay){ overlay.classList.add("hidden"); overlay.style.display="none"; overlay.setAttribute("aria-hidden","true"); }
    renderMenu();
  }
  setInterval(v4ActualizarUI,30000);
}
document.addEventListener("DOMContentLoaded",v4Inicial);

// Force domicile WhatsApp to follow the selected preparation point.
function numeroWhatsAppParaPedido(){
  const s=pedidoActual?.cliente?.sucursal || v4GetPunto();
  if(s==="Cuba") return CONFIG.whatsapp.punto2;
  if(s==="Circunvalar") return CONFIG.whatsapp.punto3;
  if(s==="Centro") return CONFIG.whatsapp.punto1;
  return CONFIG.whatsapp.punto2;
}


// Selector de sucursal: respaldo por eventos para que funcione aunque el HTML se cargue dinámicamente.
document.addEventListener("click", function(ev){
  const trigger = ev.target.closest && ev.target.closest('[data-accion="elegir-sucursal"], .js-elegir-sucursal');
  if(trigger){ ev.preventDefault(); mostrarSelectorSucursal(); }
  const choice = ev.target.closest && ev.target.closest('[data-sucursal]');
  if(choice){ ev.preventDefault(); seleccionarSucursal(choice.getAttribute("data-sucursal")); }
});
