$(() => {
  const host = window.parent;
  const config = { rosterFromWorldbook: true, roles: {} };
  host.__rpgSceneConfig = config;
  host.dispatchEvent(new Event('rpg-scene-config-changed'));
  $(window).on('pagehide', () => {
    if (host.__rpgSceneConfig === config) {
      delete host.__rpgSceneConfig;
      host.dispatchEvent(new Event('rpg-scene-config-changed'));
    }
  });
});
