import React from 'react';
import { Card } from '@/ui/Card';
import { Badge } from '@/ui/Badge';

export const RPG_TITLE_STYLE: React.CSSProperties = {
  fontFamily: "'Cinzel', Georgia, 'Times New Roman', serif",
};

/* =========================================================================
   1. MOLDURA PERGAMINHO
   ========================================================================= */

export type VarianteMoldura = 'default' | 'destaque' | 'nevoa' | 'erro';

export interface MolduraPergaminhoProps extends React.HTMLAttributes<HTMLDivElement> {
  titulo?: React.ReactNode;
  subtitulo?: React.ReactNode;
  selo?: React.ReactNode;
  variante?: VarianteMoldura;
  children: React.ReactNode;
}

const VARIANTE_CLASSES: Record<VarianteMoldura, string> = {
  default: 'border-amber-900/80 bg-stone-900/95 text-stone-200',
  destaque: 'border-amber-600 bg-stone-900/95 text-stone-200 ring-1 ring-amber-500/30',
  nevoa: 'border-purple-500 bg-purple-950/30 text-stone-200',
  erro: 'border-rose-700 bg-rose-950/30 text-stone-200',
};

export const MolduraPergaminho: React.FC<MolduraPergaminhoProps> = ({
  titulo,
  subtitulo,
  selo,
  variante = 'default',
  children,
  className = '',
  ...props
}) => {
  const borderClass = VARIANTE_CLASSES[variante] || VARIANTE_CLASSES.default;

  return (
    <Card
      className={`relative border rounded-lg p-3 sm:p-4 transition-all shadow-xl ${borderClass} ${className}`}
      {...props}
    >
      {/* Cantoneiras ornamentais discretas (hidden md:block — colapsam em 360 px) */}
      <span
        className="hidden md:block absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-500/70 pointer-events-none"
        aria-hidden="true"
      />
      <span
        className="hidden md:block absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-amber-500/70 pointer-events-none"
        aria-hidden="true"
      />
      <span
        className="hidden md:block absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-amber-500/70 pointer-events-none"
        aria-hidden="true"
      />
      <span
        className="hidden md:block absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-amber-500/70 pointer-events-none"
        aria-hidden="true"
      />

      {/* Cabeçalho opcional */}
      {(titulo || selo || subtitulo) && (
        <div className="flex items-start justify-between gap-2 border-b border-amber-900/40 pb-2.5 mb-3">
          <div className="min-w-0 flex-1">
            {titulo && (
              <h2
                style={RPG_TITLE_STYLE}
                className="text-amber-100 uppercase tracking-wide text-sm sm:text-base font-semibold break-words"
              >
                {titulo}
              </h2>
            )}
            {subtitulo && (
              <p className="text-xs text-stone-400 font-sans mt-0.5 break-words">
                {subtitulo}
              </p>
            )}
          </div>
          {selo && <div className="flex-shrink-0">{selo}</div>}
        </div>
      )}

      {/* Conteúdo */}
      <div className="min-w-0">{children}</div>
    </Card>
  );
};

/* =========================================================================
   2. SELO DE ESTADO (SEMÂNTICO & ACESSÍVEL: ÍCONE + RÓTULO)
   ========================================================================= */

export type TipoEstadoRPG = 'em_dia' | 'atencao' | 'defasado' | 'desconhecido' | 'erro';

export interface SeloEstadoProps {
  estado: TipoEstadoRPG;
  rotulo?: string;
  className?: string;
}

const ESTADO_CONFIG: Record<
  TipoEstadoRPG,
  { simbolo: string; rotuloPadrao: string; classes: string }
> = {
  em_dia: {
    simbolo: '✓',
    rotuloPadrao: 'Em dia',
    classes: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/60',
  },
  atencao: {
    simbolo: '!',
    rotuloPadrao: 'Atenção',
    classes: 'text-amber-200 border-amber-500/50 bg-amber-950/60',
  },
  defasado: {
    simbolo: '!',
    rotuloPadrao: 'Defasado',
    classes: 'text-amber-200 border-amber-500/50 bg-amber-950/60',
  },
  desconhecido: {
    simbolo: '?',
    rotuloPadrao: 'desconhecido',
    classes: 'text-purple-200 border-purple-500 bg-purple-950/60',
  },
  erro: {
    simbolo: '✕',
    rotuloPadrao: 'Erro',
    classes: 'text-rose-200 border-rose-500 bg-rose-950/60',
  },
};

