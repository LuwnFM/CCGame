/**
 * Native mobile fullscreen/orientation controls. Browsers without these APIs
 * must preserve the existing responsive layouts and ask the user to rotate
 * manually; CSS never pretends to change the hardware orientation.
 */
export function setupDisplayControls({fullscreenButton,orientationButton,fullscreenLabel,orientationLabel,notify,translate = v=>v}) {
  function isLandscape() {
    return window.matchMedia('(orientation: landscape)').matches;
  }
  function update() {
    const active = !!document.fullscreenElement;
    const fullscreenText = active ? 'Выйти из полноэкранного режима' : 'Включить полноэкранный режим';
    fullscreenButton.title = translate(fullscreenText);
    fullscreenButton.setAttribute('aria-label',translate(fullscreenText));
    fullscreenLabel.textContent = translate('Экран');
    const orientationText = 'Сменить ориентацию экрана';
    orientationButton.title = translate(orientationText);
    orientationButton.setAttribute('aria-label',translate(orientationText));
    orientationLabel.textContent = translate('Повернуть');
    orientationButton.dataset.target = isLandscape() ? 'portrait' : 'landscape';
    orientationButton.dataset.fullscreen = String(active);
    fullscreenButton.setAttribute('aria-pressed',String(active));
  }
  fullscreenButton.addEventListener('click',async()=>{
    try {
      if (document.fullscreenElement) {
        if(screen.orientation?.unlock) screen.orientation.unlock();
        await document.exitFullscreen();
      } else {
        if (typeof document.documentElement.requestFullscreen !== 'function')
          throw Error('unsupported');
        await document.documentElement.requestFullscreen();
      }
    }catch {
      notify('На этом устройстве нельзя включить полноэкранный режим из браузера. Попробуйте добавить сайт на главный экран.');
    }finally{update()}
  });
  orientationButton.addEventListener('click',async()=>{
    const target = isLandscape() ? 'portrait' : 'landscape';
    try {
      if (typeof screen.orientation?.lock !== 'function') throw Error('unsupported');
      // Android browsers commonly require fullscreen for screen.orientation.lock().
      if (!document.fullscreenElement) {
        if (typeof document.documentElement.requestFullscreen !== 'function') throw Error('unsupported');
        await document.documentElement.requestFullscreen();
      }
      await screen.orientation.lock(target);
      notify(target==='landscape'?'Горизонтальный режим':'Вертикальный режим');
    }catch {
      notify('На этом устройстве автоматический поворот недоступен. Поверните телефон вручную и включите автоповорот.');
    }finally{update()}
  });
  document.addEventListener('fullscreenchange',update);
  if (screen.orientation?.addEventListener) screen.orientation.addEventListener('change',update);
  window.addEventListener('resize',update);
  update();
}
