# Verifica mosse

Applica le regole con il motore di EDOPro nel browser. Si apre sopra il duello, che resta collegato.

- `engine.js`: avvio del motore, posizione, domande del motore. `index.html`: schermata.
- `vendor/`: [`ocgcore-wasm`](https://github.com/n1xx1/ocgcore-wasm) 0.1.6 (wrapper MIT), con il motore ricompilato per Safari: vedi `vendor/BUILD.md`.
- `cards.json`: generato da `cards.cdb` di [BabelCDB](https://github.com/ProjectIgnis/BabelCDB) con `tools/build_cards.py`.
- Gli script Lua si scaricano da [CardScripts](https://github.com/ProjectIgnis/CardScripts).

Il motore [`ygopro-core`](https://github.com/edo9300/ygopro-core) è sotto AGPL-3.0, come l'intera app: il codice sorgente è linkato nell'app.

Server per il telefono: `python tools/serve.py`.

Test: `node tools/test_engine.mjs`, `node tools/test_overlay.mjs`, `node tools/fuzz.mjs 24 3000`.
