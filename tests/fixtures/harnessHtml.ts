// Routed test pages bypass Vite's HTML transform, so initialize Fast Refresh here.
export function harnessHtml(entry: string) {
  return `<html><body><div id="root"></div>
    <script type="module">
      import RefreshRuntime from "/@react-refresh";
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    </script>
    <script type="module" src="/@vite/client"></script>
    <script type="module" src="${entry}"></script>
  </body></html>`;
}
