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

---

## D14 — Frontend em Angular

**Decidido por:** Bárbara, 24 set 2026. A razão é de carreira, não técnica:
precisa de projetos que comprovem Angular, e o frontend era React.

Angular **20.3.32**, e não o 22, por uma restrição concreta: o Angular 22 exige
Node ≥22.22.3 e a máquina tem 22.12.0, instalado pelo instalador oficial em
`/usr/local/bin`. Atualizar o Node exige palavra-passe e é uma alteração ao
sistema dela — não se faz por iniciativa própria. O Angular 20 declara
`^22.12.0` nos engines e tem tudo o que interessa demonstrar.

**O que a migração usa, e é de propósito:**
- componentes *standalone*, sem NgModules
- estado em **signals** (`signal`, `computed`, `input()`, `output()`)
- **zoneless** (`provideZonelessChangeDetection`): sem zone.js, sem
  monkey-patch das APIs do browser, deteção de alterações como consequência do
  grafo de signals
- control flow novo (`@if`, `@for`, `@empty`) em vez das diretivas estruturais
- `ChangeDetectionStrategy.OnPush` em todos os componentes
- `strictTemplates` ligado — apanhou logo um erro real: `source.annex` e
  `payload.reference_number` são opcionais e estavam a ser usados como chave
  de `track`

**Bundle de produção: 183,8 kB em bruto, 53,7 kB transferidos.**

Os tipos continuam a vir de `packages/core`. Não há cópia do modelo no
frontend: a mesma definição serve a API, a suite de testes e o ecrã.

---

## D15 — O filtro no ecrã, em camada visivelmente distinta

O filtro existia em `packages/core` com testes desde D13, mas nunca chegou ao
ecrã — estava escrito e não estava ligado. Agora está, e o desenho é tão
importante como a funcionalidade.

**Na API:** o filtro viaja num campo de topo (`filtro`), nunca dentro de
`resumo`. Misturá-los na mesma estrutura convidaria qualquer interface — esta
ou outra — a apresentá-los com o mesmo peso.

**No ecrã:** bloco próprio, borda tracejada em vez de contínua, cor própria,
com o nome do filtro, o autor, e o aviso da natureza sempre visível. As
contagens regulamentares acima não mudam quando o filtro liga. Cada entrada
apanhada leva uma marca tracejada — "Fora do teu filtro" ou "Condicional no
teu filtro" — para se ver em contexto, porque a posição na lista carrega
informação.

**Junção por nome e não por posição.** O filtro e o segmentador de rótulos
partem a lista com regras diferentes: o segmentador respeita parênteses
(`AQUA (WATER)` é um item), o filtro não. As posições podem divergir, e o
nome é a única chave estável entre os dois.

---

## D16 — O repositório sai de ~/Downloads

**Decidido por:** Bárbara, 24 set 2026, depois de o problema a bloquear quatro
vezes seguidas.

`~/Downloads` é uma pasta protegida pelo TCC do macOS. Uma aplicação sem
autorização explícita consegue fazer `chdir()` para lá mas não consegue ler a
pasta, e qualquer processo Node lançado a partir dali rebenta logo no arranque:

    Error: EPERM: operation not permitted, uv_cwd
        at process.wrappedCwd (...does_own_process_state:142:28)

A assinatura é característica e vale a pena reconhecê-la: o `cd` **não** dá
erro, falha o `process.cwd()` do processo filho. Não é o comando que está
errado.

Contorno que funciona sem permissão nenhuma, para quem ficar preso nisto:
arrancar a partir da home com caminhos absolutos, para o `cwd` passar a ser
`~` em vez da pasta protegida. Serve para a API; não serve para o `ng serve`,
que procura o `angular.json` subindo a partir da pasta atual.

O repositório está agora em `~/Projetos/lupa-rotulos`. Nenhum caminho absoluto
estava escrito dentro do repo, por isso a mudança não lhe tocou.

---

## D17 — Segundo alvo de build: estático, sem servidor

Não substitui D1. É o mesmo código com o núcleo a vir de outro sítio.

O motor de `packages/core` é código puro: o `analisar()` que a API executa
corre no browser sem uma linha de diferença. A única coisa que muda é a
origem do núcleo — um pedido à API, ou um ficheiro servido ao lado da app.
`fileReplacements` no `angular.json` troca o `environment` e o serviço
escolhe o caminho.

