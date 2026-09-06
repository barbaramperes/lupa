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

---

## D1 — EM REVISÃO (4 set 2026, à espera de decisão)

A investigação de fontes mediu o que D1 assumia, e a premissa não se confirma.

**O que D1 assumia:** ~30 mil ingredientes não cabem no cliente.
**O que foi medido:** o corpus *regulado* — o que produz veredicto — são 2.385
entradas (Anexo II 1758, III 381, IV 154, V 58, VI 34). Com o Anexo VI do CLP
(4.420 substâncias) e índice invertido: 7.131 chaves, 261 KB brotli,
0,53 ms por ingrediente, 8 ms para um rótulo de 15.

**O glossário completo de 36.195 nomes não é obtível por nenhuma via legítima:**
`/api/cosmetics/export-csv` devolve 401 (exige chave do gateway); a EU Search
API satura a paginação aos 10.000 e os filtros por campo falham em silêncio,
devolvendo a base toda quando se pede um anexo. A única chave disponível está
exposta no bundle JS da própria SPA e é uma dependência não contratada.
Consequência: "acesso a todos os ingredientes" não se resolve com backend —
resolve-se pedindo acesso próprio à Comissão, ou não se resolve.

**O que um backend daria mesmo:** sincronização entre dispositivos e OCR no
servidor. Nenhum dos dois foi pedido.
**O que custaria:** as listas de produtos que uma pessoa analisa, cruzadas com
um sinalizador de gravidez, são dados de saúde na aceção do art. 9.º do RGPD.
Sem servidor não há endpoint para onde enviá-los, e a garantia passa a ser
arquitetural (CSP `default-src 'none'`) em vez de uma promessa numa política.

D2 (telemóvel + desktop) e D3 (quatro eixos de fiabilidade) mantêm-se intactas
e são implementadas na íntegra em qualquer dos cenários.

---

## D4 — O veredicto é factual; o índice é editorial e está rotulado como tal

**Decidido por:** Bárbara, 4 set 2026 ("factos e índice").

A primeira versão do frontend derivava o veredicto do índice, e apanhou-se a
contradição em ecrã: anunciava "Sem alertas regulamentares" numa lista que
mostrava, três linhas abaixo, "Reprotóxico cat. 2".

Passou a haver duas camadas que não se podem contradizer:

**Camada 1, factos.** Contagens (proibidos · com limites · reprotóxicos · por
identificar) e uma frase derivada só dos anexos. Cada afirmação traz o anexo,
o número de entrada, a data de extração e a licença. O texto legal é copiado,
nunca parafraseado.

**Camada 2, leitura editorial.** O índice 0–100, num bloco visualmente
separado, com a etiqueta "não é um facto regulamentar", a fórmula à vista e
a lista de penalizações discriminada. A regra: a camada 2 nunca cria um
alerta que a camada 1 não tenha.

Porquê separar: os anexos da UE classificam por *classe de perigo*, não por
severidade. Somá-los num número é uma escolha discutível — e é precisamente o
tipo de transformação de dados que aproxima uma app da fronteira do software
com finalidade médica. Os factos mantêm-se do lado seguro dessa linha.

## D5 — Três estados na interface, nunca dois

Reconhecido, sugestão, por identificar. Uma app que só tem "alerta" e "ok"
apresenta o desconhecido como seguro, que é a mentira mais fácil de contar
neste domínio. Um rótulo com 8 entradas por identificar e 0 alertas mostra
"8 por identificar" e não "tudo limpo".
