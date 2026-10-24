-- Etapa p1-fundacao (Fatia F5): Seed fictício para ambiente de desenvolvimento local.
-- Todos os dados são fictícios (*.test, exemplo).

-- 1. Usuário dono fictício em auth.users e auth.identities
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  is_sso_user,
  is_anonymous
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'dono@exemplo.test',
  '',
  '2026-10-23T15:00:00Z',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  '2026-10-23T15:00:00Z',
  '2026-10-23T15:00:00Z',
  '',
  '',
  '',
  '',
  false,
  false
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data;

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  jsonb_build_object(
    'sub', '11111111-1111-4111-8111-111111111111',
    'email', 'dono@exemplo.test',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  '11111111-1111-4111-8111-111111111111',
  '2026-10-23T15:00:00Z',
  '2026-10-23T15:00:00Z',
  '2026-10-23T15:00:00Z'
) ON CONFLICT (provider_id, provider) DO UPDATE SET
  identity_data = EXCLUDED.identity_data;

-- 2. Máquina fictícia notebook-exemplo
-- Credencial de TESTE em claro para envio local via scripts/enviar-exemplo.mjs:
-- 'token-teste-notebook-exemplo-local-0000'
-- Hash SHA-256 hex correspondente:
-- 'f5efd76fc56c2cf59f8bb4787e46b57f4c8c282a4888562b43129349b48808f9'
-- ultimo_envio_em é fixado no passado para não acionar rate limit no primeiro envio de teste.
INSERT INTO public.maquinas (
  id,
  dono,
  apelido,
  token_hash,
  criado_em,
  ultimo_envio_em
) VALUES (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'notebook-exemplo',
  'f5efd76fc56c2cf59f8bb4787e46b57f4c8c282a4888562b43129349b48808f9',
  '2026-10-23T15:00:00Z',
  '2026-10-23T15:00:00Z'
) ON CONFLICT (dono, apelido) DO UPDATE SET
  token_hash = EXCLUDED.token_hash,
  ultimo_envio_em = EXCLUDED.ultimo_envio_em;

