# Motore ricompilato

`index.js` e i chunk vengono da `ocgcore-wasm` 0.1.6 su npm. `ocgcore.sync-VACWSK37.js` e `ocgcore.sync.wasm` sono ricompilati dal sorgente di
[n1xx1/ocgcore-wasm](https://github.com/n1xx1/ocgcore-wasm) commit `6e9a76d`, con [ygopro-core](https://github.com/edo9300/ygopro-core) commit `baa3881`, usando Emscripten 6.0.13.

Il pacchetto npm usa `-fwasm-exceptions -sSUPPORT_LONGJMP=wasm` e su Safari 26 `createDuel` lancia `WebAssembly.Exception`. Qui si usa invece:

    -fexceptions -sSUPPORT_LONGJMP=emscripten

Le altre opzioni sono quelle di `scripts/build.sh` per la versione sync.
