import { createApp } from 'vue';
import { createScriptIdDiv, teleportStyle } from '../../util/script';
import App from './App.vue';

$(() => {
  errorCatched(() => {
    updateScriptButtonsWith(buttons => buttons.filter(button => button.name !== '打开 RPG 游戏界面'));
    const chat = window.parent.document.querySelector<HTMLElement>('#chat');
    if (!chat) throw new Error('找不到酒馆聊天区域');
    if (chat.querySelector('[data-rpg-unified]')) {
      console.info('[RPG游戏界面] 已有界面运行，本脚本跳过重复挂载');
      return;
    }
    const $root = createScriptIdDiv();
    $root.attr('data-rpg-unified', '').appendTo(chat);
    const app = createApp(App);
    const styles = teleportStyle();
    const fontStyle = window.parent.document.createElement('link');
    fontStyle.rel = 'stylesheet';
    fontStyle.href = 'https://fontsapi.zeoseven.com/7/main/result.css';
    window.parent.document.head.append(fontStyle);
    const hostStyle = window.parent.document.createElement('style');
    hostStyle.textContent = `
      #chat.rpg-unified-active > .mes { display: none !important; }
      #chat.rpg-unified-active > [data-rpg-unified] { width: 100%; min-height: 100%; display: flex; flex: 1 0 auto; }
      body.rpg-fullscreen-active #sheld { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100dvh !important; max-width: none !important; max-height: none !important; margin: 0 !important; transform: none !important; border-radius: 0 !important; z-index: 3000 !important; }
      body.rpg-fullscreen-active #chat { max-height: none !important; }
      body.rpg-fullscreen-active #sheldheader, body.rpg-fullscreen-active #top-bar { display: none !important; }
      body.rpg-fullscreen-active #top-settings-holder { background: transparent !important; pointer-events: none; }
      body.rpg-fullscreen-active #top-settings-holder > .drawer > .drawer-toggle { visibility: hidden; }
      body.rpg-fullscreen-active #top-settings-holder .drawer-content { pointer-events: auto; }
    `;
    window.parent.document.head.append(hostStyle);
    chat.classList.add('rpg-unified-active');
    app.mount($root[0]);
    const observer = new MutationObserver(() => {
      if (!$root[0].isConnected) chat.append($root[0]);
    });
    observer.observe(chat, { childList: true });
    $(window).on('pagehide', () => {
      observer.disconnect();
      app.unmount();
      $root.remove();
      chat.classList.remove('rpg-unified-active');
      window.parent.document.body.classList.remove('rpg-fullscreen-active');
      hostStyle.remove();
      fontStyle.remove();
      styles.destroy();
    });
    console.info('[RPG游戏界面] 已挂载统一聊天界面');
  })();
});
