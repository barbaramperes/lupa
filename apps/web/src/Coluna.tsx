import type { Analise } from './api';
import type { Entrada } from '../../../packages/core/src/analisar';

const ANEXO_ROTULO: Record<string, string> = {
  annex_ii_banned: 'Proibido na UE',
  annex_iii_restricted: 'Permitido com limites',
  annex_iv_colorant: 'Corante autorizado',
  annex_v_preservative: 'Conservante autorizado',
  annex_vi_uv_filter: 'Filtro UV autorizado',
};
const ANEXO_NUM: Record<string, string> = {
  annex_ii_banned: 'II', annex_iii_restricted: 'III', annex_iv_colorant: 'IV',
  annex_v_preservative: 'V', annex_vi_uv_filter: 'VI',
};
const CMR_ROTULO: Record<string, string> = {
  reprotoxico: 'Reprotóxico', carcinogenico: 'Cancerígeno', mutagenico: 'Mutagénico',
};

/** As células do CosIng trazem linhas em branco duplicadas entre alíneas.
 *  Colapsá-las é formatação de apresentação; o texto em si não é alterado. */
const limpar = (t: string) => t.replace(/\n{2,}/g, '\n').trim();

function classeDaRisca(e: Entrada): string {
  if (e.afirmacoes.some((a) => a.kind === 'annex_ii_banned')) return 'proibido';
  if (e.cmr.length) return 'cmr';
  if (e.afirmacoes.length) return 'limites';
  return 'nenhum';
}

function LinhaEntrada({ e, realcarRepr }: { e: Entrada; realcarRepr: boolean }) {
  const temRepr = e.cmr.some((c) => c.tipo === 'reprotoxico');
  return (
    <article
      className={`ent${realcarRepr && temRepr ? ' realce' : ''}`}
      data-estado={e.estado}
      data-tem={classeDaRisca(e)}
      data-repr={realcarRepr && temRepr ? '1' : '0'}
    >
      <div className="risca" />
      <div className="corpo">
        <div className="l1">
          <span className="pos">{e.pos}</span>
          <span className="nome">{e.raw}</span>
          {e.estado === 'por_identificar' && (
            <span className="marcas"><span className="marca-p aberto">Por identificar</span>
              {e.condicional && <span className="marca-p aberto">Pode conter</span>}
              {e.no_blend && <span className="marca-p blend">Matéria-prima composta</span>}
            </span>
          )}
        </div>

        {e.traduzido_de && (
          <span className="traduzido">
            Traduzido de «{e.traduzido_de.original}» para <b>{e.traduzido_de.inci}</b>
            {e.traduzido_de.via === 'botanica' ? ' (regra botânica)' : ' (léxico)'}
          </span>
        )}
        {e.estado !== 'por_identificar' && <div className="marcas">
          {e.afirmacoes.some((a) => a.kind === 'annex_ii_banned') && <span className="marca-p proibido">Proibido na UE</span>}
          {[...new Set(e.afirmacoes.filter((a) => a.kind !== 'annex_ii_banned').map((a) => a.kind))].map((k) => (
            <span key={k} className="marca-p limites">{ANEXO_ROTULO[k]}</span>
          ))}
          {e.cmr.map((c, i) => (
            <span key={i} className={`marca-p ${c.tipo}`}>
              {CMR_ROTULO[c.tipo]} cat. {c.categoria}
              {c.condicao ? ` (${c.condicao})` : ''}
            </span>
          ))}
          {e.condicional && <span className="marca-p aberto">Pode conter</span>}
          {e.no_blend && <span className="marca-p blend">Matéria-prima composta</span>}
        </div>}

        {e.afirmacoes.map((a, i) => (
          <div className="afirmacao" key={i}>
            <span className="cabeca">
              {ANEXO_ROTULO[a.kind]} · Anexo {ANEXO_NUM[a.kind]}, entrada {a.payload.reference_number}
            </span>
            {a.payload.concentracao_maxima && (
              <dl><dt>máx.</dt><dd>{limpar(a.payload.concentracao_maxima)}</dd></dl>
            )}
            {(a.payload.tipo_produto || a.payload.outros || a.payload.advertencias) && (
              <details className="condicoes">
                <summary>Condições completas, tal como publicadas</summary>
                <dl>
                  {a.payload.tipo_produto && (<><dt>âmbito</dt><dd>{limpar(a.payload.tipo_produto)}</dd></>)}
                  {a.payload.outros && (<><dt>outras</dt><dd>{limpar(a.payload.outros)}</dd></>)}
                  {a.payload.advertencias && (<><dt>rótulo</dt><dd>{limpar(a.payload.advertencias)}</dd></>)}
                </dl>
              </details>
            )}
            <span className="proveniencia">
              Reg. (CE) 1223/2009, Anexo {ANEXO_NUM[a.kind]} · extraído {a.source.retrieved_at} · {a.source.licence}
            </span>
          </div>
        ))}

        {e.estado === 'sugestao' && e.sugestao && (
          <p className="nota-aberta">
            Não corresponde a nenhuma entrada. Quis dizer <b>{e.sugestao.candidato}</b>?{' '}
            {e.sugestao.via === 'ocr' ? 'Parece um erro de leitura de caracteres.' : 'Grafia próxima.'} Uma sugestão não é
            um veredicto e não entra nas contagens.
          </p>
        )}

      </div>
    </article>
  );
}

