# Lupa de Rótulos

Cola a lista de ingredientes de um cosmético e vê **o que a lei diz sobre cada
um** — anexo, número de entrada, limite de concentração, âmbito e advertência
obrigatória, com o texto legal copiado tal como publicado e a data de
extração de cada afirmação.

Por cima disso, uma segunda camada visivelmente separada: o **teu filtro de
preferência**, que exclui o que tu decidiste excluir. As duas camadas nunca se
misturam, porque uma é lei e a outra é escolha.

Fontes: Anexos II a VI do Reg. (CE) 1223/2009, via [CosIng](https://ec.europa.eu/growth/tools-databases/cosing/)
(Comissão Europeia, CC BY 4.0), com uma ponte de sinónimos do PubChem (NCBI,
domínio público) para tornar alcançáveis 64% das substâncias proibidas pelo
nome que está no rótulo.

## Correr

```bash
pnpm install
pnpm ingest        # descarrega os anexos do CosIng e constrói o núcleo (~30 s)
pnpm dev           # API em :8787 e frontend em :5178, Ctrl+C mata os dois
```

`pnpm test` corre a suite de regressão. `pnpm portas` diz o que está de pé.

A ponte do PubChem é opcional: se `data/raw/CID-Synonym-filtered.gz` existir
(924 MB, [daqui](https://ftp.ncbi.nlm.nih.gov/pubchem/Compound/Extras/)), a
ingestão usa-a; senão o núcleo fica só com o CosIng, correto mas com menos
alcance.

## Estrutura

```
packages/core     motor puro em TypeScript: normalizador, matcher, análise,
                  tradução PT→INCI, filtros — partilhado por tudo o resto
packages/ingest   descarrega, verifica e transforma as fontes num núcleo
apps/api          Fastify; serve a análise, não regista corpos de pedidos
apps/web          Angular 20, standalone + signals + zoneless
tests             71 testes, incluindo um invariante gerado do corpus
docs/DECISOES.md  as decisões, com o porquê e o custo aceite de cada uma
```

## O que interessa ler primeiro

**[docs/DECISOES.md](docs/DECISOES.md)** — dezassete decisões, várias
descobertas a analisar rótulos reais e não a olhar para o código: a vaselina
que não está proibida (D11), o ácido cítrico que herdava uma restrição de
prata (D10), os 610 pares de nomes que a distância de edição confundia (D6).

**[tests/matcher.test.ts](tests/matcher.test.ts)** — o invariante que impede
a app de mentir. Gera do corpus todos os pares de nomes a distância ≤2 com
estatuto regulamentar divergente (2060 hoje) e garante que a sugestão nunca
atravessa nenhum. Cresce sozinho a cada ingestão.

**[packages/ingest/src/cosing.ts](packages/ingest/src/cosing.ts)** — os cinco
asserts de contrato, e a razão de existirem: todos os caminhos sob o site do
CosIng devolvem HTTP 200 com o shell de uma SPA, incluindo caminhos inventados.

## Deploy

A app está no ar em **https://barbaramperes.github.io/lupa/** — o build
estático, que corre **sem servidor**: o motor é código puro e o núcleo é
servido como ficheiro. Publica-se com um comando:

```bash
pnpm publicar
```

O script constrói, envia para o branch `gh-pages`, pede o build do Pages e
**verifica que o bundle servido é o que acabou de construir** — um HTTP 200
não chega, porque o Pages reconstrói o conteúdo anterior com ar de sucesso.

Há também um workflow de GitHub Actions (`.github/workflows/pages.yml`), de
disparo manual, para quando os runners estiverem disponíveis; nesta conta
não estão, e o script não precisa deles.

## Três coisas que a app faz de propósito

**Três estados, nunca dois.** Reconhecido, sugestão, por identificar. Um
ingrediente por identificar não é apresentado como seguro.

**Só a correspondência exata produz veredicto.** A aproximada sugere, e nunca
atravessa um par com estatuto regulamentar divergente — `SODIUM SORBATE` não
vira `SODIUM BORATE` por estar a uma letra de distância.

**Um facto vence a incerteza.** Se a lista está em português e o motor só
percebeu metade, mas nessa metade há uma substância proibida, reporta-a. O
que desaparece é o índice, que com metade por ler seria só um limite superior.

## Licenças dos dados

`data/SOURCES.yml` é o manifesto. A ingestão recusa escrever no núcleo
qualquer registo cuja fonte esteja marcada como não redistribuível. IARC, ECHA
e IFRA ficaram de fora por licença — ligam-se, não se copiam.

Não é aconselhamento médico. O CosIng tem valor informativo e não legal, e
esta aplicação não é oficial nem tem aval da Comissão Europeia.
