#!/usr/bin/env bash
# Publica o build estático no GitHub Pages através do branch gh-pages.
#
# Existe porque o workflow de Actions (pages.yml) não corre nesta conta — o
# GitHub bloqueou-lhe os runners por faturação — mas o build de branch do
# Pages corre no builder do próprio GitHub e passa. E porque fazer isto à mão
# já falhou uma vez: um branch gh-pages local obsoleto fez o `checkout --orphan`
# recusar, a cadeia parou em silêncio, e o Pages reconstruiu o site ANTIGO com
# ar de sucesso. O script apaga o branch local antes, e no fim verifica que o
# bundle servido é o que acabou de construir — não confia no HTTP 200.
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="barbaramperes/lupa"
URL="https://barbaramperes.github.io/lupa/"
cd "$RAIZ"

echo "→ núcleo e build estático"
test -f data/build/core.json || { echo "  data/build/core.json em falta: corre 'pnpm ingest' primeiro"; exit 1; }
mkdir -p apps/web/public/nucleo
cp data/build/core.json apps/web/public/nucleo/core.json
( cd apps/web && npx ng build --configuration static 2>&1 | grep -E 'Initial total|ERROR' | sed 's/^/  /' )
DIST="$RAIZ/apps/web/dist/lupa-web/browser"
NOVO=$(grep -oE 'main-[A-Z0-9]+\.js' "$DIST/index.html" | head -1)
echo "  bundle construído: $NOVO"

echo "→ branch gh-pages"
git branch -D gh-pages -q 2>/dev/null || true   # o remoto é a verdade; o local só atrapalha
WT="$(mktemp -d)"
git worktree add -q --detach "$WT"
(
  cd "$WT"
  git checkout -q --orphan gh-pages
  git rm -rfq . 2>/dev/null || true
  cp -R "$DIST"/. .
  touch .nojekyll
  git add -A
  git -c user.email=barbaraperes2003@gmail.com -c user.name="Barbara Peres" \
      commit -qm "Build estático ($(git -C "$RAIZ" rev-parse --short main))"
  git push -q -f origin gh-pages
)
git worktree remove -f "$WT"
git branch -D gh-pages -q 2>/dev/null || true
echo "  enviado: $(git rev-parse --short origin/gh-pages)"

echo "→ build do Pages"
gh api -X POST "repos/$REPO/pages/builds" --jq '"  pedido: \(.status)"'
for i in $(seq 1 9); do
  sleep 20
  ST=$(gh api "repos/$REPO/pages/builds/latest" --jq .status 2>/dev/null || echo "?")
  SERVIDO=$(curl -sL --max-time 15 "$URL?v=$RANDOM" | grep -oE 'main-[A-Z0-9]+\.js' | head -1 || true)
  echo "  +$((i*20))s · $ST · servido: ${SERVIDO:-?}"
  if [ "$ST" = "built" ] && [ "$SERVIDO" = "$NOVO" ]; then
    echo "✓ no ar: $URL"
    echo "  (o teu browser pode mostrar o anterior até um refresh forçado: Cmd+Shift+R)"
    exit 0
  fi
  [ "$ST" = "errored" ] && { echo "✗ o build do Pages falhou"; gh api "repos/$REPO/pages/builds/latest" --jq '.error.message'; exit 1; }
done
echo "✗ tempo esgotado: o Pages construiu mas ainda serve $SERVIDO em vez de $NOVO"
exit 1
