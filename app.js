(() => {
  'use strict';

  const previewTwoFrames = window.muyuAnimation.preview === true;
  const storageKey = previewTwoFrames ? 'dafeyu-muyu-preview-2-v1' : 'dafeyu-muyu-v1';
  const $ = (id) => document.getElementById(id);
  const count = $('count');
  const scene = $('scene');
  const sceneArt = $('scene-art');
  const woodButton = $('wood-button');
  const strikeImage = $('hero-strike');
  if (previewTwoFrames) $('hero-idle').src = window.muyuAnimation.base + window.muyuAnimation.frames[0].file;
  const strikeFrames = window.muyuAnimation.frames.slice(1).map(frame => {
    const image = frame.name === 'strike' ? strikeImage : document.createElement('img');
    image.id = 'hero-' + frame.name;
    image.className = 'hero hero-motion';
    image.src = window.muyuAnimation.base + frame.file;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.width = 1536; image.height = 1024; image.draggable = false;
    if (frame.name !== 'strike') sceneArt.append(image);
    return { ...frame, image };
  });
  const soundToggle = $('sound-toggle');
  const themeToggle = $('theme-toggle');
  const resetDialog = $('reset-dialog');
  const downloadDialog = $('download-dialog');
  const supportDialog = $('support-dialog');
  const supportImageDialog = $('support-image-dialog');
  const modalOpen = () => resetDialog.open || downloadDialog.open || supportDialog.open || supportImageDialog.open;
  const desktop = window.muyuDesktop;
  const localDesktop = location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let state = { count: 0, muted: false, dark: false };
  let audioContext;
  let knockBuffer;
  let masterGain;
  let sceneAnimation;
  let strikeTimer;
  let activeStrikeImage;
  let announceTimer;
  const activeSources = new Set();
  let remoteRevision = -1;
  let pendingRemote = 0;
  let deferredRemote;

  function applyRemote(value) {
    if (!Number.isSafeInteger(value?.count) || value.count < 0 || !Number.isSafeInteger(value.revision)) return;
    if (pendingRemote > 0) {
      if (!deferredRemote || deferredRemote.revision < value.revision) deferredRemote = value;
      return;
    }
    if (value.revision < remoteRevision) return;
    remoteRevision = value.revision;
    state = { count: value.count, muted: value.muted === true, dark: value.dark === true };
    renderCount(); renderSettings(); save();
  }

  function sendRemote(action) {
    if (!desktop?.connected) return;
    pendingRemote++;
    desktop.mutate(action).then(value => {
      pendingRemote--;
      if (pendingRemote === 0) {
        applyRemote(deferredRemote && deferredRemote.revision > value.revision ? deferredRemote : value);
        deferredRemote = null;
      }
    }).catch(() => {
      pendingRemote--;
      notice('桌面连接暂时断开，本次操作未同步。');
    });
  }

  document.addEventListener('muyu-remote-state', event => applyRemote(event.detail));

  function notice(message) {
    $('notice').textContent = message;
    $('notice').hidden = !message;
  }

  function parseState(value) {
    const saved = JSON.parse(value);
    if (!saved || typeof saved !== 'object') return null;
    return {
      count: Number.isSafeInteger(saved.count) && saved.count >= 0 ? saved.count : 0,
      muted: saved.muted === true,
      dark: saved.dark === true
    };
  }

  try {
    const saved = parseState(localStorage.getItem(storageKey));
    if (saved) state = saved;
  } catch {
    notice('浏览器无法读取本地记录，仍可自在敲击。');
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      notice('当前浏览器无法保存记录，仍可自在敲击。');
    }
  }

  function renderCount() {
    count.textContent = state.count.toLocaleString('zh-CN');
    count.classList.toggle('long-count', count.textContent.length > 12);
  }

  function renderSettings() {
    document.body.classList.toggle('dark', state.dark);
    soundToggle.classList.toggle('muted', state.muted);
    soundToggle.setAttribute('aria-pressed', String(state.muted));
    soundToggle.setAttribute('aria-label', state.muted ? '开启声音' : '静音');
    soundToggle.title = state.muted ? '开启声音' : '静音';
    themeToggle.setAttribute('aria-pressed', String(state.dark));
    themeToggle.setAttribute('aria-label', state.dark ? '切换到日间模式' : '切换到夜间模式');
    themeToggle.title = state.dark ? '日间模式' : '夜间模式';
    document.querySelector('meta[name="theme-color"]').content = state.dark ? '#141d35' : '#fbfcfe';
    if (masterGain) masterGain.gain.setTargetAtTime(state.muted ? 0 : .65, audioContext.currentTime, .012);
  }

  // A brief impact excites damped wooden resonances, generated entirely offline.
  function prepareAudio() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      notice('当前浏览器不支持音效，试试用 Edge 或 Chrome 打开。');
      return false;
    }
    if (!audioContext) {
      audioContext = new Context();
      masterGain = audioContext.createGain();
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 12;
      compressor.ratio.value = 6;
      compressor.attack.value = .003;
      compressor.release.value = .1;
      masterGain.connect(compressor);
      compressor.connect(audioContext.destination);
      masterGain.gain.value = state.muted ? 0 : .65;
      const rate = audioContext.sampleRate;
      knockBuffer = audioContext.createBuffer(1, Math.ceil(rate * .55), rate);
      const samples = knockBuffer.getChannelData(0);
      const modes = [[516, .47, 19], [843, .24, 26], [1372, .13, 38], [2136, .08, 55]];
      let previousNoise = 0;
      for (let i = 0; i < samples.length; i++) {
        const t = i / rate;
        let wave = 0;
        for (const [frequency, strength, decay] of modes) {
          wave += Math.sin(2 * Math.PI * frequency * t) * strength * Math.exp(-t * decay);
        }
        previousNoise = previousNoise * .45 + (Math.random() * 2 - 1) * .55;
        const impact = previousNoise * .23 * Math.exp(-t * 160);
        samples[i] = Math.tanh((wave + impact) * 1.25) * .72 * Math.min(1, t / .0008);
      }
    }
    return true;
  }

  async function playKnock() {
    if (state.muted) return;
    try {
      if (!prepareAudio()) return;
      if (audioContext.state !== 'running') await audioContext.resume();
      if (state.muted || audioContext.state !== 'running') return;
      if (activeSources.size >= 8) {
        const oldest = activeSources.values().next().value;
        activeSources.delete(oldest);
        oldest.stop();
      }
      const source = audioContext.createBufferSource();
      source.buffer = knockBuffer;
      source.playbackRate.value = .98 + Math.random() * .04;
      source.connect(masterGain);
      activeSources.add(source);
      source.onended = () => {
        activeSources.delete(source);
        source.disconnect();
      };
      source.start();
    } catch {
      notice('声音暂时无法播放，试试开启浏览器的声音权限。');
    }
  }

  function temporaryEffect(parent, className, life) {
    const limit = className === 'merit' ? 4 : 2;
    if (parent.children.length >= limit) parent.firstElementChild.remove();
    const element = document.createElement('span');
    element.className = className;
    parent.append(element);
    setTimeout(() => element.remove(), life);
    return element;
  }

  function stopStrikeAnimation() {
    clearTimeout(strikeTimer);
    activeStrikeImage?.removeAttribute('data-active');
    activeStrikeImage = null;
    scene.classList.remove('striking');
    delete scene.dataset.frame;
  }

  function animateStrike() {
    stopStrikeAnimation();
    const frames = strikeFrames.every(frame => frame.image.complete && frame.image.naturalWidth > 0)
      ? strikeFrames
      : [{ name: 'strike', image: strikeImage, duration: 140 }];
    if (!frames[0].image.complete || !frames[0].image.naturalWidth) return;
    let index = 0;
    scene.classList.add('striking');
    function nextFrame() {
      if (index === frames.length) { stopStrikeAnimation(); return; }
      const frame = frames[index++];
      activeStrikeImage?.removeAttribute('data-active');
      activeStrikeImage = frame.image;
      activeStrikeImage.dataset.active = 'true';
      scene.dataset.frame = frame.name;
      strikeTimer = setTimeout(nextFrame, frame.duration);
    }
    nextFrame();
  }

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) { stopStrikeAnimation(); sceneAnimation?.cancel(); }
  });

  function strike(event) {
    if (modalOpen() || state.count >= Number.MAX_SAFE_INTEGER) return;
    if (event?.pointerType === 'touch' || (event?.detail > 0 && window.matchMedia('(pointer: coarse)').matches)) {
      try { navigator.vibrate?.(12); } catch { /* Touch feedback is optional on unsupported devices. */ }
    }
    state.count++;
    renderCount();
    save();
    void playKnock();
    sendRemote({ type: 'strike' });

    const merit = temporaryEffect($('merits'), 'merit', reducedMotion.matches ? 450 : 1050);
    merit.textContent = '功德 +1';
    merit.style.setProperty('--drift', (((state.count % 3) - 1) * 36 + (Math.random() - .5) * 12) + 'px');
    if (!reducedMotion.matches) {
      temporaryEffect($('ripples'), 'ripple', 700);
      animateStrike();
      sceneAnimation?.cancel();
      sceneAnimation = sceneArt.animate([
        { transform: 'translateY(0)' },
        { transform: 'translateY(2px)', offset: .3 },
        { transform: 'translateY(0)' }
      ], { duration: 230, easing: 'ease-out' });
    }
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      $('announcement').textContent = '累积功德 ' + state.count + '。';
    }, 500);
  }

  woodButton.addEventListener('click', strike);
  document.addEventListener('keydown', (event) => {
    if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey || modalOpen()) return;
    const target = event.target instanceof Element ? event.target : null;
    const focusedWood = target?.closest('#wood-button');
    if (event.code !== 'Space' && !(event.code === 'Enter' && focusedWood)) return;
    if (!focusedWood && target?.closest('button, input, textarea, select, a, [contenteditable]')) return;
    event.preventDefault();
    if (!event.repeat) strike();
  });

  soundToggle.addEventListener('click', () => {
    state.muted = !state.muted;
    renderSettings();
    save();
    sendRemote({ type: 'mute', muted: state.muted });
  });
  themeToggle.addEventListener('click', () => {
    state.dark = !state.dark;
    renderSettings();
    save();
    sendRemote({ type: 'theme', dark: state.dark });
  });
  $('reset-button').addEventListener('click', () => {
    resetDialog.returnValue = 'cancel';
    resetDialog.showModal();
  });
  $('download-button').addEventListener('click', () => downloadDialog.showModal());
  $('support-button').addEventListener('click', () => {
    supportDialog.returnValue = 'exit';
    supportDialog.showModal();
  });
  supportDialog.addEventListener('cancel', () => { supportDialog.returnValue = 'exit'; });
  supportDialog.addEventListener('close', () => {
    if (supportDialog.returnValue === 'yes') supportImageDialog.showModal();
  });
  supportImageDialog.addEventListener('close', () => $('support-button').focus());
  for (const dialog of [downloadDialog, supportDialog, supportImageDialog]) {
    dialog.addEventListener('click', event => {
      const bounds = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close('exit');
    });
  }
  resetDialog.addEventListener('cancel', () => {
    resetDialog.returnValue = 'cancel';
  });
  resetDialog.addEventListener('close', () => {
    if (resetDialog.returnValue !== 'reset') return;
    state.count = 0;
    clearTimeout(announceTimer);
    stopStrikeAnimation();
    sceneAnimation?.cancel();
    $('merits').replaceChildren();
    $('ripples').replaceChildren();
    renderCount();
    save();
    sendRemote({ type: 'reset' });
    $('announcement').textContent = '已重新开始，累积功德为零。';
  });
  window.addEventListener('storage', (event) => {
    if (desktop?.connected) return;
    if (event.key !== storageKey || !event.newValue) return;
    try {
      const saved = parseState(event.newValue);
      if (!saved) return;
      state = saved;
      renderCount();
      renderSettings();
    } catch { /* Ignore invalid data from another tab. */ }
  });
  for (const image of document.querySelectorAll('.hero')) {
    image.addEventListener('error', () => {
      notice('角色图片没有加载成功，请从完整的游戏文件夹打开页面。');
    });
  }

  renderCount();
  renderSettings();
  save();

  if (previewTwoFrames) {
    document.title = '大肥鱼木鱼 · 两帧预览';
    notice('两帧预览：待机 → 敲击 → 待机。');
  }

  if (localDesktop && window.muyuDesktopAutoConnect && !previewTwoFrames) {
    desktop.connect(state).then(applyRemote).catch(() => notice('桌面模式未连接，请重新双击「电子木鱼.cmd」。'));
  }
})();
