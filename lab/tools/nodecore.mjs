// Node has no fetch for file: URLs, so tests hand the wasm to the engine directly.
import { readFileSync } from 'node:fs';
const bytes = readFileSync(new URL('../vendor/ocgcore.sync.wasm', import.meta.url));
export const nodeOpts = { instantiateWasm: (imports, ok) => { WebAssembly.instantiate(bytes, imports).then(r => ok(r.instance, r.module)); return {}; } };
