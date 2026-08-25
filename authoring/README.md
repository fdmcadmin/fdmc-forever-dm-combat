# authoring

The author button in the app writes `current.json` here.

It is the same payload the `↓ Author` download produces. `.github/workflows/fold-authoring.yml`
watches this path: on every change it folds the payload into
`src/data/broken-chain/authored.generated.ts`, runs every gate against the result, and commits
the generated file back only if they pass.

Do not edit `current.json` by hand. It carries a digest that `fold-authoring` verifies, and a
hand edit fails that check rather than being silently accepted.
