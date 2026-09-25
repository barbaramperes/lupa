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
# O gh abre um paginador (less) quando o stdout é um terminal, e o script
# ficava parado num "(END)" à espera de um q que ninguém sabia que tinha de
# dar. Nunca paginar; nunca perguntar.
export GH_PAGER=cat GH_PROMPT_DISABLED=1 PAGER=cat
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

echo "→ branch gh-pages (por cima do anterior: os assets antigos ficam)"
# NÃO se faz orphan. O Pages envia cache-control: max-age=600 no index.html,
# e um index em cache aponta para bundles com hash. Se a publicação apagar os
# bundles anteriores, quem tiver o index antigo em cache vê a página partida —
# foi exatamente o que aconteceu. Comita-se por cima do remoto e os ficheiros
# antigos sobrevivem; o index novo aponta para os novos. Custo: uns 200 kB por
# publicação, que o core.json (mesmo nome, substituído) não agrava.
git fetch -q origin gh-pages
WT="$(mktemp -d)"
git worktree add -q --detach "$WT" origin/gh-pages
(
  cd "$WT"
  cp -R "$DIST"/. .
  touch .nojekyll
  git add -A
  if git diff --cached --quiet; then echo "  nada mudou no build"; else
    git -c user.email=barbaraperes2003@gmail.com -c user.name="Barbara Peres" \
        commit -qm "Build estático ($(git -C "$RAIZ" rev-parse --short main))"
  fi
  git push -q origin HEAD:gh-pages
)
git worktree remove -f "$WT"
echo "  enviado: $(git rev-parse --short origin/gh-pages) · assets no branch: $(git ls-tree -r origin/gh-pages --name-only | grep -cE '^(main|styles|chunk)-')"

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
if git ls-tree -r origin/gh-pages --name-only | grep -qx "$SERVIDO"; then
  echo "· o Pages serve $SERVIDO, que é OUTRA publicação já no branch — alguém publicou depois desta. Nada a fazer."
  exit 0
fi
echo "✗ tempo esgotado: o Pages construiu mas ainda serve $SERVIDO em vez de $NOVO"
exit 1
