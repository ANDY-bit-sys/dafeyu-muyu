(() => {
  'use strict';
  let petWindow, controls, options, restoreTimer;
  const supported = () => typeof window.documentPictureInPicture?.requestWindow === 'function';
  const isOpen = () => Boolean(petWindow && !petWindow.closed);
  function render() {
    if (!isOpen() || !controls) return;
    const state = options.getState();
    petWindow.document.body.classList.toggle('dark', state.dark);
    controls.count.textContent = '功德 ' + state.count.toLocaleString('zh-CN');
    controls.mute.textContent = state.muted ? '开启声音' : '静音';
    controls.theme.textContent = state.dark ? '日间模式' : '夜间模式';
  }
  function stopAnimation() {
    if (!isOpen() || !controls) return;
    petWindow.clearTimeout(restoreTimer);
    controls.idle.hidden = false; controls.strike.hidden = true;
  }
  function animate() {
    if (!isOpen() || !controls) return;
    stopAnimation();
    if (petWindow.matchMedia('(prefers-reduced-motion: reduce)').matches || !controls.strike.complete || !controls.strike.naturalWidth) return;
    controls.idle.hidden = true; controls.strike.hidden = false;
    // Keep the contact frame's timer in the visible window when the tab is hidden.
    restoreTimer = petWindow.setTimeout(stopAnimation, options.duration);
  }
  async function open(settings) {
    if (isOpen()) { petWindow.focus(); return; }
    const child = await window.documentPictureInPicture.requestWindow({width:360,height:280,disallowReturnToOpener:true});
    petWindow = child; options = settings;
    try {
      const doc = child.document;
      doc.documentElement.lang = 'zh-CN'; doc.title = '大肥鱼木鱼 · 悬浮窗';
      const style = doc.createElement('style');
      style.textContent = `
        :root{color-scheme:light;--bg:#fbfcfe;--ink:#415888;--muted:#7f90b4;--line:#dbe4f4;--hover:#edf2fc}
        *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Microsoft YaHei",sans-serif;height:100vh;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;gap:8px}
        body.dark{color-scheme:dark;--bg:#141d35;--ink:#ccdaf7;--muted:#8ea2c8;--line:#344667;--hover:#233352}
        .art{position:relative;width:min(100%,calc((100vh - 62px)*1.5));aspect-ratio:3/2;flex-shrink:0;user-select:none}
        .art img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none}
        button{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation}button:focus-visible{outline:2px solid #6788ce;outline-offset:2px}
        #pet-wood{position:absolute;left:17%;top:61%;width:25%;height:25%;min-width:44px;min-height:44px;border:0;border-radius:45%;padding:0;background:transparent}
        #pet-count{font:15px Georgia,"Microsoft YaHei",serif;font-variant-numeric:tabular-nums;margin:0;max-width:100%;overflow-wrap:anywhere}
        .hint{font-size:10px;color:var(--muted);margin:0}
        #pet-menu{position:fixed;z-index:2;min-width:132px;padding:5px;background:var(--bg);border:1px solid var(--line);border-radius:10px;box-shadow:0 6px 24px #18264225}
        #pet-menu button{display:block;width:100%;text-align:left;background:transparent;border:0;border-radius:6px;padding:9px 12px;font-size:12px}
        #pet-menu button:hover{background:var(--hover)}[hidden]{display:none!important}
      `;
      doc.head.append(style);
      doc.body.innerHTML = `<div class="art"><img id="pet-idle" alt="大肥鱼陪你敲木鱼" draggable="false"><img id="pet-strike" alt="" draggable="false" hidden><button id="pet-wood" type="button" aria-label="敲一下木鱼，功德加一"></button></div><p id="pet-count" role="status" aria-live="polite"></p><p class="hint">点击木鱼 · 右键设置</p><div id="pet-menu" role="group" aria-label="悬浮窗设置" hidden><button id="pet-mute" type="button"></button><button id="pet-theme" type="button"></button><button id="pet-return" type="button">返回网页</button><button id="pet-close" type="button">关闭悬浮窗</button></div>`;
      const $ = id => doc.getElementById(id);
      controls = {idle:$('pet-idle'),strike:$('pet-strike'),wood:$('pet-wood'),count:$('pet-count'),menu:$('pet-menu'),mute:$('pet-mute'),theme:$('pet-theme')};
      controls.idle.src = settings.idle; controls.strike.src = settings.strike;
      controls.wood.addEventListener('click', settings.onStrike);
      const hideMenu = () => { controls.menu.hidden = true; };
      function showMenu(x,y) {
        render(); controls.menu.hidden = false;
        const box = controls.menu.getBoundingClientRect();
        controls.menu.style.left = Math.max(4,Math.min(x,child.innerWidth-box.width-4))+'px';
        controls.menu.style.top = Math.max(4,Math.min(y,child.innerHeight-box.height-4))+'px';
        controls.mute.focus();
      }
      doc.addEventListener('contextmenu', event => {event.preventDefault();showMenu(event.clientX,event.clientY);});
      doc.addEventListener('click', event => {if(!controls.menu.contains(event.target))hideMenu();});
      controls.mute.addEventListener('click', () => {settings.onMute();hideMenu();});
      controls.theme.addEventListener('click', () => {settings.onTheme();hideMenu();});
      $('pet-return').addEventListener('click', () => {hideMenu();window.focus();});
      $('pet-close').addEventListener('click', () => child.close());
      doc.addEventListener('keydown', event => {
        if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
        if (event.key === 'Escape') {event.preventDefault();if(!controls.menu.hidden){hideMenu();controls.wood.focus();}else child.close();return;}
        if (event.code === 'ContextMenu' || (event.code === 'F10' && event.shiftKey)) {event.preventDefault();showMenu(child.innerWidth/2,child.innerHeight/2);return;}
        if (!controls.menu.hidden) return;
        if (event.code === 'Space' || (event.code === 'Enter' && event.target === controls.wood)) {event.preventDefault();if(!event.repeat)settings.onStrike();}
      });
      child.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',stopAnimation);
      child.addEventListener('pagehide', () => {
        child.clearTimeout(restoreTimer);
        if (petWindow === child) {petWindow=null;controls=null;options=null;}
      }, {once:true});
      render();
    } catch (error) {
      child.close();petWindow=null;controls=null;options=null;throw error;
    }
  }
  window.muyuWebPet = {supported,isOpen,open,render,animate};
})();
