// The WebAssembly SDK builds an executable, so there must be an entry point. The page never runs it:
// JavaScript loads the runtime and calls the exports on Kahuna.Playground.PlaygroundEngine directly.
return 0;