export const SeloEstado: React.FC<SeloEstadoProps> = ({
  estado,
  rotulo,
  className = '',
}) => {
  const conf = ESTADO_CONFIG[estado] || ESTADO_CONFIG.desconhecido;
  const texto = rotulo || conf.rotuloPadrao;

  return (
    <Badge
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium border rounded font-mono shadow-sm ${conf.classes} ${className}`}
      role="status"
    >
      <span className="font-bold select-none" aria-hidden="true">
        {conf.simbolo}
      </span>
      <span>{texto}</span>
    </Badge>
  );
};

/* =========================================================================
   3. MARCO DA JORNADA (STEPPER ACESSÍVEL DAS 6 ESTAÇÕES + EXTRAS)
   ========================================================================= */

export type EstacaoJornada =
  | 'pedido'
  | 'ordem'
  | 'execucao'
  | 'conferencia'
  | 'revisao'
  | 'decisao'
  | 'encerrada'
  | 'desconhecida';

export interface MarcoJornadaProps {
  estacaoAtual?: EstacaoJornada | string | null;
  className?: string;
}

const ESTACOES_ORDENADAS: Array<{ id: EstacaoJornada; rotulo: string; icone: string }> = [
  { id: 'pedido', rotulo: 'Pedido', icone: '📜' },
  { id: 'ordem', rotulo: 'Ordem', icone: '🖋️' },
  { id: 'execucao', rotulo: 'Execução', icone: '⚔️' },
  { id: 'conferencia', rotulo: 'Conferência', icone: '🔍' },
  { id: 'revisao', rotulo: 'Revisão', icone: '🛡️' },
  { id: 'decisao', rotulo: 'Decisão', icone: '👑' },
];

export const MarcoJornada: React.FC<MarcoJornadaProps> = ({
  estacaoAtual,
  className = '',
}) => {
  const normalizada = (estacaoAtual || '').toLowerCase() as EstacaoJornada;
  const indiceAtual = ESTACOES_ORDENADAS.findIndex((e) => e.id === normalizada);

  return (
    <nav aria-label="Marcos da Jornada" className={`w-full ${className}`}>
      <ol role="list" className="flex items-center justify-between gap-1 overflow-x-auto py-1">
        {ESTACOES_ORDENADAS.map((est, idx) => {
          const isCurrent = est.id === normalizada;
          const isPassed = indiceAtual >= 0 && idx < indiceAtual;

          let estadoClasses = 'border-stone-700 bg-stone-900/70 text-stone-400';
          if (isCurrent) {
            estadoClasses = 'border-amber-500 bg-amber-950/80 text-amber-200 ring-1 ring-amber-400';
          } else if (isPassed) {
            estadoClasses = 'border-emerald-600/70 bg-emerald-950/40 text-emerald-300';
          }

          return (
            <li
              key={est.id}
              role="listitem"
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex-1 min-w-[52px] flex flex-col items-center p-1 rounded border text-center transition-all ${estadoClasses}`}
            >
              <span className="text-sm select-none" aria-hidden="true">
                {est.icone}
              </span>
              <span className="text-[10px] font-sans font-medium tracking-tight mt-0.5 truncate max-w-full">
                {est.rotulo}
              </span>
            </li>
          );
        })}
      </ol>
      {normalizada === 'encerrada' && (
        <div className="mt-1 flex items-center justify-center">
          <SeloEstado estado="em_dia" rotulo="Jornada Encerrada" />
        </div>
      )}
      {normalizada === 'desconhecida' && (
        <div className="mt-1 flex items-center justify-center">
          <SeloEstado estado="desconhecido" rotulo="Estação Desconhecida" />
        </div>
      )}
    </nav>
  );
};

/* =========================================================================
   4. REGIÃO / MAPA DE PROJETOS
   ========================================================================= */

export interface RegiaoMapaProps {
  id: string;
  nome: string;
  nucleo?: string | null;
  estacao?: EstacaoJornada | string | null;
  pendencias?: number;
  diagnosticos?: number;
  pastas?: string[];
  ativo?: boolean;
  onClick?: () => void;
  className?: string;
}

