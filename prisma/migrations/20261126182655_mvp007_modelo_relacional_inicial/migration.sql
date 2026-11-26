-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "telefone" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "email_verificado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excluido_em" TIMESTAMPTZ(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_autenticacao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "provedor" VARCHAR(30) NOT NULL,
    "provedor_usuario_id" VARCHAR(255),
    "senha_hash" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contas_autenticacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogada_em" TIMESTAMPTZ(3),
    "ultimo_acesso_em" TIMESTAMPTZ(3),

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papeis_usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "papel" VARCHAR(30) NOT NULL,
    "atribuido_por" UUID,
    "atribuido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "papeis_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anunciantes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "nome_exibicao" VARCHAR(150) NOT NULL,
    "descricao" TEXT,
    "status_verificacao" VARCHAR(25) NOT NULL DEFAULT 'pendente',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anunciantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imobiliarias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome_comercial" VARCHAR(150) NOT NULL,
    "razao_social" VARCHAR(180),
    "cnpj" VARCHAR(14),
    "creci_pj" VARCHAR(40),
    "descricao" TEXT,
    "status" VARCHAR(25) NOT NULL DEFAULT 'pendente',
    "criado_por_usuario_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excluido_em" TIMESTAMPTZ(3),

    CONSTRAINT "imobiliarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membros_imobiliaria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "imobiliaria_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "papel" VARCHAR(25) NOT NULL,
    "status" VARCHAR(25) NOT NULL DEFAULT 'convidado',
    "convidado_por" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aceito_em" TIMESTAMPTZ(3),
    "removido_em" TIMESTAMPTZ(3),

    CONSTRAINT "membros_imobiliaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bairros" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "codigo_referencia" VARCHAR(80),
    "fonte_dados" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bairros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enderecos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bairro_id" UUID NOT NULL,
    "cep" VARCHAR(9),
    "logradouro" VARCHAR(180),
    "numero" VARCHAR(30),
    "complemento" VARCHAR(100),
    "municipio" VARCHAR(80) NOT NULL DEFAULT 'São Roque',
    "uf" CHAR(2) NOT NULL DEFAULT 'SP',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enderecos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_imovel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(90) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipos_imovel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imoveis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anunciante_id" UUID,
    "imobiliaria_id" UUID,
    "criado_por_usuario_id" UUID NOT NULL,
    "atualizado_por_usuario_id" UUID,
    "endereco_id" UUID,
    "tipo_imovel_id" UUID,
    "titulo" VARCHAR(150),
    "descricao" TEXT,
    "valor_aluguel" DECIMAL(12,2),
    "valor_condominio" DECIMAL(12,2),
    "valor_iptu" DECIMAL(12,2),
    "area_m2" DECIMAL(10,2),
    "quartos" INTEGER,
    "banheiros" INTEGER,
    "vagas_garagem" INTEGER,
    "status" VARCHAR(25) NOT NULL DEFAULT 'rascunho',
    "revisao" INTEGER NOT NULL DEFAULT 1,
    "publicado_em" TIMESTAMPTZ(3),
    "arquivado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imoveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_imoveis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "imovel_id" UUID NOT NULL,
    "chave_armazenamento" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "texto_alternativo" VARCHAR(250),
    "status_processamento" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "mime_type_validado" VARCHAR(100),
    "tamanho_bytes" BIGINT,
    "hash_conteudo" VARCHAR(64),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excluido_em" TIMESTAMPTZ(3),

    CONSTRAINT "fotos_imoveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caracteristicas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "categoria" VARCHAR(60),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "caracteristicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imovel_caracteristicas" (
    "imovel_id" UUID NOT NULL,
    "caracteristica_id" UUID NOT NULL,

    CONSTRAINT "imovel_caracteristicas_pkey" PRIMARY KEY ("imovel_id","caracteristica_id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ator_id" UUID,
    "acao" VARCHAR(80) NOT NULL,
    "tipo_recurso" VARCHAR(80) NOT NULL,
    "recurso_id" UUID,
    "metadados" JSONB,
    "ocorrido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contas_autenticacao_usuario_id_provedor_key" ON "contas_autenticacao"("usuario_id", "provedor");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_token_hash_key" ON "sessoes"("token_hash");

-- CreateIndex
CREATE INDEX "sessoes_usuario_id_expira_em_idx" ON "sessoes"("usuario_id", "expira_em");

-- CreateIndex
CREATE UNIQUE INDEX "papeis_usuario_usuario_id_papel_key" ON "papeis_usuario"("usuario_id", "papel");

-- CreateIndex
CREATE UNIQUE INDEX "anunciantes_usuario_id_key" ON "anunciantes"("usuario_id");

-- CreateIndex
CREATE INDEX "membros_imobiliaria_usuario_id_status_idx" ON "membros_imobiliaria"("usuario_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "membros_imobiliaria_imobiliaria_id_usuario_id_key" ON "membros_imobiliaria"("imobiliaria_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "bairros_slug_key" ON "bairros"("slug");

-- CreateIndex
CREATE INDEX "enderecos_bairro_id_id_idx" ON "enderecos"("bairro_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_imovel_slug_key" ON "tipos_imovel"("slug");

-- CreateIndex
CREATE INDEX "imoveis_status_publicado_em_id_idx" ON "imoveis"("status", "publicado_em" DESC, "id");

-- CreateIndex
CREATE INDEX "imoveis_status_tipo_imovel_id_valor_aluguel_id_idx" ON "imoveis"("status", "tipo_imovel_id", "valor_aluguel", "id");

-- CreateIndex
CREATE INDEX "imoveis_anunciante_id_status_atualizado_em_idx" ON "imoveis"("anunciante_id", "status", "atualizado_em" DESC);

-- CreateIndex
CREATE INDEX "imoveis_imobiliaria_id_status_atualizado_em_idx" ON "imoveis"("imobiliaria_id", "status", "atualizado_em" DESC);

-- CreateIndex
CREATE INDEX "imoveis_endereco_id_idx" ON "imoveis"("endereco_id");

-- CreateIndex
CREATE UNIQUE INDEX "fotos_imoveis_chave_armazenamento_key" ON "fotos_imoveis"("chave_armazenamento");

-- CreateIndex
CREATE INDEX "fotos_imoveis_imovel_id_ordem_idx" ON "fotos_imoveis"("imovel_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "caracteristicas_slug_key" ON "caracteristicas"("slug");

-- CreateIndex
CREATE INDEX "imovel_caracteristicas_caracteristica_id_idx" ON "imovel_caracteristicas"("caracteristica_id");

-- CreateIndex
CREATE INDEX "logs_auditoria_ocorrido_em_acao_idx" ON "logs_auditoria"("ocorrido_em", "acao");

-- CreateIndex
CREATE INDEX "logs_auditoria_tipo_recurso_recurso_id_ocorrido_em_idx" ON "logs_auditoria"("tipo_recurso", "recurso_id", "ocorrido_em");

-- AddForeignKey
ALTER TABLE "contas_autenticacao" ADD CONSTRAINT "contas_autenticacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "papeis_usuario" ADD CONSTRAINT "papeis_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "papeis_usuario" ADD CONSTRAINT "papeis_usuario_atribuido_por_fkey" FOREIGN KEY ("atribuido_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "anunciantes" ADD CONSTRAINT "anunciantes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "imobiliarias" ADD CONSTRAINT "imobiliarias_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "membros_imobiliaria" ADD CONSTRAINT "membros_imobiliaria_imobiliaria_id_fkey" FOREIGN KEY ("imobiliaria_id") REFERENCES "imobiliarias"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "membros_imobiliaria" ADD CONSTRAINT "membros_imobiliaria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "membros_imobiliaria" ADD CONSTRAINT "membros_imobiliaria_convidado_por_fkey" FOREIGN KEY ("convidado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "enderecos" ADD CONSTRAINT "enderecos_bairro_id_fkey" FOREIGN KEY ("bairro_id") REFERENCES "bairros"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_anunciante_id_fkey" FOREIGN KEY ("anunciante_id") REFERENCES "anunciantes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_imobiliaria_id_fkey" FOREIGN KEY ("imobiliaria_id") REFERENCES "imobiliarias"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_criado_por_usuario_id_fkey" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_atualizado_por_usuario_id_fkey" FOREIGN KEY ("atualizado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_endereco_id_fkey" FOREIGN KEY ("endereco_id") REFERENCES "enderecos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_tipo_imovel_id_fkey" FOREIGN KEY ("tipo_imovel_id") REFERENCES "tipos_imovel"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "fotos_imoveis" ADD CONSTRAINT "fotos_imoveis_imovel_id_fkey" FOREIGN KEY ("imovel_id") REFERENCES "imoveis"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "imovel_caracteristicas" ADD CONSTRAINT "imovel_caracteristicas_imovel_id_fkey" FOREIGN KEY ("imovel_id") REFERENCES "imoveis"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "imovel_caracteristicas" ADD CONSTRAINT "imovel_caracteristicas_caracteristica_id_fkey" FOREIGN KEY ("caracteristica_id") REFERENCES "caracteristicas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_ator_id_fkey" FOREIGN KEY ("ator_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- =====================================================================
-- SQL complementar revisado manualmente (MVP-007; seções 31.10, 32.3–32.6;
-- DEC-008, DEC-013). O Prisma não expressa CHECK, índices parciais nem
-- índices funcionais; mantê-los aqui garante a mesma proteção em qualquer
-- cliente do banco, não apenas na API.
-- =====================================================================

-- Usuários e identidade ------------------------------------------------
CREATE UNIQUE INDEX "usuarios_email_lower_key" ON "usuarios" (lower("email"));
ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_status_check" CHECK ("status" IN ('pendente','ativo','suspenso','desativado')),
  ADD CONSTRAINT "usuarios_email_normalizado_check" CHECK ("email" = lower(btrim("email")) AND position('@' in "email") > 1),
  ADD CONSTRAINT "usuarios_nome_check" CHECK (length(btrim("nome")) BETWEEN 1 AND 120);

ALTER TABLE "contas_autenticacao"
  ADD CONSTRAINT "contas_autenticacao_provedor_check" CHECK ("provedor" IN ('local')),
  ADD CONSTRAINT "contas_autenticacao_local_hash_check" CHECK ("provedor" <> 'local' OR "senha_hash" IS NOT NULL),
  ADD CONSTRAINT "contas_autenticacao_externo_id_check" CHECK ("provedor" = 'local' OR "provedor_usuario_id" IS NOT NULL);
CREATE UNIQUE INDEX "contas_autenticacao_provedor_externo_key"
  ON "contas_autenticacao" ("provedor", "provedor_usuario_id") WHERE "provedor_usuario_id" IS NOT NULL;

ALTER TABLE "sessoes"
  ADD CONSTRAINT "sessoes_expiracao_check" CHECK ("expira_em" > "criado_em");

ALTER TABLE "papeis_usuario"
  ADD CONSTRAINT "papeis_usuario_papel_check" CHECK ("papel" IN ('usuario','moderador','administrador'));

-- Anunciantes, imobiliárias e membros -----------------------------------
ALTER TABLE "anunciantes"
  ADD CONSTRAINT "anunciantes_status_verificacao_check"
  CHECK ("status_verificacao" IN ('pendente','em_analise','verificado','rejeitado','suspenso','revisao_necessaria'));

ALTER TABLE "imobiliarias"
  ADD CONSTRAINT "imobiliarias_status_check"
  CHECK ("status" IN ('pendente','em_analise','verificado','rejeitado','suspenso','revisao_necessaria')),
  ADD CONSTRAINT "imobiliarias_cnpj_digitos_check" CHECK ("cnpj" IS NULL OR "cnpj" ~ '^[0-9]{14}$');
CREATE UNIQUE INDEX "imobiliarias_cnpj_key" ON "imobiliarias" ("cnpj") WHERE "cnpj" IS NOT NULL;

ALTER TABLE "membros_imobiliaria"
  ADD CONSTRAINT "membros_imobiliaria_papel_check" CHECK ("papel" IN ('responsavel','gestor','atendente')),
  ADD CONSTRAINT "membros_imobiliaria_status_check" CHECK ("status" IN ('convidado','ativo','suspenso','removido')),
  ADD CONSTRAINT "membros_imobiliaria_datas_check" CHECK (
    ("status" <> 'ativo' OR "aceito_em" IS NOT NULL) AND ("status" <> 'removido' OR "removido_em" IS NOT NULL));

-- Localização ----------------------------------------------------------
ALTER TABLE "bairros"
  ADD CONSTRAINT "bairros_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

ALTER TABLE "enderecos"
  ADD CONSTRAINT "enderecos_municipio_check" CHECK ("municipio" = 'São Roque'),
  ADD CONSTRAINT "enderecos_uf_check" CHECK ("uf" = 'SP'),
  ADD CONSTRAINT "enderecos_cep_check" CHECK ("cep" IS NULL OR "cep" ~ '^[0-9]{5}-?[0-9]{3}$'),
  ADD CONSTRAINT "enderecos_coordenadas_par_check" CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  ADD CONSTRAINT "enderecos_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "enderecos_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);

ALTER TABLE "tipos_imovel"
  ADD CONSTRAINT "tipos_imovel_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "caracteristicas"
  ADD CONSTRAINT "caracteristicas_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Imóveis (ADR-002, ADR-004, REV-01) ------------------------------------
ALTER TABLE "imoveis"
  ADD CONSTRAINT "imoveis_titular_unico_check"
    CHECK ((("anunciante_id" IS NOT NULL)::int + ("imobiliaria_id" IS NOT NULL)::int) = 1),
  ADD CONSTRAINT "imoveis_status_check"
    CHECK ("status" IN ('rascunho','em_analise','publicado','rejeitado','pausado','alugado','arquivado','suspenso')),
  ADD CONSTRAINT "imoveis_valores_check" CHECK (
    ("valor_aluguel" IS NULL OR "valor_aluguel" >= 0) AND
    ("valor_condominio" IS NULL OR "valor_condominio" >= 0) AND
    ("valor_iptu" IS NULL OR "valor_iptu" >= 0)),
  ADD CONSTRAINT "imoveis_area_check" CHECK ("area_m2" IS NULL OR "area_m2" > 0),
  ADD CONSTRAINT "imoveis_contadores_check" CHECK (
    ("quartos" IS NULL OR "quartos" BETWEEN 0 AND 50) AND
    ("banheiros" IS NULL OR "banheiros" BETWEEN 0 AND 50) AND
    ("vagas_garagem" IS NULL OR "vagas_garagem" BETWEEN 0 AND 50)),
  ADD CONSTRAINT "imoveis_revisao_check" CHECK ("revisao" > 0),
  -- Fora do rascunho/rejeitado/arquivado, os campos mínimos de publicação são obrigatórios
  -- e o aluguel deve ser > 0 (ADR-004). Fotos aprovadas e elegibilidade são validadas pelo
  -- serviço transacional (regra intertabelas, seção 32.6).
  ADD CONSTRAINT "imoveis_campos_minimos_publicacao_check" CHECK (
    "status" IN ('rascunho','rejeitado','arquivado') OR (
      "titulo" IS NOT NULL AND "descricao" IS NOT NULL AND "endereco_id" IS NOT NULL AND
      "tipo_imovel_id" IS NOT NULL AND "valor_aluguel" IS NOT NULL AND "valor_aluguel" > 0)),
  ADD CONSTRAINT "imoveis_publicado_em_check" CHECK ("status" <> 'publicado' OR "publicado_em" IS NOT NULL);
CREATE INDEX "imoveis_publicados_preco_idx" ON "imoveis" ("valor_aluguel", "id") WHERE "status" = 'publicado';

-- Fotos (REV-03, REV-05) -----------------------------------------------
ALTER TABLE "fotos_imoveis"
  ADD CONSTRAINT "fotos_imoveis_status_check" CHECK ("status_processamento" IN ('pendente','aprovado','rejeitado','removido')),
  ADD CONSTRAINT "fotos_imoveis_ordem_check" CHECK ("ordem" >= 0),
  ADD CONSTRAINT "fotos_imoveis_tamanho_check" CHECK ("tamanho_bytes" IS NULL OR "tamanho_bytes" > 0),
  ADD CONSTRAINT "fotos_imoveis_mime_check" CHECK ("mime_type_validado" IS NULL OR "mime_type_validado" IN ('image/jpeg','image/png','image/webp')),
  ADD CONSTRAINT "fotos_imoveis_principal_aprovada_check" CHECK (NOT "principal" OR ("status_processamento" = 'aprovado' AND "excluido_em" IS NULL));
CREATE UNIQUE INDEX "fotos_imoveis_capa_unica_key" ON "fotos_imoveis" ("imovel_id")
  WHERE "principal" AND "status_processamento" = 'aprovado' AND "excluido_em" IS NULL;

-- Auditoria append-only (CT-12; seção 31.7) -------------------------------
ALTER TABLE "logs_auditoria"
  ADD CONSTRAINT "logs_auditoria_acao_check" CHECK ("acao" ~ '^[a-z0-9_.]+$');
CREATE FUNCTION "logs_auditoria_somente_insercao"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'logs_auditoria é append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;
CREATE TRIGGER "logs_auditoria_bloqueia_alteracao"
  BEFORE UPDATE OR DELETE ON "logs_auditoria"
  FOR EACH ROW EXECUTE FUNCTION "logs_auditoria_somente_insercao"();
