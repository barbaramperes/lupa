#!/usr/bin/env bash
# Arranca a API e o frontend juntos, e mata os dois com um Ctrl+C.
#
# Existe porque correr os dois à mão convida a três erros que aconteceram
# todos no mesmo dia: esquecer a API e ver a app a falhar sem dizer porquê,
# deixar uma porta ocupada de uma sessão anterior, e acabar com dois
# frontends em portas diferentes.
set -euo pipefail
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PORTA_API=8787
PORTA_WEB=5178

# Portas ocupadas são quase sempre restos da sessão anterior. Avisa e para,
# em vez de fugir para uma porta aleatória — que foi o que criou dois
# servidores a servir a mesma coisa.
for p in $PORTA_API $PORTA_WEB; do
  if lsof -ti "tcp:$p" >/dev/null 2>&1; then
    echo "A porta $p já está ocupada por:"
    lsof -i "tcp:$p" | sed 's/^/    /'
    echo
    echo "Provavelmente é uma sessão anterior. Para a libertar:"
    echo "    lsof -ti tcp:$p | xargs kill"
    exit 1
  fi
done

pids=()
terminar() {
  echo
  echo "A terminar…"
  for pid in "${pids[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
  exit 0
}
trap terminar INT TERM

echo "API      → http://localhost:$PORTA_API"
( cd "$RAIZ/apps/api" && exec npx tsx src/servidor.ts ) & pids+=($!)

# A API carrega um núcleo de 14 MB; dar-lhe uns segundos evita que o
# primeiro pedido do frontend apanhe a porta ainda fechada.
sleep 3

echo "frontend → http://localhost:$PORTA_WEB"
( cd "$RAIZ/apps/web" && exec npx ng serve --port "$PORTA_WEB" ) & pids+=($!)

echo
echo "Ctrl+C mata os dois."
wait
