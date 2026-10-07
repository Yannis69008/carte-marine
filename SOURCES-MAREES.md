# Marées : sources

- `marees-europe.json` : constantes harmoniques de ~780 marégraphes (Europe et outre-mer français), tirées de
  **TICON-4** — Hart-Davis, M., Dettmering, D., Seitz, F. (2025). TICON-4: TIdal CONstants based on GESLA-4 sea-level records. SEANOE. https://doi.org/10.17882/109129 — licence CC BY 4.0
  et des constantes publiées par **Kartverket** (Norvège), CC BY 4.0, via la base Slackwater (https://github.com/openwatersio/slackwater-database), niveaux de référence calculés par ce projet.
  Modifications : sélection Europe, dédoublonnage, arrondi (mm, 0,1°), choix du zéro de référence.
- `tide-engine.js` : calculateur harmonique @slackwater/engine (licence MIT, © 2019 Kevin Miller, © 2025 Brandon Keepers).
