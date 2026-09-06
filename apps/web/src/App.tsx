import { useEffect, useState, useCallback, useRef } from 'react';
import { analisar, saude, type Analise } from './api';
import { Coluna } from './Coluna';

const EXEMPLOS: Array<[string, string]> = [
  ['Esfoliante orgânico', 'Sucrose*, Coco Glucoside*, Guava Seed Oil*, Mango Seed Oil*, Glycerine*, Benzyl Alcohol*, Salicylic Acid*, Glycerin, and Sorbic Acid*, Orange Sweet Essential Oil*, Tocopherol*'],
  ['Protetor solar', 'Aqua, Homosalate, Ethylhexyl Salicylate, Butyl Methoxydibenzoylmethane, Octocrylene, Benzophenone-3, Glycerin, Alcohol Denat., Dimethicone, Phenoxyethanol, Parfum, Tocopheryl Acetate, Limonene, Linalool'],
  ['Coloração capilar', 'Aqua, Cetearyl Alcohol, Propylene Glycol, Ammonium Hydroxide, p-Phenylenediamine, Resorcinol, m-Aminophenol, Sodium Sulfite, Parfum, Toluene-2,5-Diamine'],
];

interface Ficha { id: number; nome: string; texto: string; analise: Analise | null; erro: string | null; ocupado: boolean }

let proximoId = 1;
const novaFicha = (nome = '', texto = ''): Ficha => ({ id: proximoId++, nome, texto, analise: null, erro: null, ocupado: false });

export function App() {
  const [fichas, setFichas] = useState<Ficha[]>([novaFicha('Esfoliante orgânico', EXEMPLOS[0]![1])]);
  const [realcarRepr, setRealcarRepr] = useState(false);
  const [info, setInfo] = useState<{ construido_em: string; substancias: number; afirmacoes: number } | null>(null);
  const [tema, setTema] = useState<'auto' | 'claro' | 'escuro'>('auto');
  const temporizadores = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => { saude().then((s) => setInfo(s.nucleo)).catch(() => {}); }, []);
  useEffect(() => {
    if (tema === 'auto') document.documentElement.removeAttribute('data-tema');
    else document.documentElement.setAttribute('data-tema', tema);
  }, [tema]);

  const correr = useCallback((id: number, texto: string) => {
    clearTimeout(temporizadores.current[id]);
    if (!texto.trim()) {
      setFichas((f) => f.map((x) => (x.id === id ? { ...x, analise: null, erro: null, ocupado: false } : x)));
      return;
    }
    setFichas((f) => f.map((x) => (x.id === id ? { ...x, ocupado: true } : x)));
    temporizadores.current[id] = setTimeout(() => {
      analisar(texto)
        .then((a) => setFichas((f) => f.map((x) => (x.id === id ? { ...x, analise: a, erro: null, ocupado: false } : x))))
        .catch((e: Error) => setFichas((f) => f.map((x) => (x.id === id ? { ...x, erro: e.message, ocupado: false } : x))));
    }, 260);
  }, []);

  useEffect(() => { const f = fichas[0]; if (f && f.texto && !f.analise) correr(f.id, f.texto); }, []);

  const alterar = (id: number, campo: 'nome' | 'texto', valor: string) => {
    setFichas((f) => f.map((x) => (x.id === id ? { ...x, [campo]: valor } : x)));
    if (campo === 'texto') correr(id, valor);
  };

  const acrescentar = () => setFichas((f) => (f.length >= 3 ? f : [...f, novaFicha()]));
  const remover = (id: number) => setFichas((f) => (f.length <= 1 ? f : f.filter((x) => x.id !== id)));

  return (
    <div className="casca">
      <header className="topo">
        <div className="marca">
          <span className="sobrancelha">Anexos II a VI do Reg. (CE) 1223/2009</span>
          <h1>Lupa de Rótulos</h1>
          <p className="sub">O que a lei diz sobre cada ingrediente do rótulo, com a fonte de cada afirmação.</p>
        </div>
        <div className="comandos">
          <button
            className="alternar"
            aria-pressed={realcarRepr}
            onClick={() => setRealcarRepr((v) => !v)}
            title="Realça as substâncias com classificação harmonizada de toxicidade reprodutiva (Repr. 1A, 1B ou 2). É um critério público e fixo, igual para toda a gente."
          >
            <span className="ponto" />
            Realçar reprotóxicos
          </button>
          {fichas.length < 3 && (
            <button className="fantasma" onClick={acrescentar}>+ Comparar outro</button>
          )}
          <button className="fantasma" onClick={() => setTema((t) => (t === 'auto' ? 'claro' : t === 'claro' ? 'escuro' : 'auto'))}>
            Tema: {tema}
          </button>
        </div>
      </header>

      <div className="colunas" data-n={fichas.length}>
        {fichas.map((f, i) => (
          <Coluna
            key={f.id}
            ficha={f}
            unica={fichas.length === 1}
            exemplos={i === 0 ? EXEMPLOS : []}
            realcarRepr={realcarRepr}
            onAlterar={alterar}
            onRemover={remover}
          />
        ))}
      </div>

      <footer className="rodape">
        <p>
          <b>O que isto faz.</b> Procura cada entrada do rótulo nos Anexos II a VI do Regulamento (CE) 1223/2009 e mostra o
          que lá está escrito, com o anexo, o número de referência e a data de extração. Não interpreta, não aconselha e
          não substitui um médico ou farmacêutico.
        </p>
        <p>
          <b>Três estados, nunca dois.</b> Reconhecido, sugestão e por identificar. Uma entrada por identificar não é uma
          entrada segura — é uma que não consta das listas usadas. A ausência de alertas não é prova de segurança.
        </p>
        <p>
          <b>Fonte.</b> CosIng, base de dados de ingredientes cosméticos da Comissão Europeia, sob CC BY 4.0 nos termos da
          Decisão 2011/833/UE.{' '}
          {info && (
            <span className="mono">
              Núcleo de {info.construido_em} · {info.substancias.toLocaleString('pt-PT')} substâncias ·{' '}
              {info.afirmacoes.toLocaleString('pt-PT')} afirmações.
            </span>
          )}{' '}
          O CosIng tem valor informativo e não valor legal, e esta aplicação não é oficial nem tem aval da Comissão.
        </p>
      </footer>
    </div>
  );
}
