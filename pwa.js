(()=>{
 const installBtn=document.getElementById('installApp');
 const offlineBanner=document.getElementById('offlineBanner');
 const connectionState=document.getElementById('connectionState');
 let deferredPrompt=null;
 function updateNetwork(){const online=navigator.onLine;offlineBanner.hidden=online;connectionState.classList.toggle('is-offline',!online);connectionState.querySelector('span').textContent=online?'Conectado':'Offline'}
 updateNetwork();window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;installBtn.hidden=false});
 window.addEventListener('appinstalled',()=>{deferredPrompt=null;installBtn.hidden=true; if(typeof toast==='function')toast('Aplicativo instalado com sucesso.')});
 installBtn?.addEventListener('click',async()=>{if(!deferredPrompt){if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&typeof toast==='function')toast('No Safari: toque em Compartilhar e depois “Adicionar à Tela de Início”.');return}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.hidden=true});
 if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
  window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller&&typeof toast==='function')toast('Nova versão disponível. Recarregue o aplicativo.')})})}catch(err){console.warn('PWA: não foi possível registrar o service worker.',err)}})
 }
})();