// One .NET runtime per tab. The engine is loaded on demand from static/playground-engine.
let enginePromise;

export function loadEngine(dotnetUrl, onProgress = () => {}) {
  if (!enginePromise) {
    enginePromise = (async () => {
      // A computed import keeps webpack from bundling the runtime; the browser loads it as is.
      const module = await new Function('url', 'return import(url)')(dotnetUrl);
      const runtime = await module.dotnet
        .withModuleConfig({onDownloadResourceProgress: onProgress})
        .create();
      const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
      return exports.Kahuna.Playground.PlaygroundEngine;
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}