export const RegiaoMapa: React.FC<RegiaoMapaProps> = ({
  id,
  nome,
  nucleo,
  estacao,
  pendencias = 0,
  diagnosticos = 0,
  pastas = [],
  ativo = false,
  onClick,
  className = '',
}) => {
  const temDiagnosticos = diagnosticos > 0;
  const variante: VarianteMoldura = temDiagnosticos
    ? 'nevoa'
    : ativo
    ? 'destaque'
    : 'default';

  return (
    <MolduraPergaminho
      id={id}
      variante={variante}
      className={`transition-all ${onClick ? 'cursor-pointer hover:border-amber-600' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3
            style={RPG_TITLE_STYLE}
            className="text-amber-100 uppercase tracking-wide text-sm font-bold truncate"
          >
            {nome}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="text-stone-400">Núcleo:</span>
            {nucleo ? (
              <span className="font-mono text-stone-200">{nucleo}</span>
            ) : (
              <span className="font-mono text-purple-200 border border-purple-500 bg-purple-950/60 px-1 py-0.2 rounded text-[11px]">
                ? desconhecido
              </span>
            )}
          </div>
        </div>

        {/* Estação / Selo */}
        <div className="flex-shrink-0">
          {estacao ? (
            <span className="text-xs font-mono px-2 py-0.5 rounded border border-amber-900/70 bg-stone-950 text-amber-200 uppercase">
              {estacao}
            </span>
          ) : (
            <SeloEstado estado="desconhecido" rotulo="desconhecido" />
          )}
        </div>
      </div>

      {/* Contadores */}
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-amber-900/40 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-stone-400">Pendências:</span>
          <span
            className={`font-mono font-bold ${
              pendencias > 0 ? 'text-amber-300' : 'text-stone-300'
            }`}
          >
            {pendencias}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-stone-400">Diagnósticos:</span>
          <span
            className={`font-mono font-bold ${
              diagnosticos > 0 ? 'text-purple-300' : 'text-stone-300'
            }`}
          >
            {diagnosticos}
          </span>
        </div>
      </div>

      {/* Acampamentos (pastas) */}
      {pastas && pastas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {pastas.slice(0, 4).map((pasta, idx) => (
            <span
              key={idx}
              className="text-[10px] font-mono text-stone-400 bg-stone-950 px-1.5 py-0.5 rounded border border-stone-800"
            >
              {pasta}
            </span>
          ))}
          {pastas.length > 4 && (
            <span className="text-[10px] text-stone-400 font-mono self-center">
              +{pastas.length - 4}
            </span>
          )}
        </div>
      )}
    </MolduraPergaminho>
  );
};

/* =========================================================================
   5. SELO DE PAPEL (INSÍGNIA COM ÍCONES SVG INLINE POR PAPEL)
   ========================================================================= */

export type PapelSociedade =
  | 'arquiteto'
  | 'coordenador'
  | 'revisor'
  | 'aragorn'
  | 'elrond'
  | 'galadriel'
  | 'legolas'
  | 'gwaihir'
  | 'jules';

export interface SeloPapelProps {
  papel: PapelSociedade | string;
  nome?: string;
  className?: string;
}

const ICONES_PAPEL: Record<string, { label: string; svg: React.ReactNode }> = {
  arquiteto: {
    label: 'Círdan (Arquiteto)',
    svg: (
      // Navio / Compasso
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 20a2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1" />
        <path d="M4 18L12 3l8 15" />
        <path d="M12 3v15" />
      </svg>
    ),
  },
  coordenador: {
    label: 'Gandalf (Coordenador)',
    svg: (
      // Cajado e chama
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20" />
        <path d="M8 5a4 4 0 0 1 8 0c0 3-4 6-4 6s-4-3-4-6z" />
      </svg>
    ),
  },
  revisor: {
    label: 'Barbárvore (Revisor)',
    svg: (
      // Árvore
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22v-7" />
        <path d="M12 15l-3-4h6l-3 4z" />
        <path d="M12 11l-4-5h8l-4 5z" />
        <path d="M12 6L9 2h6l-3 4z" />
      </svg>
    ),
  },
  aragorn: {
    label: 'Aragorn (Passos / Espada)',
    svg: (
      // Espada
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="2" x2="12" y2="18" />
        <line x1="8" y1="18" x2="16" y2="18" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="10" y1="6" x2="14" y2="6" />
      </svg>
    ),
  },
  elrond: {
    label: 'Elrond (Anel / Arquivo)',
    svg: (
      // Anel e pergaminho
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="7" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    ),
  },
  galadriel: {
    label: 'Galadriel (Espelho / Estrela)',
    svg: (
      // Estrela de 8 pontas / espelho
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" />
      </svg>
    ),
  },
  legolas: {
    label: 'Legolas (Arco / Folha)',
    svg: (
      // Arco e flecha
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 3c6 3 10 9 10 18" />
        <line x1="5" y1="3" x2="15" y2="21" />
        <line x1="2" y1="12" x2="18" y2="12" />
        <path d="M14 8l4 4-4 4" />
      </svg>
    ),
  },
  gwaihir: {
    label: 'Gwaihir (Águia)',
    svg: (
      // Águia / Asas
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 10c6-4 10-4 10 2 0-6 4-6 10-2-4 6-8 8-10 10-2-2-6-4-10-10z" />
      </svg>
    ),
  },
  jules: {
    label: 'Jules (Forja nas nuvens)',
    svg: (
      // Bigorna / Nuvem
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        <path d="M8 15h8" />
      </svg>
    ),
  },
};

export const SeloPapel: React.FC<SeloPapelProps> = ({
  papel,
  nome,
  className = '',
}) => {
  const chave = papel.toLowerCase();
  const config = ICONES_PAPEL[chave] || {
    label: papel,
    svg: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  };

  const exibicao = nome || config.label;

  return (
    <Badge
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-serif tracking-wide border rounded border-amber-800/80 bg-stone-900 text-amber-200 shadow-sm ${className}`}
    >
      <span className="text-amber-400 select-none" aria-hidden="true">
        {config.svg}
      </span>
      <span>{exibicao}</span>
    </Badge>
  );
};