Existe por uma razão prática: **deploy sem infraestrutura.** Um projeto de
portefólio precisa de um URL, e um URL não pode depender de alguém ter a API
a correr na sua máquina.

Números: shell de 190 kB (55 kB transferidos), com o motor em chunks
carregados a pedido (`analisar` 9,9 kB, `filtros` 5,7 kB, `match` 3,0 kB).
O núcleo são 13,8 MB em bruto, ~2 MB comprimidos pelo servidor. A interface
tem um sinal de carregamento próprio, porque 2 MB não são instantâneos e uma
aplicação que parece bloqueada é pior do que uma que diz que está a carregar.

`baseHref: './'` para funcionar tanto sob `/nome-do-repo/` no GitHub Pages
como na raiz de qualquer outro alojamento, sem reconstruir.

Verificado com a API desligada: veredicto, contagens e filtro corretos, zero
erros de consola.

---

## D18 — Redesign do frontend: o veredicto é o hero

**Motivo:** ela viu-o a 1440px em modo claro e disse "péssimo". Tinha razão.
Um formulário encostado à esquerda com um terço do ecrã vazio, letra de
10–12px em tudo, o veredicto — a coisa mais importante — numa linha de 15px
num painel cinzento, e oito linhas de "por identificar" antes de aparecer
alguma coisa que interessasse. A intenção era "ficha de segurança"; o
resultado era "ferramenta interna de 2008".

**O que mudou, e porquê cada coisa:**
- **Duas colunas para um produto**: rótulo à esquerda, fixo ao scroll;
  resultado à direita. Pergunta e resposta lado a lado, sem espaço morto.
  Com dois ou três produtos volta a uma coluna por produto.
- **O veredicto a 27px em serifa, as contagens a 34px.** É o que se vê
  primeiro, porque é o que se veio ver.
- **Reconhecidas primeiro, por identificar numa linha de chips no fim.** A
  posição fica visível em cada uma — em INCI a ordem é informação — mas
  deixam de ser oito linhas vazias antes da primeira que interessa.
- **Escala tipográfica: nada abaixo de 12px, corpo a 16.**
- **O índice editorial ganha um anel.** Continua rotulado como leitura minha
  e não facto; passa a ser um momento visual em vez de um número perdido.

**O que não mudou:** a separação entre facto regulamentar, leitura editorial
e filtro de preferência (D4, D13, D15). O redesign tornou-a mais visível, não
menos — o filtro continua em bloco tracejado, o editorial fora do painel dos
factos.

---

## D19 — O que a tua lista apanha não fica escondido

**Descoberto com um tónico coreano colado por ela**, 25 set 2026: Houttuynia
Cordata a 70%, 28 ingredientes, **nenhum regulado pelos anexos**. A app disse
"Nenhuma entrada consta dos anexos II a VI", 100/100, e meteu os 28 numa fila
de chips cinzentos. Ela leu isso como "não respondeu" — e tinha razão.

Com o filtro ligado, o produto **chumba na lista dela**: Carbomer (#20) e
Disodium EDTA (#24). Mas como nenhum dos dois é regulado, o redesign de D18
tinha-os posto na fila dos "por identificar" — respondia à pergunta da lei e
escondia a dela.

**Regra nova:** uma entrada tem linha própria se a lei diz alguma coisa dela
**ou** se o filtro a apanha. A contagem regulamentar não muda (continuam a
ser 28 por identificar, porque é verdade), e a fila de chips diz porque tem
menos.

**E quando a lei não diz nada e o filtro está desligado**, um aviso aponta
para ele — "a lei não restringe nada nesta lista, o que é comum; as tuas
perguntas são outras". O filtro fica lembrado entre visitas.

**Três bugs que o mesmo rótulo expôs:**
- `1,2-Hexanediol` virava `2-Hexanediol`: a vírgula entre dígitos é um
  locante químico, não um separador. O "1" sozinho era descartado por curto.
- `(70%)` deixava `()` no nome. A percentagem passa a sair inteira — e a ser
  **guardada**, porque é a única concentração real que um rótulo dá.
- O nome do exemplo ("Esfoliante orgânico") ficava agarrado a um produto
  colado por cima.

**E a causa de fundo de metade dos bugs de separação:** havia dois
segmentadores. O filtro usava o seu, com regras diferentes, e cada correção —
travessões (D12), pontos médios, agora locantes — tinha de ser feita duas
vezes. O filtro passou a usar o mesmo `segment()` da análise; as posições
coincidem e a interface junta as camadas por posição, não por nome.
