(function(){
  async function obtenerRol(){
    try{
      const {data,error}=await client().rpc('mi_rol_privado');
      if(error) throw error;
      return data;
    }catch(e){
      console.error('No se pudo obtener el rol:',e);
      return '';
    }
  }

  async function actualizarBoton(){
    const btn=document.getElementById('closeWeekBtn');
    if(!btn) return;
    const app=document.getElementById('appView');
    if(!app || app.classList.contains('hidden')){
      btn.style.display='none';
      return;
    }
    const rol=await obtenerRol();
    btn.style.display=rol==='tecnico'?'inline-flex':'none';
  }

  async function cerrarSemana(){
    const btn=document.getElementById('closeWeekBtn');
    if(!btn) return;
    const rol=await obtenerRol();
    if(rol!=='tecnico'){
      alert('Solo un técnico puede cerrar la semana.');
      btn.style.display='none';
      return;
    }

    const confirmar=confirm('¿Seguro que quieres cerrar la semana?\n\nSe eliminarán todos los pedidos de la semana actual, sin importar su estado.\n\nLos productos, precios y el historial NO se eliminarán.');
    if(!confirmar) return;

    btn.disabled=true;
    try{
      const {data,error}=await client().rpc('cerrar_semana_tecnico');
      if(error) throw error;
      alert(`Semana cerrada correctamente. Pedidos eliminados: ${Number(data)||0}.`);
      if(typeof cargarTodo==='function') await cargarTodo();
    }catch(e){
      console.error(e);
      alert('No se pudo cerrar la semana: '+(e.message||e));
    }finally{
      btn.disabled=false;
      await actualizarBoton();
    }
  }

  function iniciar(){
    const btn=document.getElementById('closeWeekBtn');
    if(!btn) return;
    btn.addEventListener('click',cerrarSemana);
    const app=document.getElementById('appView');
    if(app){
      new MutationObserver(actualizarBoton).observe(app,{attributes:true,attributeFilter:['class']});
    }
    actualizarBoton();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar);
  else iniciar();
})();