/* =========================================================================
   6. ESTADO DE TELA D05 (CARREGANDO, VAZIO, ERRO, PARCIAL, SUCESSO)
   ========================================================================= */

export type TipoEstadoTela = 'carregando' | 'vazio' | 'erro' | 'parcial' | 'sucesso';

export interface EstadoTelaProps {
  estado: TipoEstadoTela;
  titulo?: string;
  mensagem?: string;
  acao?: React.ReactNode;
  detalhes?: string[];
  className?: string;
}

export const EstadoTela: React.FC<EstadoTelaProps> = ({
  estado,
  titulo,
  mensagem,
  acao,
  detalhes = [],
  className = '',
}) => {
  const isError = estado === 'erro';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex flex-col items-center justify-center p-6 sm:p-10 text-center rounded-lg border my-4 ${
        isError
          ? 'border-rose-700/80 bg-rose-950/20 text-rose-200'
          : estado === 'carregando'
          ? 'border-amber-900/60 bg-stone-900/40 text-stone-300'
          : estado === 'vazio'
          ? 'border-stone-800 bg-stone-900/50 text-stone-300'
          : estado === 'sucesso'
          ? 'border-emerald-600/60 bg-emerald-950/20 text-emerald-200'
          : 'border-amber-600/60 bg-amber-950/20 text-amber-200'
      } ${className}`}
    >
      {/* Ícone */}
      <div className="mb-3">
        {estado === 'carregando' && (
          <div
            className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
        )}
        {estado === 'vazio' && (
          <span className="text-3xl select-none" aria-hidden="true">
            📭
          </span>
        )}
        {estado === 'erro' && (
          <span className="text-3xl select-none" aria-hidden="true">
            ⚠️
          </span>
        )}
        {estado === 'sucesso' && (
          <span className="text-3xl select-none" aria-hidden="true">
            ✓
          </span>
        )}
        {estado === 'parcial' && (
          <span className="text-3xl select-none" aria-hidden="true">
            🌓
          </span>
        )}
      </div>

      {/* Título */}
      {titulo && (
        <h3
          style={RPG_TITLE_STYLE}
          className="text-base sm:text-lg font-bold uppercase tracking-wider mb-1"
        >
          {titulo}
        </h3>
      )}

      {/* Mensagem */}
      {mensagem && (
        <p className="text-sm text-stone-300 max-w-md font-sans mb-3">
          {mensagem}
        </p>
      )}

      {/* Detalhes de erro ou diagnóstico */}
      {detalhes && detalhes.length > 0 && (
        <ul className="text-left font-mono text-xs bg-stone-950/80 p-3 rounded border border-stone-800 max-w-md w-full mb-3 space-y-1">
          {detalhes.map((d, i) => (
            <li key={i} className="text-rose-300">
              • {d}
            </li>
          ))}
        </ul>
      )}

      {/* Ação */}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
};
