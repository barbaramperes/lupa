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

---

## D6 — Correspondência exata e aproximada usam conjuntos de chaves diferentes

**Descoberto ao ligar a ponte CAS→INCI do PubChem, 6 set 2026.**

A ponte levou o índice de 9 209 para 116 980 chaves e resolveu o problema que
existia: 64% das substâncias proibidas do Anexo II passaram a ser alcançáveis
pelo nome que está no rótulo, contra os 18% de antes.

Mas a suite de regressão passou de 0 para **610 travessias** — sugestões que
atravessavam um par com estatuto regulamentar divergente. A causa não foi um
limiar mal calibrado: a nomenclatura IUPAC é sistematicamente adversarial à
distância de edição.

    HEXENAL      ⟷ HEPTENAL        uma letra, um carbono a mais
    ETHOXY…      ⟷ METHOXY…        uma letra, outro éter
    2,3-…DIOL    ⟷ 2,7-…DIOL       um dígito, outro isómero

A resposta certa não era apertar guardas até isto passar. Foi reconhecer que
estes nomes servem para uma coisa e não para outra:

- **Correspondência exata** usa TODAS as chaves. É o alcance, e é o objetivo
  da ponte: alguém que cole uma ficha de segurança ou escreva um nome químico
  é atendido.
- **Correspondência aproximada** usa apenas as chaves vindas dos textos legais
  da UE (`fuzzy_keys`). Adivinhar o que alguém quis escrever só se faz contra
  nomes que alguém escreveria. Ninguém escreve "2,2'-[2-etoxietoxi]etan-1-ol"
  num rótulo de cosmético.

Efeito: 610 travessias → 12, e o teste passou de 62 s para 1,7 s. As 12
restantes eram padrões reais e distintos, cada um resolvido por guarda própria
(ver D7).

## D7 — Em nomenclatura química, um token inteiro trocado é outra substância

As 12 travessias que sobreviveram à separação de D6 tinham todas a mesma
forma: um token do nome trocado por outro, à distância de edição 1 ou 2, com
estatuto regulamentar oposto.

    CADMIUM CARBONATE  ⟷ CALCIUM CARBONATE    o catião
    SODIUM SORBATE     ⟷ SODIUM BORATE        o anião: conservante vs reprotóxico
    BENZOPHENONE       ⟷ BENZOPHENONE 3       proibida vs filtro UV autorizado
    4-NITRO-M-PHENYL…  ⟷ 4-NITRO-O-PHENYL…    isómeros meta e orto

Regra adotada: se dois nomes diferem em exatamente um token, ou num token
inteiro a mais, são substâncias diferentes e não se sugerem um pelo outro.
Única exceção: quando um token é prefixo do outro, que é a assinatura de um
truncamento — SULFAT/SULFATE é gralha, SORBATE/BORATE não é.

O caminho do OCR ficou com guardas próprias, mais permissivas, porque aí o
caractere corrompido está tipicamente no meio de uma palavra e não há relação
de prefixo. O que o trava é o requisito de acerto exato único.

**Custo aceite:** perdem-se sugestões para gralhas dentro de um anião. É o
custo certo — um "por identificar" é honesto, um alerta de borato num rótulo
que diz sorbato é uma mentira com aspeto de facto regulamentar.

---

## D8 — Um facto encontrado vence sempre a incerteza sobre o que ficou por ler

Quatro rótulos reais expuseram o pior modo de falha desta app, e duas
tentativas erradas de o corrigir.

**O problema.** Metade dos rótulos vendidos em Portugal traz a lista de
ingredientes traduzida, apesar de o art. 19.º do Reg. 1223/2009 exigir
nomenclatura INCI. Nessas listas o motor reconhecia zero entradas, encontrava
zero alertas e devolvia índice 100 — indistinguível de um produto
genuinamente limpo. Silêncio apresentado como segurança.

**Primeira tentativa, errada.** Recusar avaliar quando a taxa de
correspondência é baixa. Reprovava um gel de banho inglês com 4 entradas
reguladas em 18 — quando "a maioria dos ingredientes não é regulada" é o caso
normal de qualquer rótulo, e o resultado estava certo.

**Segunda tentativa, errada.** Medir a forma da lista em vez da taxa —
correto — mas deixar isso calar o veredicto. Numa lista traduzida onde se
encontrou hidroquinona (proibida, Anexo II), a app dizia "não foi possível
avaliar". Esconder um achado é pior do que o problema original.

**Regra final.** Três coisas separadas:
- **O veredicto** é sempre factual. Só diz "não foi possível avaliar" quando
  não há literalmente nada encontrado.
- **O índice** desaparece sempre que a lista está traduzida, mesmo havendo
  achados: com parte das entradas por ler, o número só pode ser um limite
  superior, e apresentar um limite superior como medição é o erro a evitar.
- **O aviso** de que a lista parece traduzida aparece sempre que for o caso.

## D9 — Tradução PT→INCI, com a regra que a torna segura

Léxico curado de nomes químicos, mais uma regra estrutural para nomes
botânicos ("óleo da semente de X" → X SEED OIL). A tradução fica visível na
interface, porque é um passo a mais entre o rótulo e o veredicto.