export function Coluna({
  ficha, unica, exemplos, realcarRepr, onAlterar, onRemover,
}: {
  ficha: { id: number; nome: string; texto: string; analise: Analise | null; erro: string | null; ocupado: boolean };
  unica: boolean;
  exemplos: Array<[string, string]>;
  realcarRepr: boolean;
  onAlterar: (id: number, campo: 'nome' | 'texto', valor: string) => void;
  onRemover: (id: number) => void;
}) {
  const a = ficha.analise;
  return (
    <section>
      <div className="painel">
        <header>
          <input
            type="text"
            value={ficha.nome}
            placeholder="Nome do produto"
            aria-label="Nome do produto"
            onChange={(ev) => onAlterar(ficha.id, 'nome', ev.target.value)}
          />
          {!unica && <button className="fechar" onClick={() => onRemover(ficha.id)} aria-label="Remover">×</button>}
        </header>

        <textarea
          value={ficha.texto}
          spellCheck={false}
          aria-label="Lista de ingredientes"
          placeholder="Cola aqui a lista de ingredientes…"
          onChange={(ev) => onAlterar(ficha.id, 'texto', ev.target.value)}
        />

        <div className="rodape-painel">
          {exemplos.map(([nome, texto]) => (
            <button key={nome} className="fantasma" onClick={() => { onAlterar(ficha.id, 'nome', nome); onAlterar(ficha.id, 'texto', texto); }}>
              {nome}
            </button>
          ))}
          <span className="conta">{ficha.ocupado ? 'a analisar…' : a ? `${a.resumo.total} entradas` : ''}</span>
        </div>

        {ficha.erro && <p className="erro">{ficha.erro}</p>}

        {a && (
          <>
            <p className={`veredicto-factual${a.resumo.avaliavel ? '' : ' incerto'}`}>{a.resumo.veredicto}</p>
            {a.resumo.lista_traduzida && (
              <p className="aviso-cobertura">
                As minhas listas estão em nomenclatura INCI, e esta parece estar traduzida. Não é um resultado limpo — é um
                resultado em branco. O art. 19.º do Reg. 1223/2009 exige INCI na embalagem, por isso vale a pena procurar a
                lista original no frasco ou na página do fabricante.
              </p>
            )}
            <div className="contagens">
              <div className={a.resumo.proibidos ? 'destaque' : ''}><b>{a.resumo.proibidos}</b><span>proibidos</span></div>
              <div><b>{a.resumo.com_limites}</b><span>com limites</span></div>
              <div className={a.resumo.reprotoxicos ? 'repr' : ''}><b>{a.resumo.reprotoxicos}</b><span>reprotóxicos</span></div>
              <div className="aberto"><b>{a.resumo.por_identificar}</b><span>por identificar</span></div>
            </div>
            <div className="entradas">
              {a.entradas.map((e) => <LinhaEntrada key={e.pos} e={e} realcarRepr={realcarRepr} />)}
            </div>
            {a.resumo.por_identificar > 0 && (
              <p className="nota-rodape">
                <b>{a.resumo.por_identificar}</b> {a.resumo.por_identificar === 1 ? 'entrada não consta' : 'entradas não constam'} dos
                Anexos II a VI. Isso não quer dizer que {a.resumo.por_identificar === 1 ? 'seja segura' : 'sejam seguras'} — quer dizer
                que não {a.resumo.por_identificar === 1 ? 'é regulada' : 'são reguladas'} por eles. A maioria dos ingredientes de um
                rótulo é autorizada sem restrição e por isso não aparece em anexo nenhum.
              </p>
            )}
          </>
        )}
      </div>

      {a && (
        <div className="editorial">
          <span className="sobrancelha">Leitura editorial — não é um facto regulamentar</span>
          <div className="cabeca">
            <span className="indice">
              {a.editorial.indice ?? '—'}
              {a.editorial.indice !== null && <span className="den">/100</span>}
            </span>
            <span className="veredicto">{a.editorial.veredicto}</span>
          </div>
          {a.editorial.indice === null && (
            <p className="aviso">
              Sem índice: reconheci entradas a menos para que um número significasse alguma coisa. Preferir um traço a um
              número inventado é o ponto.
            </p>
          )}
          <p className="aviso">
            Este número é julgamento meu, não uma medição. Os anexos da UE classificam por <i>classe de perigo</i>, não por
            severidade — somá-los num índice é uma escolha, e é discutível. Os factos acima são verificáveis; isto é uma
            leitura deles.
          </p>
          <details>
            <summary>Como foi calculado</summary>
            <p style={{ marginTop: 6 }}>{a.editorial.formula}</p>
            <div style={{ marginTop: 8 }}>
              {a.editorial.penalizacoes.map((p, i) => (
                <div className="pen" key={i}>
                  <span>{p.entrada} — {p.motivo}</span>
                  <b>−{p.pontos}</b>
                </div>
              ))}
              {!a.editorial.penalizacoes.length && <p>Nenhuma penalização: nada nesta lista consta dos anexos com restrição.</p>}
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
