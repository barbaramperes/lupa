# Decisões de arquitetura

Registo do que foi decidido, por quem e porquê. Uma linha por decisão; se uma
decisão for revertida, marca-se como revertida e diz-se o que a substituiu —
não se apaga.

## D1 — Backend com base de dados, não bundle estático
**Decidido por:** Bárbara, 4 set 2026.
**Porquê:** requisito explícito de "acesso sempre a todos os ingredientes". O
CosIng tem cerca de 30 mil ingredientes; somando o Anexo VI do CLP, as listas
da ECHA e os aditivos alimentares, e exigindo correspondência aproximada por
cima, deixa de ser razoável embarcar tudo no cliente. Um bundle estático
serviria uma base curada de centenas de fichas, não uma ingestão regulamentar
completa.
**Custo aceite:** alojamento pago ou plano gratuito com limites, manutenção de
um serviço, e uma superfície de privacidade que não existia.

## D2 — Telemóvel e desktop, com capacidades diferentes
**Decidido por:** Bárbara, 4 set 2026.
**Porquê:** o uso real é nos dois. Câmara (OCR do rótulo, código de barras) só
faz sentido no telemóvel; comparar produtos lado a lado só faz sentido no
desktop. Não é o mesmo ecrã encolhido — são dois modos do mesmo produto.

## D3 — Quatro eixos de fiabilidade, todos aceites
**Decidido por:** Bárbara, 4 set 2026.
Cobertura, rastreabilidade, correspondência e concentração. Nenhum foi
dispensado, o que significa que o modelo de dados tem de carregar proveniência
por afirmação, e não só o veredicto.

## Em aberto — a decidir com a investigação de fontes em curso
- Que fontes têm exportação em massa e licença que permita redistribuição.
- Como reconciliar perigo dicotómico (dados oficiais) com severidade e força de
  evidência (julgamento), sem inventar precisão.
- OCR no browser ou no servidor, e o que isso custa em privacidade.