-- 3. Instantâneo inicial igual ao painel-1.exemplo.json
INSERT INTO public.instantaneos (
  id,
  maquina_id,
  dono,
  coletado_em,
  recebido_em,
  esquema,
  corpo,
  bytes
) VALUES (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  '2026-10-23T15:00:00Z',
  '2026-10-23T15:00:00Z',
  'painel/1',
  $corpo${
  "esquema": "painel/1",
  "coletado_em": "2026-10-23T15:00:00Z",
  "maquina": "notebook-exemplo",
  "pacote": {
    "fonte_versao": "3.4.0",
    "instalacoes": [
      {"ferramenta": "claude", "versao": "3.4.0", "origem": "pacote-exemplo@a1b2c3d", "alteracao_local": false},
      {"ferramenta": "codex", "versao": "3.4.0", "origem": "pacote-exemplo@a1b2c3d", "alteracao_local": false},
      {"ferramenta": "antigravity", "versao": "3.3.0", "origem": null, "alteracao_local": true}
    ]
  },
  "cardapio": [
    {"plataforma": "Claude Code", "fornecedor": "Anthropic", "nivel": "alta", "modelo": "Claude Opus 5.5", "esforco": "high"},
    {"plataforma": "Claude Code", "fornecedor": "Anthropic", "nivel": "moderada", "modelo": "Claude Sonnet 5.5", "esforco": "medium"},
    {"plataforma": "Claude Code", "fornecedor": "Anthropic", "nivel": "simples", "modelo": "Claude Haiku 5.5", "esforco": "low"},
    {"plataforma": "Codex", "fornecedor": "OpenAI", "nivel": "alta", "modelo": "GPT-6-Astra", "esforco": "high"},
    {"plataforma": "Codex", "fornecedor": "OpenAI", "nivel": "moderada", "modelo": "GPT-6.1-Sol", "esforco": "medium"},
    {"plataforma": "Codex", "fornecedor": "OpenAI", "nivel": "simples", "modelo": "GPT-6-Luna", "esforco": "low"},
    {"plataforma": "Antigravity", "fornecedor": "Google", "nivel": "alta", "modelo": "Gemini 4 Argon", "esforco": "high"},
    {"plataforma": "Antigravity", "fornecedor": "Google", "nivel": "moderada", "modelo": "Gemini 3.8 Flash", "esforco": "medium"},
    {"plataforma": "Antigravity", "fornecedor": "Google", "nivel": "simples", "modelo": "Gemini 3.8 Flash", "esforco": "low"}
  ],
  "projetos": [
    {
      "id": "loja-exemplo",
      "nome": "Loja Exemplo",
      "envio_ligado": true,
      "pastas": [
        {"ferramenta": "claude", "caminho": "/home/dono/Projetos/loja-exemplo", "tipo": "canonica", "ramo": "main", "sha": "abc1234", "limpa": true},
        {"ferramenta": "codex", "caminho": "/home/dono/Projetos/loja-exemplo-codex", "tipo": "clone", "ramo": "main", "sha": "9f8e7d6", "limpa": false},
        {"ferramenta": "antigravity", "caminho": "/home/dono/.sociedade/trabalho/loja-exemplo/e3-carrinho", "tipo": "worktree", "ramo": "etapa/e3-carrinho", "sha": "1a2b3c4", "limpa": true}
      ],
      "nucleo": "3.4.0",
      "formato_registro": "2.1.0-cadeia",
      "etapas": [
        {
          "id": "e2-catalogo",
          "estacao": "encerrada",
          "decisao": "aceitar",
          "grau": "A",
          "interacoes": [],
          "passagens": []
        },
        {
          "id": "e3-carrinho",
          "estacao": "revisao",
          "decisao": null,
          "grau": null,
          "interacoes": [
            {
              "escala": {"papel": "arquiteto", "plataforma": "Claude Code", "fornecedor": "Anthropic", "modelo": "Claude Opus 5.5", "esforco": "high", "subagentes": {"simples": "Claude Haiku 5.5", "moderada": "Claude Sonnet 5.5"}},
              "inicio": "2026-10-22T13:10:00Z",
              "modelo_no_log": "Claude Opus 5.5",
              "avisos": []
            },
            {
              "escala": {"papel": "coordenador", "plataforma": "Antigravity", "fornecedor": "Google", "modelo": "Gemini 3.8 Flash", "esforco": "medium", "subagentes": {"simples": "Gemini 3.8 Flash", "moderada": "Gemini 3.8 Flash", "alta": "Gemini 4 Argon"}},
              "inicio": "2026-10-22T15:40:00Z",
              "modelo_no_log": "Gemini 3.8 Flash",
              "avisos": []
            },
            {
              "escala": {"papel": "revisor", "plataforma": "Codex", "fornecedor": "OpenAI", "modelo": "GPT-6.1-Sol", "esforco": "xhigh"},
              "inicio": "2026-10-23T10:05:00Z",
              "modelo_no_log": null,
              "avisos": ["modelo do log ainda não lido: conversa em andamento"]
            }
          ],
          "passagens": [
            {
              "de": "coordenador",
              "para": "arquiteto",
              "quando": "2026-10-22T18:20:00Z",
              "bloco": "Para: Círdan · De: Gandalf · Etapa: e3-carrinho\nSituação: portão aprovado no commit 1a2b3c4\nFeito: 3 fatias (carrinho, cupom, testes)\nPendente ou decisão: nenhuma\nPróximo passo: preparar a cópia de revisão\nDetalhe: sociedade/subordens/e3-carrinho-retorno.md"
            },
            {
              "de": "arquiteto",
              "para": "revisor",
              "quando": "2026-10-23T09:50:00Z",
              "bloco": "Para: Barbárvore · De: Círdan · Etapa: e3-carrinho\nSituação: cópia de revisão pronta\nFeito: candidato 1a2b3c4 sobre a base abc1234\nPendente ou decisão: revisão completa (protocolo de oito lentes)\nPróximo passo: emitir o parecer com hash\nDetalhe: sociedade/subordens/e3-carrinho-revisao.md"
            }
          ]
        }
      ],
      "pendencias": [
        {"tipo": "revisao_devida", "texto": "Revisão da e3-carrinho em andamento no Codex", "etapa": "e3-carrinho"},
        {"tipo": "troca_vencendo", "texto": "Coordenador temporário no Antigravity até 24/10", "etapa": null},
        {"tipo": "divergencia", "texto": "A pasta loja-exemplo-codex parece um clone da canônica; confirme no mapa de projetos", "etapa": null}
      ],
      "ajustes_metodo": [
        {"id": "LOJA-D-004", "estado": "em_avaliacao", "resumo": "Cupom de teste fixo nas fixtures de checkout"}
      ]
    },
    {
      "id": "app-receitas",
      "nome": "App Receitas",
      "envio_ligado": true,
      "pastas": [
        {"ferramenta": "claude", "caminho": "/home/dono/Projetos/app-receitas", "tipo": "canonica", "ramo": "main", "sha": "77aa88b", "limpa": true},
        {"ferramenta": "antigravity", "caminho": "/home/dono/Projetos/app-receitas", "tipo": "canonica", "ramo": "main", "sha": "77aa88b", "limpa": true}
      ],
      "nucleo": "3.1.0",
      "formato_registro": "2.1.0",
      "etapas": [
        {
          "id": "r1-busca",
          "estacao": "ordem",
          "decisao": null,
          "grau": null,
          "interacoes": [],
          "passagens": []
        }
      ],
      "pendencias": [
        {"tipo": "aprovar_ordem", "texto": "Ordem r1-busca escrita pelo Círdan; falta a sua aprovação", "etapa": "r1-busca"},
        {"tipo": "versao_defasada", "texto": "Núcleo 3.1.0 no projeto; a fonte está em 3.4.0", "etapa": null}
      ],
      "ajustes_metodo": [
        {"id": "RCT-D-003", "estado": "identificada", "resumo": "Revisão por lote nas etapas só de tela"}
      ]
    },
    {
      "id": "diario-campo",
      "nome": "Diário de Campo",
      "envio_ligado": false,
      "pastas": [
        {"ferramenta": "antigravity", "caminho": "/home/dono/Projetos/diario-campo", "tipo": "canonica", "ramo": null, "sha": null, "limpa": null}
      ],
      "nucleo": null,
      "formato_registro": "desconhecido",
      "etapas": [],
      "pendencias": []
    }
  ],
  "diagnosticos": [
    {"projeto": "diario-campo", "campo": "nucleo", "motivo": "AGENTS.md sem o bloco da Sociedade"},
    {"projeto": "diario-campo", "campo": "etapas", "motivo": "sociedade/registro.json ilegível (JSON inválido na linha 3)"},
    {"projeto": "diario-campo", "campo": "pastas[0].ramo", "motivo": "pasta sem repositório Git"},
    {"projeto": null, "campo": "pacote.instalacoes[2].origem", "motivo": "instalação do Antigravity sem registro de origem"}
  ]
}$corpo$::jsonb,
  octet_length($corpo${
  "esquema": "painel/1",
  "coletado_em": "2026-10-23T15:00:00Z",
  "maquina": "notebook-exemplo",
  "pacote": {
    "fonte_versao": "3.4.0",
    "instalacoes": [
      {"ferramenta": "claude", "versao": "3.4.0", "origem": "pacote-exemplo@a1b2c3d", "alteracao_local": false},
      {"ferramenta": "codex", "versao": "3.4.0", "origem": "pacote-exemplo@a1b2c3d", "alteracao_local": false},
      {"ferramenta": "antigravity", "versao": "3.3.0", "origem": null, "alteracao_local": true}
    ]
  },
  "cardapio": [
    {"plataforma": "Claude Code", "fornecedor": "Anthropic", "nivel": "alta", "modelo": "Claude Opus 5.5", "esforco": "high"},
    {"plataforma": "Claude Code", "fornecedor": "Anthropic", "nivel": "moderada", "modelo": "Claude Sonnet 5.5", "esforco": "medium"},
    {"plataforma": "Claude Code", "fornecedor": "Anthropic", "nivel": "simples", "modelo": "Claude Haiku 5.5", "esforco": "low"},
    {"plataforma": "Codex", "fornecedor": "OpenAI", "nivel": "alta", "modelo": "GPT-6-Astra", "esforco": "high"},
    {"plataforma": "Codex", "fornecedor": "OpenAI", "nivel": "moderada", "modelo": "GPT-6.1-Sol", "esforco": "medium"},
    {"plataforma": "Codex", "fornecedor": "OpenAI", "nivel": "simples", "modelo": "GPT-6-Luna", "esforco": "low"},
    {"plataforma": "Antigravity", "fornecedor": "Google", "nivel": "alta", "modelo": "Gemini 4 Argon", "esforco": "high"},
    {"plataforma": "Antigravity", "fornecedor": "Google", "nivel": "moderada", "modelo": "Gemini 3.8 Flash", "esforco": "medium"},
    {"plataforma": "Antigravity", "fornecedor": "Google", "nivel": "simples", "modelo": "Gemini 3.8 Flash", "esforco": "low"}
  ],
  "projetos": [
    {
      "id": "loja-exemplo",
      "nome": "Loja Exemplo",
      "envio_ligado": true,
      "pastas": [
        {"ferramenta": "claude", "caminho": "/home/dono/Projetos/loja-exemplo", "tipo": "canonica", "ramo": "main", "sha": "abc1234", "limpa": true},
        {"ferramenta": "codex", "caminho": "/home/dono/Projetos/loja-exemplo-codex", "tipo": "clone", "ramo": "main", "sha": "9f8e7d6", "limpa": false},
        {"ferramenta": "antigravity", "caminho": "/home/dono/.sociedade/trabalho/loja-exemplo/e3-carrinho", "tipo": "worktree", "ramo": "etapa/e3-carrinho", "sha": "1a2b3c4", "limpa": true}
      ],
      "nucleo": "3.4.0",
      "formato_registro": "2.1.0-cadeia",
      "etapas": [
        {
          "id": "e2-catalogo",
          "estacao": "encerrada",
          "decisao": "aceitar",
          "grau": "A",
          "interacoes": [],
          "passagens": []
        },
        {
          "id": "e3-carrinho",
          "estacao": "revisao",
          "decisao": null,
          "grau": null,
          "interacoes": [
            {
              "escala": {"papel": "arquiteto", "plataforma": "Claude Code", "fornecedor": "Anthropic", "modelo": "Claude Opus 5.5", "esforco": "high", "subagentes": {"simples": "Claude Haiku 5.5", "moderada": "Claude Sonnet 5.5"}},
              "inicio": "2026-10-22T13:10:00Z",
              "modelo_no_log": "Claude Opus 5.5",
              "avisos": []
            },
            {
              "escala": {"papel": "coordenador", "plataforma": "Antigravity", "fornecedor": "Google", "modelo": "Gemini 3.8 Flash", "esforco": "medium", "subagentes": {"simples": "Gemini 3.8 Flash", "moderada": "Gemini 3.8 Flash", "alta": "Gemini 4 Argon"}},
              "inicio": "2026-10-22T15:40:00Z",
              "modelo_no_log": "Gemini 3.8 Flash",
              "avisos": []
            },
            {
              "escala": {"papel": "revisor", "plataforma": "Codex", "fornecedor": "OpenAI", "modelo": "GPT-6.1-Sol", "esforco": "xhigh"},
              "inicio": "2026-10-23T10:05:00Z",
              "modelo_no_log": null,
              "avisos": ["modelo do log ainda não lido: conversa em andamento"]
            }
          ],
          "passagens": [
            {
              "de": "coordenador",
              "para": "arquiteto",
              "quando": "2026-10-22T18:20:00Z",
              "bloco": "Para: Círdan · De: Gandalf · Etapa: e3-carrinho\nSituação: portão aprovado no commit 1a2b3c4\nFeito: 3 fatias (carrinho, cupom, testes)\nPendente ou decisão: nenhuma\nPróximo passo: preparar a cópia de revisão\nDetalhe: sociedade/subordens/e3-carrinho-retorno.md"
            },
            {
              "de": "arquiteto",
              "para": "revisor",
              "quando": "2026-10-23T09:50:00Z",
              "bloco": "Para: Barbárvore · De: Círdan · Etapa: e3-carrinho\nSituação: cópia de revisão pronta\nFeito: candidato 1a2b3c4 sobre a base abc1234\nPendente ou decisão: revisão completa (protocolo de oito lentes)\nPróximo passo: emitir o parecer com hash\nDetalhe: sociedade/subordens/e3-carrinho-revisao.md"
            }
          ]
        }
      ],
      "pendencias": [
        {"tipo": "revisao_devida", "texto": "Revisão da e3-carrinho em andamento no Codex", "etapa": "e3-carrinho"},
        {"tipo": "troca_vencendo", "texto": "Coordenador temporário no Antigravity até 24/10", "etapa": null},
        {"tipo": "divergencia", "texto": "A pasta loja-exemplo-codex parece um clone da canônica; confirme no mapa de projetos", "etapa": null}
      ],
      "ajustes_metodo": [
        {"id": "LOJA-D-004", "estado": "em_avaliacao", "resumo": "Cupom de teste fixo nas fixtures de checkout"}
      ]
    },
    {
      "id": "app-receitas",
      "nome": "App Receitas",
      "envio_ligado": true,
      "pastas": [
        {"ferramenta": "claude", "caminho": "/home/dono/Projetos/app-receitas", "tipo": "canonica", "ramo": "main", "sha": "77aa88b", "limpa": true},
        {"ferramenta": "antigravity", "caminho": "/home/dono/Projetos/app-receitas", "tipo": "canonica", "ramo": "main", "sha": "77aa88b", "limpa": true}
      ],
      "nucleo": "3.1.0",
      "formato_registro": "2.1.0",
      "etapas": [
        {
          "id": "r1-busca",
          "estacao": "ordem",
          "decisao": null,
          "grau": null,
          "interacoes": [],
          "passagens": []
        }
      ],
      "pendencias": [
        {"tipo": "aprovar_ordem", "texto": "Ordem r1-busca escrita pelo Círdan; falta a sua aprovação", "etapa": "r1-busca"},
        {"tipo": "versao_defasada", "texto": "Núcleo 3.1.0 no projeto; a fonte está em 3.4.0", "etapa": null}
      ],
      "ajustes_metodo": [
        {"id": "RCT-D-003", "estado": "identificada", "resumo": "Revisão por lote nas etapas só de tela"}
      ]
    },
    {
      "id": "diario-campo",
      "nome": "Diário de Campo",
      "envio_ligado": false,
      "pastas": [
        {"ferramenta": "antigravity", "caminho": "/home/dono/Projetos/diario-campo", "tipo": "canonica", "ramo": null, "sha": null, "limpa": null}
      ],
      "nucleo": null,
      "formato_registro": "desconhecido",
      "etapas": [],
      "pendencias": []
    }
  ],
  "diagnosticos": [
    {"projeto": "diario-campo", "campo": "nucleo", "motivo": "AGENTS.md sem o bloco da Sociedade"},
    {"projeto": "diario-campo", "campo": "etapas", "motivo": "sociedade/registro.json ilegível (JSON inválido na linha 3)"},
    {"projeto": "diario-campo", "campo": "pastas[0].ramo", "motivo": "pasta sem repositório Git"},
    {"projeto": null, "campo": "pacote.instalacoes[2].origem", "motivo": "instalação do Antigravity sem registro de origem"}
  ]
}$corpo$::text)
) ON CONFLICT (maquina_id, coletado_em) DO UPDATE SET
  corpo = EXCLUDED.corpo,
  bytes = EXCLUDED.bytes;
