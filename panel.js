let supabaseClient=null;
let rolActual="";
let pedidos=[];
let historial=[];
let panelRealtimeOrdersChannel=null;
let panelRealtimeProductsChannel=null;
let panelRealtimeTimer=null;

const ESTADOS={
  verificacion:["🟡","En verificación","b-verificacion"],
  validado:["🟢","Validado","b-validado"],
  rechazado:["🔴","Rechazado","b-rechazado"],
  preparacion:["🍳","En preparación","b-preparacion"],
  en_domicilio:["🛵","En domicilio","b-en_domicilio"],
  entregado:["✅","Entregado","b-entregado"]
};

function $(id){return document.getElementById(id)}
function dinero(n){return "$"+Number(n||0).toLocaleString("es-CO")}
function nombreSucursal(s){return ({Centro:"Bombay",Cuba:"Barrio El Modelo",Circunvalar:"Barrio Providencia"}[s]||s||"Sin sucursal")}
function escapar(t){return String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function client(){
  if(supabaseClient) return supabaseClient;
  const cfg=window.SUPABASE_CONFIG||{};
  if(!window.supabase) throw new Error("No se cargó Supabase.");
  if(!cfg.url||!cfg.anonKey) throw new Error("config.js no está cargado correctamente.");
  supabaseClient=window.supabase.createClient(cfg.url,cfg.anonKey);
  return supabaseClient;
}

async function iniciar(){
  const {data:{session}}=await client().auth.getSession();
  if(session) await abrirPanel(session.user);
  $("loginForm").addEventListener("submit",login);
  $("logoutBtn").addEventListener("click",logout);
  $("refreshBtn").addEventListener("click",cargarTodo);
  $("refreshHistoryBtn").addEventListener("click",cargarHistorial);
  $("searchInput").addEventListener("input",renderPedidos);
  $("historyOrderFilter").addEventListener("input",renderHistorial);
  $("historyUserFilter").addEventListener("input",renderHistorial);
  $("historyStateFilter").addEventListener("change",renderHistorial);
  $("historyDateFrom").addEventListener("change",renderHistorial);
  $("historyDateTo").addEventListener("change",renderHistorial);
  $("clearHistoryFiltersBtn").addEventListener("click",limpiarFiltrosHistorial);
  $("refreshProductsBtn").addEventListener("click",cargarProductos);
  $("productSearch").addEventListener("input",renderProductos);
  $("saveProductBtn").addEventListener("click",guardarProducto);
  $("cancelProductBtn").addEventListener("click",cancelarEdicionProducto);
  $("refreshDeliveryBtn")?.addEventListener("click",cargarConfiguracionDomicilios);
  $("saveDeliveryBtn")?.addEventListener("click",guardarConfiguracionDomicilio);
  $("clearDeliveryFormBtn")?.addEventListener("click",limpiarFormularioDomicilio);
  $("deliveryBranch")?.addEventListener("change",actualizarCamposPreciosDomicilio);
  $("deleteDeliveryReceiptsBtn")?.addEventListener("click",borrarRecibosDomiciliosTecnico);
  $("deleteAllHistoryBtn")?.addEventListener("click",borrarTodoHistorialTecnico);
  document.querySelectorAll(".category-tab").forEach(btn=>{
    btn.addEventListener("click",()=>{
      categoriaProductoAdmin=btn.dataset.cat||"all";
      document.querySelectorAll(".category-tab").forEach(x=>x.classList.toggle("active",x===btn));
      renderProductos();
    });
  });
}

async function login(e){
  e.preventDefault();
  $("loginError").classList.add("hidden");
  try{
    const {data,error}=await client().auth.signInWithPassword({
      email:$("email").value.trim(),
      password:$("password").value
    });
    if(error) throw error;
    await abrirPanel(data.user);
  }catch(err){
    $("loginError").textContent=err.message||"No fue posible iniciar sesión.";
    $("loginError").classList.remove("hidden");
  }
}

async function abrirPanel(user){
  try{
    const {data,error}=await client().rpc("mi_rol_privado");
    if(error) throw error;
    rolActual=data;
    if(!["administrador","tecnico"].includes(rolActual)){
      await client().auth.signOut();
      throw new Error("Este usuario no tiene un rol privado autorizado.");
    }
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    $("userInfo").textContent=`${user.email} · ${rolActual==="administrador"?"Administrador":"Técnico"}`;
    $("accessMessage").textContent=rolActual==="administrador"
      ?"Puedes revisar todos los pedidos y cambiar su estado."
      :"Modo consulta: solo se muestran domicilios validados y entregados.";
    $("accessMessage").classList.remove("hidden");
    $("technicianTools")?.classList.toggle("hidden",rolActual!=="tecnico");
    await cargarTodo();
    activarRealtimePanel();
  }catch(err){
    $("loginError").textContent=err.message||"No fue posible abrir el panel.";
    $("loginError").classList.remove("hidden");
    $("appView").classList.add("hidden");
    $("loginView").classList.remove("hidden");
  }
}

function programarRefrescoPanel(opciones={}){
  clearTimeout(panelRealtimeTimer);
  panelRealtimeTimer=setTimeout(async()=>{
    try{
      await cargarPedidos();
      if(opciones.historial && rolActual==="administrador") await cargarHistorial();
      if(opciones.productos && rolActual==="administrador") await cargarProductos();
      if(opciones.domicilios && rolActual==="administrador") await cargarConfiguracionDomicilios();
    }catch(e){ console.warn("No se pudo actualizar el panel en tiempo real.",e); }
  },250);
}

function activarRealtimePanel(){
  const c=client();
  if(!panelRealtimeOrdersChannel){
    panelRealtimeOrdersChannel=c.channel("panel-pedidos-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"pedidos"},()=>programarRefrescoPanel({historial:true}))
      .on("postgres_changes",{event:"*",schema:"public",table:"historial_pedidos"},()=>programarRefrescoPanel({historial:true}))
      .subscribe();
  }
  if(rolActual==="administrador" && !panelRealtimeProductsChannel){
    panelRealtimeProductsChannel=c.channel("panel-config-productos-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"productos"},()=>programarRefrescoPanel({productos:true}))
      .on("postgres_changes",{event:"*",schema:"public",table:"configuracion_domicilios"},()=>programarRefrescoPanel({domicilios:true}))
      .on("postgres_changes",{event:"*",schema:"public",table:"configuracion_ciudades_domicilios"},()=>programarRefrescoPanel({domicilios:true}))
      .subscribe();
  }
}

async function logout(){
  await client().auth.signOut();
  location.reload();
}

async function cargarTodo(){
  await cargarPedidos();
  if(rolActual==="administrador"){
    await cargarHistorial();
    $("productsSection").classList.remove("hidden");
    $("deliverySection").classList.remove("hidden");
    await cargarProductos();
    await cargarConfiguracionDomicilios();
  }else{
    $("productsSection").classList.add("hidden");
    $("deliverySection")?.classList.add("hidden");
  }
}

async function cargarHistorial(){
  if(rolActual!=="administrador") return;
  $("historyList").innerHTML='<div class="empty">Cargando historial…</div>';
  try{
    const columnas="pedido_id,numero_pedido,etapa_historial,usuario_id,rol_usuario,accion,estado_anterior,estado_nuevo,detalle,productos_snapshot,registrado_en";
    const pagina=1000;
    let desde=0;
    let todo=[];
    while(true){
      const {data,error}=await client().from("historial_pedidos")
        .select(columnas)
        .order("registrado_en",{ascending:false})
        .range(desde,desde+pagina-1);
      if(error) throw error;
      todo=todo.concat(data||[]);
      if(!data || data.length<pagina) break;
      desde+=pagina;
    }
    historial=todo;
    renderHistorial();
  }catch(err){
    $("historyList").innerHTML=`<div class="error">${escapar(err.message||"No se pudo cargar el historial.")}</div>`;
  }
}

function etiquetaEstado(estado){
  return ESTADOS[estado]?.[1]||estado||"—";
}

function renderHistorial(){
  const pedido=$("historyOrderFilter").value.trim().toLowerCase();
  const usuario=$("historyUserFilter").value.trim().toLowerCase();
  const estado=$("historyStateFilter").value;
  const desde=$("historyDateFrom").value;
  const hasta=$("historyDateTo").value;

  const lista=historial.filter(h=>{
    const numero=String(h.numero_pedido||"").toLowerCase();
    const uid=String(h.usuario_id||"").toLowerCase();
    const rol=String(h.rol_usuario||"").toLowerCase();
    const coincidePedido=!pedido || numero.includes(pedido);
    const coincideUsuario=!usuario || uid.includes(usuario) || rol.includes(usuario);
    const coincideEstado=!estado || h.estado_nuevo===estado || h.estado_anterior===estado || h.etapa_historial===estado;
    const fecha=new Date(h.registrado_en);
    const dia=fecha.toISOString().slice(0,10);
    const coincideDesde=!desde || dia>=desde;
    const coincideHasta=!hasta || dia<=hasta;
    return coincidePedido && coincideUsuario && coincideEstado && coincideDesde && coincideHasta;
  });

  $("historyFilterSummary").textContent=historial.length
    ? `Mostrando ${lista.length} de ${historial.length} movimientos.`
    : "";

  if(!lista.length){
    $("historyList").innerHTML=historial.length
      ? '<div class="empty">No hay movimientos que coincidan con los filtros.</div>'
      : '<div class="empty">Todavía no hay movimientos registrados.</div>';
    return;
  }
  $("historyList").innerHTML=lista.map(h=>{
    const anterior=etiquetaEstado(h.estado_anterior);
    const nuevo=etiquetaEstado(h.estado_nuevo);
    const productos=Array.isArray(h.productos_snapshot)?h.productos_snapshot:[];
    const productosTexto=productos.length
      ? productos.map(i=>`${escapar(i.cantidad||0)} × ${escapar(i.nombre||i.id||"Producto")}`).join(" · ")
      : "No disponible";
    return `<article class="history-card">
      <div class="history-top">
        <div><div class="order-number">Pedido #${escapar(h.numero_pedido||"")}</div><div class="muted">${new Date(h.registrado_en).toLocaleString("es-CO")}</div></div>
        <span class="history-role">${escapar(h.rol_usuario||"Usuario")}</span>
      </div>
      <div class="history-change">
        <span>${escapar(anterior)}</span><strong>→</strong><span>${escapar(nuevo)}</span>
      </div>
      <div class="history-grid">
        <div class="detail"><b>Acción</b>${escapar(h.accion||"—")}</div>
        <div class="detail"><b>Usuario</b>${escapar(h.usuario_id||"—")}</div>
        <div class="detail"><b>Etapa</b>${escapar(etiquetaEstado(h.etapa_historial))}</div>
        <div class="detail"><b>Detalle</b>${escapar(h.detalle||"—")}</div>
      </div>
      <div class="history-products"><b>Productos registrados</b><p>${productosTexto}</p></div>
    </article>`;
  }).join("");
}

function limpiarFiltrosHistorial(){
  $("historyOrderFilter").value="";
  $("historyUserFilter").value="";
  $("historyStateFilter").value="";
  $("historyDateFrom").value="";
  $("historyDateTo").value="";
  renderHistorial();
}

async function cargarPedidos(){
  $("ordersList").innerHTML='<div class="empty">Cargando pedidos…</div>';
  try{
    const {data,error}=await client().from("pedidos")
      .select("id,numero_pedido,tracking_token,estado,motivo_invalido,sucursal,modalidad,metodo_pago,cliente,items,subtotal,empaque,domicilio,total,creado_en,actualizado_en")
      .order("creado_en",{ascending:false});
    if(error) throw error;
    pedidos=data||[];
    renderStats();
    renderDashboardCharts();
    renderPedidos();
  }catch(err){
    $("ordersList").innerHTML=`<div class="error">${escapar(err.message||"No se pudieron cargar los pedidos.")}</div>`;
  }
}

function cliente(p){return p.cliente||{}}
function nombreCliente(p){return cliente(p).nombre||"Sin nombre"}
function telefonoCliente(p){return cliente(p).telefono||""}

function esHoy(fecha){
  if(!fecha) return false;
  const d=new Date(fecha);
  const hoy=new Date();
  return d.getFullYear()===hoy.getFullYear() &&
    d.getMonth()===hoy.getMonth() &&
    d.getDate()===hoy.getDate();
}

function esVentaValida(p){
  return p.estado!=="rechazado";
}

function renderStats(){
  const hoy=pedidos.filter(p=>esHoy(p.creado_en));
  $("statToday").textContent=hoy.length;
  $("statVerification").textContent=pedidos.filter(p=>p.estado==="verificacion").length;
  $("statValidated").textContent=pedidos.filter(p=>p.estado==="validado").length;
  $("statPreparation").textContent=pedidos.filter(p=>p.estado==="preparacion").length;
  $("statDelivery").textContent=pedidos.filter(p=>p.estado==="en_domicilio").length;
  $("statDelivered").textContent=pedidos.filter(p=>p.estado==="entregado").length;
  $("statRejected").textContent=pedidos.filter(p=>p.estado==="rechazado").length;
  const ventas=hoy.filter(esVentaValida).reduce((s,p)=>s+Number(p.total||0),0);
  $("statSales").textContent=dinero(ventas);
  renderBranchSummary(hoy);
}

function renderBranchSummary(hoy){
  const grupos={};
  hoy.forEach(p=>{
    const suc=p.sucursal||"Sin sucursal";
    if(!grupos[suc]) grupos[suc]={pedidos:0,ventas:0,rechazados:0};
    grupos[suc].pedidos++;
    if(esVentaValida(p)) grupos[suc].ventas+=Number(p.total||0);
    if(p.estado==="rechazado") grupos[suc].rechazados++;
  });
  const entradas=Object.entries(grupos).sort((a,b)=>b[1].pedidos-a[1].pedidos);
  if(!entradas.length){
    $("branchSummary").innerHTML='<div class="empty">No hay pedidos de hoy todavía.</div>';
    return;
  }
  $("branchSummary").innerHTML=entradas.map(([s,v])=>`
    <article class="branch-card">
      <div class="branch-name">🏪 ${escapar(nombreSucursal(s))}</div>
      <div class="branch-metrics">
        <div><span>Pedidos</span><strong>${v.pedidos}</strong></div>
        <div><span>Ventas</span><strong>${dinero(v.ventas)}</strong></div>
        <div><span>Rechazados</span><strong>${v.rechazados}</strong></div>
      </div>
    </article>`).join("");
}

function renderPedidos(){
  const q=$("searchInput").value.trim().toLowerCase();
  const lista=pedidos.filter(p=>{
    const texto=[p.numero_pedido,nombreCliente(p),telefonoCliente(p),p.sucursal,p.modalidad,p.estado].join(" ").toLowerCase();
    return texto.includes(q);
  });
  if(!lista.length){
    $("ordersList").innerHTML='<div class="empty">No hay pedidos que mostrar.</div>';
    return;
  }
  $("ordersList").innerHTML=lista.map(renderPedido).join("");
}

function renderPedido(p){
  const e=ESTADOS[p.estado]||ESTADOS.verificacion;
  const c=cliente(p);
  const entrega=p.modalidad==="domicilio"
    ? `${c.ciudad||""} · ${c.zona||""} · ${c.direccion||""}`
    : `Recoger · ${c.sucursal||p.sucursal||""}`;
  const items=Array.isArray(p.items)?p.items:[];
  const acciones=rolActual==="administrador"?`
    <div class="order-actions">
      <select id="estado-${p.id}">
        ${Object.entries(ESTADOS).map(([k,v])=>`<option value="${k}" ${p.estado===k?"selected":""}>${v[1]}</option>`).join("")}
      </select>
      <button class="primary" type="button" onclick="cambiarEstado('${p.id}')">Guardar estado</button>
      <button class="secondary" type="button" onclick="verDetalle('${p.id}')">Ver detalle</button>
    </div>`:
    `<div class="order-actions"><button class="secondary" type="button" onclick="verDetalle('${p.id}')">Ver detalle</button></div>`;
  return `<article class="order-card">
    <div class="order-head">
      <div><div class="order-number">Pedido #${escapar(p.numero_pedido)}</div><div class="muted">${escapar(nombreSucursal(p.sucursal))} · ${escapar(p.modalidad||"")}</div></div>
      <span class="badge ${e[2]}">${e[0]} ${e[1]}</span>
    </div>
    <div class="order-grid">
      <div class="detail"><b>Cliente</b>${escapar(nombreCliente(p))}</div>
      <div class="detail"><b>Teléfono</b>${escapar(telefonoCliente(p))}</div>
      <div class="detail"><b>Entrega</b>${escapar(entrega)}</div>
      <div class="detail"><b>Pago</b>${escapar(p.metodo_pago||"")}</div>
      <div class="detail"><b>Total</b>${dinero(p.total)}</div>
      <div class="detail"><b>Actualizado</b>${new Date(p.actualizado_en).toLocaleString("es-CO")}</div>
    </div>
    <div class="items">${items.map(i=>`<div><span>${escapar(i.cantidad)} × ${escapar(i.nombre||i.id||"Producto")}</span><strong>${dinero((i.precio||0)*(i.cantidad||0))}</strong></div>`).join("")}</div>
    ${p.motivo_invalido?`<div class="notice"><b>Motivo de rechazo:</b> ${escapar(p.motivo_invalido)}</div>`:""}
    ${acciones}
  </article>`;
}

async function cambiarEstado(id){
  const pedido=pedidos.find(p=>p.id===id);
  if(!pedido||rolActual!=="administrador") return;
  const nuevo=$("estado-"+id).value;
  if(nuevo===pedido.estado){return}
  let motivo=pedido.motivo_invalido||null;
  if(nuevo==="rechazado"){
    motivo=prompt("Motivo del rechazo:");
    if(!motivo) return;
  }else{
    motivo=null;
  }
  const {error}=await client().from("pedidos").update({
    estado:nuevo,
    motivo_invalido:motivo
  }).eq("id",id);
  if(error){alert("No se pudo actualizar:\n\n"+error.message);return}
  await cargarPedidos();
}

function verDetalle(id){
  const p=pedidos.find(x=>x.id===id);
  if(!p)return;
  const c=cliente(p);
  const items=Array.isArray(p.items)?p.items:[];
  alert(
`PEDIDO #${p.numero_pedido}

Cliente: ${c.nombre||""}
Teléfono: ${c.telefono||""}
Modalidad: ${p.modalidad||""}
Sucursal: ${nombreSucursal(p.sucursal)}
Dirección: ${c.direccion||"No aplica"}
Zona: ${c.zona||"No aplica"}
Observaciones: ${c.nota||"Ninguna"}

Productos:
${items.map(i=>`${i.cantidad||0} x ${i.nombre||i.id||"Producto"}`).join("\n")}

Total: ${dinero(p.total)}
Estado: ${ESTADOS[p.estado]?.[1]||p.estado}`
  );
}

document.addEventListener("DOMContentLoaded",iniciar);


function renderDashboardCharts(){
  if(rolActual!=='administrador') return;
  renderStateChart();
  renderLast7Chart();
  renderSales7Chart();
  renderProductsChart();
  renderBranchComparison();
  renderProductBranchRanking();
}

function renderStateChart(){
  const cont=$('chartStates'); if(!cont)return;
  const estados=[['verificacion','En verificación'],['validado','Validado'],['preparacion','En preparación'],['en_domicilio','En domicilio'],['entregado','Entregado'],['rechazado','Rechazado']];
  const vals=estados.map(x=>[x[1],pedidos.filter(p=>p.estado===x[0]).length]);
  cont.innerHTML=barChartHTML(vals, 'Pedidos');
}

function renderLast7Chart(){
  const cont=$('chartLast7'); if(!cont)return;
  const now=new Date(); const vals=[];
  for(let i=6;i>=0;i--){
    const d=new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    const next=new Date(d); next.setDate(next.getDate()+1);
    const count=pedidos.filter(p=>{const x=new Date(p.creado_en); return x>=d&&x<next}).length;
    vals.push([d.toLocaleDateString('es-CO',{weekday:'short',day:'numeric'}),count]);
  }
  cont.innerHTML=barChartHTML(vals, 'Pedidos');
}

function barChartHTML(vals,label,dineroFormato=false){
  const max=Math.max(1,...vals.map(v=>v[1]));
  const formato=v=>dineroFormato?dinero(v):v.toLocaleString('es-CO');
  return `<div class="simple-chart"><div class="chart-y"><span>${formato(max)}</span><span>${formato(Math.ceil(max/2))}</span><span>${formato(0)}</span></div><div class="chart-bars">${vals.map(v=>{const h=Math.max(4,Math.round(v[1]/max*100));return `<div class="chart-col"><div class="chart-value">${formato(v[1])}</div><div class="chart-bar" style="height:${h}%" title="${escapar(v[0])}: ${formato(v[1])} ${label.toLowerCase()}"></div><div class="chart-label">${escapar(v[0])}</div></div>`}).join('')}</div></div>`;
}


function renderSales7Chart(){
  const cont=$('chartSales7'); if(!cont)return;
  const now=new Date(); const vals=[];
  for(let i=6;i>=0;i--){
    const d=new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
    const next=new Date(d); next.setDate(next.getDate()+1);
    const sales=pedidos.filter(p=>{
      const x=new Date(p.creado_en);
      return x>=d&&x<next&&esVentaValida(p);
    }).reduce((sum,p)=>sum+Number(p.total||0),0);
    vals.push([d.toLocaleDateString('es-CO',{weekday:'short',day:'numeric'}),sales]);
  }
  cont.innerHTML=barChartHTML(vals, 'pesos', true);
}


function renderBranchComparison(){
  const salesCont=$('chartBranchSales');
  const ordersCont=$('chartBranchOrders');
  if(!salesCont||!ordersCont) return;
  const grupos={};
  pedidos.forEach(p=>{
    const suc=p.sucursal||'Sin sucursal';
    if(!grupos[suc]) grupos[suc]={pedidos:0,ventas:0};
    grupos[suc].pedidos++;
    if(esVentaValida(p)) grupos[suc].ventas+=Number(p.total||0);
  });
  const orden=['Centro','Cuba','Circunvalar'];
  const extras=Object.keys(grupos).filter(s=>!orden.includes(s));
  const sucursales=[...orden.filter(s=>grupos[s]),...extras];
  if(!sucursales.length){
    salesCont.innerHTML='<div class="empty">No hay datos de sucursales todavía.</div>';
    ordersCont.innerHTML='<div class="empty">No hay datos de sucursales todavía.</div>';
    if($('topBranchHighlight')) $('topBranchHighlight').innerHTML='';
    return;
  }
  const ventas=sucursales.map(s=>[nombreSucursal(s),grupos[s].ventas]);
  const pedidosSuc=sucursales.map(s=>[nombreSucursal(s),grupos[s].pedidos]);
  salesCont.innerHTML=barChartHTML(ventas,'pesos',true);
  ordersCont.innerHTML=barChartHTML(pedidosSuc,'pedidos');
  const top=sucursales.slice().sort((a,b)=>grupos[b].ventas-grupos[a].ventas)[0];
  if($('topBranchHighlight')){
    $('topBranchHighlight').innerHTML=`<div class="top-product"><span>🏆 Mayor venta</span><strong>${escapar(nombreSucursal(top))}</strong><small>${dinero(grupos[top].ventas)} · ${grupos[top].pedidos.toLocaleString('es-CO')} pedidos</small></div>`;
  }
}

function renderProductsChart(){
  const cont=$('chartProducts'); if(!cont)return;
  const resumen={};
  pedidos.forEach(p=>{
    if(!esVentaValida(p)) return;
    const items=Array.isArray(p.items)?p.items:[];
    items.forEach(i=>{
      const nombre=String(i.nombre||i.id||'Producto').trim()||'Producto';
      const cantidad=Number(i.cantidad||0);
      const importe=Number(i.precio||0)*cantidad;
      if(!resumen[nombre]) resumen[nombre]={cantidad:0,ventas:0};
      resumen[nombre].cantidad+=cantidad;
      resumen[nombre].ventas+=importe;
    });
  });
  const ranking=Object.entries(resumen).sort((a,b)=>b[1].cantidad-a[1].cantidad || b[1].ventas-a[1].ventas);
  if(!ranking.length){
    cont.innerHTML='<div class="empty">No hay productos vendidos todavía.</div>';
    $('topProductHighlight').innerHTML='';
    return;
  }
  const top=ranking[0];
  $('topProductHighlight').innerHTML=`<div class="top-product"><span>🥇 Más vendido</span><strong>${escapar(top[0])}</strong><small>${top[1].cantidad.toLocaleString('es-CO')} unidades · ${dinero(top[1].ventas)}</small></div>`;
  const topN=ranking.slice(0,8).map(([nombre,v])=>[nombre,v.cantidad]);
  cont.innerHTML=barChartHTML(topN,'unidades');
}


function renderProductBranchRanking(){
  const cont=$("productBranchRanking");
  if(!cont) return;
  const sucursales=["Centro","Cuba","Circunvalar"];
  const porSucursal={};
  sucursales.forEach(s=>porSucursal[s]={});

  pedidos.forEach(p=>{
    if(!esVentaValida(p)) return;
    const suc=p.sucursal||"Sin sucursal";
    if(!porSucursal[suc]) porSucursal[suc]={};
    const items=Array.isArray(p.items)?p.items:[];
    items.forEach(i=>{
      const nombre=String(i.nombre||i.id||"Producto").trim()||"Producto";
      const cantidad=Number(i.cantidad||0);
      const ventas=Number(i.precio||0)*cantidad;
      if(!porSucursal[suc][nombre]) porSucursal[suc][nombre]={cantidad:0,ventas:0};
      porSucursal[suc][nombre].cantidad+=cantidad;
      porSucursal[suc][nombre].ventas+=ventas;
    });
  });

  const extras=Object.keys(porSucursal).filter(s=>!sucursales.includes(s));
  const listaSucursales=[...sucursales,...extras];
  const cards=listaSucursales.map(s=>{
    const ranking=Object.entries(porSucursal[s]||{})
      .sort((a,b)=>b[1].cantidad-a[1].cantidad||b[1].ventas-a[1].ventas)
      .slice(0,5);
    if(!ranking.length){
      return `<article class="product-branch-card"><div class="product-branch-name">🏪 ${escapar(nombreSucursal(s))}</div><div class="empty-mini">Sin ventas de productos todavía.</div></article>`;
    }
    return `<article class="product-branch-card">
      <div class="product-branch-name">🏪 ${escapar(nombreSucursal(s))}</div>
      <div class="product-ranking-list">
        ${ranking.map(([nombre,v],idx)=>`<div class="product-ranking-row">
          <div class="product-rank">${idx+1}</div>
          <div class="product-rank-info"><strong>${escapar(nombre)}</strong><span>${v.cantidad.toLocaleString('es-CO')} unidades · ${dinero(v.ventas)}</span></div>
        </div>`).join('')}
      </div>
    </article>`;
  }).join('');

  cont.innerHTML=cards||'<div class="empty">No hay datos de productos todavía.</div>';
}


let productosAdmin=[];
let productoEditandoId=null;
let imagenProductoActual="";
let categoriaProductoAdmin="all";

let domicilioEditandoId=null;
let configuracionDomicilios=[];
let configuracionCiudades=[];

function limpiarFormularioDomicilio(){
  domicilioEditandoId=null;
  $("deliveryFormTitle") && ($("deliveryFormTitle").textContent="Nueva zona de domicilio");
  $("deliveryCity").value="";
  $("deliveryZone").value="";
  $("deliveryPrice").value="";
  $("deliveryModelPrice").value="";
  $("deliveryProvidenciaPrice").value="";
  $("deliveryBranch").value="";
  actualizarCamposPreciosDomicilio();
  $("deliveryActive").checked=true;
  $("cancelDeliveryEditBtn")?.classList.add("hidden");
  mostrarMensajeDomicilio("");
}

function mostrarMensajeDomicilio(msg,error=false){
  const el=$("deliveryMessage");
  if(!el)return;
  if(!msg){el.classList.add("hidden");el.textContent="";return;}
  el.textContent=msg;
  el.classList.remove("hidden");
  el.style.background=error?"#ffe8e5":"#e4f5e9";
  el.style.color=error?"#a32920":"#16733e";
}

function actualizarCamposPreciosDomicilio(){
  const branch=$("deliveryBranch")?.value||"";
  const ambos=branch==="Ambos";
  $("deliverySinglePriceWrap")?.classList.toggle("hidden",ambos);
  $("deliveryModelPriceWrap")?.classList.toggle("hidden",!ambos);
  $("deliveryProvidenciaPriceWrap")?.classList.toggle("hidden",!ambos);
}

function editarConfiguracionDomicilio(id){
  if(rolActual!=="administrador")return;
  const item=configuracionDomicilios.find(x=>String(x.id)===String(id));
  if(!item)return;
  domicilioEditandoId=item.id;
  $("deliveryFormTitle").textContent="Editar zona de domicilio";
  $("deliveryCity").value=item.ciudad||"";
  $("deliveryZone").value=item.zona||"";
  $("deliveryPrice").value=Number(item.precio||0);
  $("deliveryModelPrice").value=item.sucursal==="Cuba"?Number(item.precio||0):"";
  $("deliveryProvidenciaPrice").value=item.sucursal==="Circunvalar"?Number(item.precio||0):"";
  $("deliveryBranch").value=item.sucursal||"";
  $("deliveryActive").checked=item.activo!==false;
  $("cancelDeliveryEditBtn").classList.remove("hidden");
  actualizarCamposPreciosDomicilio();
  $("deliverySection").scrollIntoView({behavior:"smooth",block:"start"});
}

async function cargarConfiguracionDomicilios(){
  if(rolActual!=="administrador" || !$("deliveryList"))return;
  $("deliveryList").innerHTML='<div class="empty">Cargando zonas de domicilio…</div>';
  try{
    const ciudadesRes=await client().from("configuracion_ciudades_domicilios").select("id,ciudad,activo").eq("activo",true).order("ciudad");
    if(!ciudadesRes.error){
      configuracionCiudades=ciudadesRes.data||[];
      const lista=$("deliveryCitiesList");
      if(lista) lista.innerHTML=configuracionCiudades.map(c=>`<option value="${escapar(c.ciudad)}"></option>`).join("");
    }
    const {data,error}=await client().from("configuracion_domicilios")
      .select("id,ciudad,zona,precio,sucursal,activo,actualizado_en")
      .order("ciudad",{ascending:true}).order("zona",{ascending:true});
    if(error)throw error;
    configuracionDomicilios=data||[];
    renderConfiguracionDomicilios();
  }catch(err){
    $("deliveryList").innerHTML=`<div class="error">${escapar(err.message||"No se pudo cargar la configuración de domicilios.")}</div>`;
  }
}

function renderConfiguracionDomicilios(){
  const cont=$("deliveryList");
  if(!cont)return;
  const grupos=[
    ["Cuba","🛵 Domicilios El Modelo","Tarifas y zonas atendidas por el punto Barrio El Modelo"],
    ["Circunvalar","🛵 Domicilios Providencia","Tarifas y zonas atendidas por el punto Barrio Providencia"]
  ];
  cont.innerHTML=grupos.map(([sucursal,titulo,desc])=>{
    const items=configuracionDomicilios.filter(d=>d.sucursal===sucursal);
    return `<section class="delivery-window"><div class="delivery-window-head"><div><span class="eyebrow">CONFIGURACIÓN</span><h3>${titulo}</h3><p class="muted">${desc}</p></div><strong>${items.length} zonas</strong></div><div class="delivery-window-list">${items.length?items.map(d=>`
      <article class="delivery-card">
        <div class="delivery-card-main">
          <div><h3>📍 ${escapar(d.zona)}</h3><p class="muted">${escapar(d.ciudad)} · ${escapar(nombreSucursal(d.sucursal))}</p></div>
          <div class="delivery-price-admin">${dinero(d.precio)}<span class="delivery-status ${d.activo===false?"inactive":"active"}">${d.activo===false?"Inactiva":"Activa"}</span></div>
        </div>
        <div class="delivery-actions">
          <button class="secondary" type="button" onclick="editarConfiguracionDomicilio('${escapar(d.id)}')">✏️ Editar</button>
          <button class="danger" type="button" onclick="borrarConfiguracionDomicilio('${escapar(d.id)}')">🗑️ Borrar</button>
        </div>
      </article>`).join(""):'<div class="empty">No hay zonas configuradas para este punto.</div>'}</div></section>`;
  }).join("");
}

async function borrarConfiguracionDomicilio(id){
  if(rolActual!=="administrador")return;
  const item=configuracionDomicilios.find(x=>String(x.id)===String(id));
  if(!item)return;
  const nombre=`${item.zona} (${item.ciudad})`;
  if(!confirm(`¿Seguro que quieres borrar el domicilio "${nombre}"?\n\nSe eliminará esta zona de la configuración de domicilios. Esta acción no borra pedidos anteriores.`))return;
  try{
    const {error}=await client().from("configuracion_domicilios").delete().eq("id",item.id);
    if(error)throw error;
    if(String(domicilioEditandoId)===String(item.id)) limpiarFormularioDomicilio();
    await cargarConfiguracionDomicilios();
    alert(`Domicilio "${nombre}" borrado correctamente.`);
  }catch(err){
    alert("No se pudo borrar el domicilio:\n\n"+(err.message||err));
  }
}

async function guardarConfiguracionDomicilio(){
  if(rolActual!=="administrador")return;
  const ciudad=$("deliveryCity").value.trim();
  const zona=$("deliveryZone").value.trim();
  const sucursal=$("deliveryBranch").value;
  const activo=$("deliveryActive").checked;
  if(!ciudad||!zona){mostrarMensajeDomicilio("Completa ciudad y zona.",true);return;}
  if(!sucursal){mostrarMensajeDomicilio("Selecciona El Modelo, Providencia o Ambos puntos.",true);return;}

  const precios=sucursal==="Ambos"
    ? {Cuba:Number($("deliveryModelPrice").value),Circunvalar:Number($("deliveryProvidenciaPrice").value)}
    : {[sucursal]:Number($("deliveryPrice").value)};
  for(const [punto,precio] of Object.entries(precios)){
    if(!Number.isFinite(precio)||precio<0){mostrarMensajeDomicilio(`Ingresa un precio válido para ${nombreSucursal(punto)}.`,true);return;}
  }

  const boton=$("saveDeliveryBtn"); boton.disabled=true;
  try{
    if(domicilioEditandoId && sucursal!=="Ambos"){
      const precio=precios[sucursal];
      const {error}=await client().from("configuracion_domicilios").update({ciudad,zona,precio,sucursal,activo}).eq("id",domicilioEditandoId);
      if(error)throw error;
    }else if(domicilioEditandoId && sucursal==="Ambos"){
      const actual=configuracionDomicilios.find(x=>String(x.id)===String(domicilioEditandoId));
      if(!actual)throw new Error("No se encontró la zona que estás editando.");
      const otro=configuracionDomicilios.find(x=>x.ciudad.toLowerCase()===ciudad.toLowerCase() && x.zona.toLowerCase()===zona.toLowerCase() && x.sucursal!==actual.sucursal);
      const primero={ciudad,zona,precio:precios[actual.sucursal]??precios.Cuba,sucursal:actual.sucursal,activo};
      let r=await client().from("configuracion_domicilios").update(primero).eq("id",actual.id);
      if(r.error)throw r.error;
      const otroPunto=actual.sucursal==="Cuba"?"Circunvalar":"Cuba";
      const otroPrecio=precios[otroPunto];
      if(otro){r=await client().from("configuracion_domicilios").update({ciudad,zona,precio:otroPrecio,sucursal:otroPunto,activo}).eq("id",otro.id);}
      else{r=await client().from("configuracion_domicilios").insert({ciudad,zona,precio:otroPrecio,sucursal:otroPunto,activo});}
      if(r.error)throw r.error;
    }else{
      for(const [punto,precio] of Object.entries(precios)){
        const {error}=await client().from("configuracion_domicilios").upsert({ciudad,zona,precio,sucursal:punto,activo},{onConflict:"ciudad,zona,sucursal"});
        if(error)throw error;
      }
    }
    mostrarMensajeDomicilio("Configuración de domicilio guardada correctamente.");
    limpiarFormularioDomicilio();
    await cargarConfiguracionDomicilios();
  }catch(err){
    mostrarMensajeDomicilio(err.message||"No se pudo guardar la configuración de domicilios.",true);
  }finally{boton.disabled=false;}
}

async function borrarRecibosDomiciliosTecnico(){
  if(rolActual!=="tecnico")return;
  if(!confirm("¿Seguro que quieres borrar TODOS los recibos/pedidos de domicilio?\n\nEsta acción eliminará los pedidos cuya modalidad sea domicilio y sus registros de historial relacionados. No afectará los productos ni la configuración de domicilios."))return;
  const btn=$("deleteDeliveryReceiptsBtn"); btn.disabled=true;
  try{
    const {data,error}=await client().rpc("borrar_recibos_domicilios_tecnico");
    if(error)throw error;
    alert(`Recibos de domicilios borrados correctamente: ${Number(data)||0}.`);
    await cargarTodo();
  }catch(err){
    alert("No se pudieron borrar los recibos de domicilios:\n\n"+(err.message||err));
  }finally{btn.disabled=false;}
}

async function borrarTodoHistorialTecnico(){
  if(rolActual!=="tecnico")return;
  if(!confirm("¿Seguro que quieres borrar TODO el historial de pedidos?\n\nEsta acción no se puede deshacer."))return;
  const btn=$("deleteAllHistoryBtn"); btn.disabled=true;
  try{
    const {data,error}=await client().rpc("borrar_historial_pedidos_tecnico");
    if(error)throw error;
    historial=[];
    renderHistorial();
    alert(`Historial eliminado correctamente: ${Number(data)||0} registros.`);
  }catch(err){
    alert("No se pudo borrar el historial:\n\n"+(err.message||err));
  }finally{btn.disabled=false;}
}

async function cargarProductos(){
  if(rolActual!=="administrador") return;
  $("productsList").innerHTML='<div class="empty">Cargando productos…</div>';
  try{
    const {data,error}=await client().from("productos")
      .select("id,categoria,icono,nombre,descripcion,precio,sucursales,activo,imagen_url,creado_en,actualizado_en")
      .order("categoria",{ascending:true})
      .order("nombre",{ascending:true});
    if(error) throw error;
    productosAdmin=data||[];
    renderProductos();
  }catch(err){
    $("productsList").innerHTML=`<div class="error">${escapar(err.message||"No se pudieron cargar los productos.")}</div>`;
  }
}

function renderProductos(){
  const q=($("productSearch")?.value||"").trim().toLowerCase();
  const lista=productosAdmin.filter(p=>{
    const texto=[p.id,p.categoria,p.nombre,p.descripcion].join(" ").toLowerCase();
    const cat=String(p.categoria||"");
    const coincideBusqueda=texto.includes(q);
    let coincideCategoria=true;
    if(categoriaProductoAdmin!=="all"){
      coincideCategoria=cat===categoriaProductoAdmin;
    }
    return coincideBusqueda && coincideCategoria;
  });
  if(!lista.length){
    $("productsList").innerHTML='<div class="empty">No hay productos que coincidan.</div>';
    return;
  }
  $("productsList").innerHTML=lista.map(p=>{
    const suc=Array.isArray(p.sucursales)?p.sucursales:[];
    const ramas=[
      ["Centro","Bombay"],
      ["Cuba","Barrio El Modelo"],
      ["Circunvalar","Barrio Providencia"]
    ];
    const permitidas={
      "Gaseosas Coca-Cola":["Cuba","Circunvalar"],
      "Postobón":["Cuba"],
      "Congeladas":["Cuba","Circunvalar"],
    "Extras":["Centro","Cuba","Circunvalar"]
    };
    const permitidasCategoria=permitidas[p.categoria]||["Centro","Cuba","Circunvalar"];
    const disponibilidad=ramas.map(([codigo,nombre])=>{
      const disponible=suc.includes(codigo);
      const permitido=permitidasCategoria.includes(codigo);
      if(!permitido){
        return `<div class="product-branch-control">
          <span>🏪 ${escapar(nombre)}</span>
          <span class="product-branch-disabled">No disponible para esta categoría</span>
        </div>`;
      }
      return `<div class="product-branch-control">
        <span>🏪 ${escapar(nombre)}</span>
        <button class="${disponible?"secondary":"primary"}" type="button" onclick="cambiarSucursalProducto('${escapar(p.id)}','${codigo}',${!disponible})">${disponible?"Desactivar aquí":"Agregar aquí"}</button>
      </div>`;
    }).join("");
  return `<article class="product-card">
      <div class="product-card-top">
        <div class="product-title">
          <span class="product-icon">${p.imagen_url?`<img class="product-image-preview" src="${escapar(p.imagen_url)}" alt="">`:escapar(p.icono||"🍽️")}</span>
          <div><h3>${escapar(p.nombre)}</h3><div class="product-id">${escapar(p.id)} · ${escapar(p.categoria)}</div></div>
        </div>
        <div>
          <div class="product-price">${dinero(p.precio)}</div>
          <span class="product-status ${p.activo?"active":"inactive"}">${p.activo?"Disponible":"Sin sucursales"}</span>
        </div>
      </div>
      <p class="muted">${escapar(p.descripcion||"Sin descripción.")}</p>
      <div class="product-branch-controls">${disponibilidad}</div>
      <div class="product-actions">
        <button class="secondary" type="button" onclick="editarProducto('${escapar(p.id)}')">Editar datos</button>
      </div>
    </article>`;
  }).join("");
}

function limpiarFormularioProducto(){
  productoEditandoId=null;
  imagenProductoActual="";
  $("productFormTitle").textContent="Nuevo producto";
  $("productId").value="";
  $("productId").disabled=false;
  $("productCategory").value="";
  $("productIcon").value="🥟";
  $("productName").value="";
  $("productDescription").value="";
  $("productPrice").value="";
  if($("productImage")) $("productImage").value="";
  $("branchCentro").checked=false;
  $("branchCuba").checked=false;
  $("branchCircunvalar").checked=false;
  $("cancelProductBtn").classList.add("hidden");
}

function editarProducto(id){
  const p=productosAdmin.find(x=>x.id===id);
  if(!p) return;
  productoEditandoId=p.id;
  $("productFormTitle").textContent="Editar producto";
  $("productId").value=p.id;
  $("productId").disabled=true;
  $("productCategory").value=p.categoria||"";
  $("productIcon").value=p.icono||"🥟";
  $("productName").value=p.nombre||"";
  $("productDescription").value=p.descripcion||"";
  $("productPrice").value=Number(p.precio||0);
  imagenProductoActual=p.imagen_url||"";
  if($("productImage")) $("productImage").value="";
  const suc=Array.isArray(p.sucursales)?p.sucursales:[];
  $("branchCentro").checked=suc.includes("Centro");
  $("branchCuba").checked=suc.includes("Cuba");
  $("branchCircunvalar").checked=suc.includes("Circunvalar");
  $("cancelProductBtn").classList.remove("hidden");
  $("productsSection").scrollIntoView({behavior:"smooth",block:"start"});
}

function cancelarEdicionProducto(){
  limpiarFormularioProducto();
  mostrarMensajeProducto("");
}

function mostrarMensajeProducto(msg, error=false){
  const el=$("productMessage");
  if(!msg){el.classList.add("hidden");el.textContent="";return}
  el.textContent=msg;
  el.classList.remove("hidden");
  el.style.background=error?"#ffe8e5":"#e4f5e9";
  el.style.color=error?"#a32920":"#16733e";
}

function sucursalesFormulario(){
  const arr=[];
  if($("branchCentro").checked) arr.push("Centro");
  if($("branchCuba").checked) arr.push("Cuba");
  if($("branchCircunvalar").checked) arr.push("Circunvalar");
  return arr;
}

async function subirImagenProducto(file, id){
  if(!file) return imagenProductoActual||"";
  if(!file.type.startsWith("image/")) throw new Error("Selecciona una imagen válida.");
  if(file.size>3*1024*1024) throw new Error("La imagen debe pesar máximo 3 MB.");
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
  const path=`${id}/${Date.now()}.${ext}`;
  const {error}=await client().storage.from("productos").upload(path,file,{upsert:false,contentType:file.type||undefined});
  if(error) throw error;
  const {data}=client().storage.from("productos").getPublicUrl(path);
  return data.publicUrl;
}

async function guardarProducto(){
  if(rolActual!=="administrador") return;
  mostrarMensajeProducto("");
  const id=$("productId").value.trim();
  const categoria=$("productCategory").value.trim();
  const icono=$("productIcon").value.trim()||"🍽️";
  const nombre=$("productName").value.trim();
  const descripcion=$("productDescription").value.trim();
  const precio=Number($("productPrice").value);
  const archivo=$("productImage")?.files?.[0]||null;
  let sucursales=sucursalesFormulario();
  const activo=sucursales.length>0;
  if(!id||!categoria||!nombre||!Number.isFinite(precio)||precio<0){
    mostrarMensajeProducto("Completa ID, categoría, nombre y un precio válido.",true); return;
  }
  const reglasSucursal={"Gaseosas Coca-Cola":["Cuba","Circunvalar"],"Postobón":["Cuba"],"Congeladas":["Cuba","Circunvalar"],"Extras":["Centro","Cuba","Circunvalar"]};
  const permitidas=reglasSucursal[categoria]||["Centro","Cuba","Circunvalar"];
  const noPermitidas=sucursales.filter(s=>!permitidas.includes(s));
  if(noPermitidas.length){mostrarMensajeProducto(`La categoría "${categoria}" no está disponible en: ${noPermitidas.join(", ")}.`,true);return;}
  if(!sucursales.length){mostrarMensajeProducto("Selecciona al menos una sucursal.",true);return;}
  const boton=$("saveProductBtn"); boton.disabled=true;
  try{
    let imagen_url=imagenProductoActual||null;
    if(archivo){
      mostrarMensajeProducto("Subiendo imagen…");
      imagen_url=await subirImagenProducto(archivo,id);
    }
    let error;
    if(productoEditandoId){
      ({error}=await client().from("productos").update({categoria,icono,nombre,descripcion,precio,sucursales,activo,imagen_url}).eq("id",productoEditandoId));
    }else{
      ({error}=await client().from("productos").insert({id,categoria,icono,nombre,descripcion,precio,sucursales,activo,imagen_url}));
    }
    if(error) throw error;
    mostrarMensajeProducto(productoEditandoId?"Producto actualizado correctamente.":"Producto creado correctamente.");
    limpiarFormularioProducto(); await cargarProductos();
  }catch(err){mostrarMensajeProducto(err.message||"No se pudo guardar el producto. Si es la primera vez que usas imágenes, ejecuta productos_imagenes.sql en Supabase.",true);
  }finally{boton.disabled=false;}
}

async function cambiarSucursalProducto(id,sucursal,agregar){
  if(rolActual!=="administrador") return;
  const p=productosAdmin.find(x=>x.id===id);
  if(!p) return;
  const actual=Array.isArray(p.sucursales)?p.sucursales:[];
  const nuevas=[...actual];
  if(agregar){
    if(!nuevas.includes(sucursal)) nuevas.push(sucursal);
  }else{
    const filtradas=nuevas.filter(x=>x!==sucursal);
    if(filtradas.length===0){
      if(!confirm(`¿Desactivar "${p.nombre}" en todas las sucursales?\n\nEl producto quedará sin disponibilidad.`)) return;
    }
    nuevas.splice(0,nuevas.length,...filtradas);
  }
  const activo=nuevas.length>0;
  const {error}=await client().from("productos").update({sucursales:nuevas,activo}).eq("id",id);
  if(error){alert("No se pudo cambiar la disponibilidad de la sucursal:\n\n"+error.message);return}
  await cargarProductos();
}
