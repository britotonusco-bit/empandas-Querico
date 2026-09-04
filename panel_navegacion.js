(function(){
  function iniciarNavegacion(){
    const app=document.getElementById('appView');
    const access=document.getElementById('accessMessage');
    const productsSection=document.getElementById('productsSection');
    const historySection=document.querySelector('.history-section');
    const deliverySection=document.getElementById('deliverySection');
    const technicianTools=document.getElementById('technicianTools');
    if(!app || !access || document.getElementById('panelNavigation')) return;

    const nav=document.createElement('nav');
    nav.id='panelNavigation';
    nav.className='panel-navigation';
    nav.setAttribute('aria-label','Secciones del panel');
    access.insertAdjacentElement('afterend',nav);

    const ordersList=document.getElementById('ordersList');
    const orderToolbar=document.getElementById('searchInput')?.closest('.toolbar');
    const orderTitle=ordersList?.previousElementSibling;

    const groups={
      dashboard:[
        document.querySelector('.dashboard-title'),
        document.querySelector('.dashboard-stats'),
        document.querySelector('.dashboard-charts'),
        document.querySelector('.product-branch-ranking'),
        document.querySelector('.dashboard-branches')
      ].filter(Boolean),
      orders:[orderToolbar,orderTitle,ordersList].filter(Boolean),
      products:[document.getElementById('productCategoryNav'),productsSection].filter(Boolean),
      history:[historySection].filter(Boolean),
      delivery:[deliverySection].filter(Boolean),
      technician:[technicianTools].filter(Boolean)
    };

    const tabs=[
      ['dashboard','📊 Resumen'],
      ['orders','📦 Pedidos'],
      ['products','🍽️ Productos y configuración'],
      ['history','📋 Historial'],
      ['delivery','🛵 Domicilios'],
      ['technician','🧹 Técnico']
    ];

    function esAdministrador(){
      // panel.js mantiene el rol en una variable let que no es window.rolActual.
      // productsSection sí refleja el rol: solo el administrador puede verla.
      return !!productsSection && !productsSection.classList.contains('hidden');
    }

    function visibleGroup(key){
      if((key==='products'||key==='history'||key==='delivery') && !esAdministrador()) key='dashboard';
      if(key==='technician' && !esTecnico()) key='dashboard';
      Object.keys(groups).forEach(name=>{
        groups[name].forEach(el=>el.classList.toggle('panel-view-hidden',name!==key));
      });
      nav.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===key));
      try{sessionStorage.setItem('eqr_panel_view',key)}catch(e){}
    }

    tabs.forEach(([key,label])=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='panel-nav-tab';
      btn.dataset.view=key;
      btn.textContent=label;
      btn.addEventListener('click',()=>visibleGroup(key));
      nav.appendChild(btn);
    });

    function esTecnico(){
      return !!technicianTools && !technicianTools.classList.contains('hidden');
    }

    function actualizarPermisos(){
      const admin=esAdministrador();
      const tecnico=esTecnico();
      const productTab=nav.querySelector('[data-view="products"]');
      const historyTab=nav.querySelector('[data-view="history"]');
      const deliveryTab=nav.querySelector('[data-view="delivery"]');
      const technicianTab=nav.querySelector('[data-view="technician"]');
      if(productTab) productTab.style.display=admin?'inline-flex':'none';
      if(historyTab) historyTab.style.display=admin?'inline-flex':'none';
      if(deliveryTab) deliveryTab.style.display=admin?'inline-flex':'none';
      if(technicianTab) technicianTab.style.display=tecnico?'inline-flex':'none';

      const active=nav.querySelector('.panel-nav-tab.active')?.dataset.view;
      if(!admin && (active==='products'||active==='history'||active==='delivery')) visibleGroup('dashboard');
      if(!tecnico && active==='technician') visibleGroup('dashboard');
    }

    function restaurarVista(){
      let guardada='dashboard';
      try{guardada=sessionStorage.getItem('eqr_panel_view')||'dashboard'}catch(e){}
      if((guardada==='products'||guardada==='history'||guardada==='delivery') && !esAdministrador()) guardada='dashboard';
      if(guardada==='technician' && !esTecnico()) guardada='dashboard';
      visibleGroup(guardada);
    }

    // El rol se aplica en panel.js quitando/agregando .hidden a productsSection.
    // Observamos ese cambio para que las pestañas aparezcan correctamente al iniciar sesión.
    if(productsSection){
      new MutationObserver(()=>{
        actualizarPermisos();
        if(!app.classList.contains('hidden')) restaurarVista();
      }).observe(productsSection,{attributes:true,attributeFilter:['class']});
    }

    // También observamos la entrada/salida del panel.
    new MutationObserver(()=>{
      actualizarPermisos();
      if(!app.classList.contains('hidden')) restaurarVista();
    }).observe(app,{attributes:true,attributeFilter:['class']});

    actualizarPermisos();
    visibleGroup('dashboard');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciarNavegacion);
  else iniciarNavegacion();
})();
