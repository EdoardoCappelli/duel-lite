# Duel Lite

Simulatore manuale di duelli Yu-Gi-Oh! leggero, da telefono, per giocare tra amici.
Niente build: file statici + un Worker Cloudflare di ~60 righe, tutto nel piano gratuito.

- **Rete**: ogni codice stanza è una piccola "stanza" (Durable Object) sul Worker Cloudflare gratuito, che inoltra i messaggi tra i due telefoni via WebSocket (`worker.js`). Funziona con qualsiasi rete, anche dati mobili, e si riconnette da sola.
- **Carte**: dati e immagini da YGOProDeck. I dati vengono salvati in `localStorage` e le immagini restano nella cache HTTP del browser, quindi ogni carta si scarica una volta sola.
- **Mazzi**: salvati nel telefono. Si importano/esportano come `.ydk` o link `ydke://` (lo stesso formato di Duelingbook/EDOPro).

## Pubblicarlo gratis

**Cloudflare (Worker con asset statici, piano gratuito)**: è già online su
https://duel-lite.edoardocappelli1999.workers.dev. Per aggiornarlo, da questa cartella:
```
npx wrangler deploy
```
(`wrangler.jsonc` e `.assetsignore` sono già configurati. L'app carica sempre l'ultima versione quando c'è rete; la cache serve solo offline. Cambia `V` in `sw.js` quando modifichi i file.)

Test in locale con le stanze vere: `npx wrangler dev --port 8798`.

Poi dal telefono apri l'URL e scegli "Aggiungi a schermata Home".

## Come si gioca

1. Importa un mazzo (Mazzi → ⋯ → Importa) oppure costruiscilo con la ricerca.
2. Uno crea la stanza e condivide il link/codice; l'altro tocca il link o inserisce il codice.
3. Tocca una carta per le azioni, tienila premuta per lo zoom. Tocca Deck/GY/Banish/Extra per gestirli.
   Tocca i LP per cambiarli (anche quelli avversari), tocca il riquadro del turno per cambiare fase o finire il turno. ↶ annulla l'ultima azione.

Il gioco è manuale come su Duelingbook: le regole non vengono controllate.
Le carte nascoste (mano, Deck, carte coperte) non vengono inviate all'avversario.

## Test in locale
```
python -m http.server 8797 --directory duel-lite
```

## Verifica mosse

La schermata in `lab/` applica le regole con il motore di EDOPro nel browser: si apre dal menu ☰ del duello o dalla home. Dettagli in `lab/README.md`.

## Licenza

GNU Affero General Public License v3.0 (vedi `LICENSE`), perché l'app include il motore [ygopro-core](https://github.com/edo9300/ygopro-core), sotto la stessa licenza. Come ricompilarlo è spiegato in `lab/vendor/BUILD.md`.

Yu-Gi-Oh! è un marchio dei rispettivi proprietari. Questo è un progetto amatoriale, non affiliato a Konami. Le immagini e le descrizioni delle carte non sono incluse: si scaricano da YGOProDeck. `lab/cards.json` contiene nomi, statistiche e brevi testi degli effetti presi dal database [BabelCDB](https://github.com/ProjectIgnis/BabelCDB) di Project Ignis.