**A regra que a torna segura:** uma tradução só vale se produzir um nome que
EXISTE no índice. Uma tradução errada não encontra nada e a entrada fica "por
identificar". Traduzir mal nunca gera um alerta — no pior caso não gera nada.

Curadoria explícita, não heurística, nos pares que não se podem confundir:
esqualeno/esqualano, sulfito/sulfato.

## D10 — Duas correções que os rótulos reais obrigaram

**Combinações declaradas com "(AND)".** O Anexo V, entrada 59, é
"CITRIC ACID (AND) SILVER CITRATE" — um conservante à base de prata. Separado
em dois, o ácido cítrico passava a arrastar a restrição de prata, e o ácido
cítrico é regulador de pH em quase todos os cosméticos que existem. A
restrição de uma combinação aplica-se ao conjunto. A entrada lista o CAS de
cada componente, por isso a ponte por CAS também tem de a ignorar.

**Nomes de declaração obrigatória escondidos nas condições.** Dezasseis
entradas do Anexo III dizem, no texto das condições, que a presença "shall be
indicated as 'X'" — e X é o nome que aparece no frasco, não o do glossário.
São todas óleos essenciais e alergénios de fragrância: Citrus Aurantium Peel
Oil, Eucalyptus Globulus Oil, Eugenia Caryophyllus Oil, Cananga Odorata
Oil/Extract, Myroxylon Pereirae, Rose Ketones, Citral. Ou seja, exatamente o
vocabulário dos rótulos de cosmética natural.

---

## D11 — Nem toda a proibição do Anexo II é uma proibição

Analisar 44 produtos reais de farmácia e supermercado deu "PROIBIDO" ao CeraVe,
ao Aveeno e à vaselina do Couto. Era falso, e a causa está no próprio texto da
lei.

**58 das 1758 entradas do Anexo II (3,3%) trazem uma cláusula de exceção
dentro do nome da substância.** E são de duas naturezas que não se podem
confundir:

**47 são condições de proveniência da matéria-prima.** A entrada 904 é
literalmente "Petrolatum, *except if the full refining history is known and it
can be shown that the substance from which it is produced is not a
carcinogen*". A exceção não é a raridade — é a via legal normal, e é dela que
depende toda a vaselina refinada em uso na Europa. Um produto no mercado
presume-se conforme, e quem tem de documentar a condição é o fabricante.
Tratá-las como proibição condenaria metade da prateleira da farmácia.

**11 são remissões para um uso estreito autorizado noutro anexo.** A
hidroquinona é proibida "*with the exception of entry 14 in Annex III*" — que
são 0,02% em unhas artificiais de uso profissional. Num creme de corpo isso
não é exceção nenhuma: é proibido e ponto final. Tratá-las como condicionais
absolveria uma substância genuinamente banida para o uso em causa.

Consequências no modelo: contagem própria para condicionais, o índice deixa de
travar em 25 por causa delas, e **a classificação CMR de uma entrada
condicional não é arrastada** — o "Carcinogenic Cat. 1B" da entrada 904
descreve a vaselina mal refinada, não a que está no frasco, e arrastá-lo dava
"cancerígeno" a um creme de farmácia.

## D12 — Separadores de lista que não são a vírgula

A Uriage publica as listas INCI separadas por travessões. O segmentador só
conhecia vírgulas, e por isso uma lista de 37 ingredientes virava UMA entrada,
que depois não correspondia a nada e passava por "por identificar" — um
produto inteiro invisível à análise, em silêncio.

Só se separa em travessão rodeado de espaços: o hífen dentro de um nome
(PEG-100, C10-30, Coco-Caprylate) nunca os tem, e parti-lo destruiria o nome.

---

## D13 — Filtros de exclusão são uma camada à parte dos anexos

Passámos seis rondas a não acertar no que "clean" queria dizer, porque eu
estava a inventar a definição em vez de a pedir. Resolveu-se quando ela mandou
a lista que usa: "Ingredients to Avoid — Beauty & Personal Care",
@morganlkeen, atualizada 4 out 2025 (cópia em `data/filtros/`).

Está codificada em `packages/core/src/filtros.ts` como 47 regras, transcritas
verbatim do PDF, incluindo as quatro condicionais que o documento marca com
visto: fenoxietanol, cocamidopropil betaína, fragrância e dióxido de titânio.

**A separação que importa:** um filtro destes NÃO é um anexo. Os anexos são
lei; um filtro é uma preferência, e o próprio documento se declara como
"based on my personal research and preferences". Um ingrediente excluído por
filtro nunca entra nas contagens regulamentares nem no veredicto factual —
aparece em secção própria, com o nome do filtro à vista. O modelo tem três
camadas e não duas: facto regulamentar, leitura editorial (D4), filtro de
preferência.

Bug encontrado ao aplicá-lo: o segmentador do filtro não conhecia o ponto
médio "•", que a Rilastil usa como separador. A lista inteira virava uma
entrada. É o mesmo bug de D12 noutro sítio — valeu a pena procurar os dois
sítios onde a segmentação existia.
