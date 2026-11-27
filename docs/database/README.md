# Banco de dados — MVP-007

Referência: Documentação Mestre, seções 17, 30–32 e 33 (DEC-007, DEC-008, DEC-013).

## Escopo implementado (15 de 31 tabelas do modelo de referência)

| Tabela | Finalidade | Destaques |
|---|---|---|
| `usuarios` | identidade única | e-mail único por `lower(email)` e exigido normalizado; status com CHECK |
| `contas_autenticacao` | senha local (Argon2id) | provedor `local` apenas; hash obrigatório |
| `sessoes` | sessões opacas | só `token_hash` (SHA-256); expiração e revogação |
| `papeis_usuario` | `usuario`, `moderador`, `administrador` | papel de imobiliária fica em `membros_imobiliaria` |
| `anunciantes` | proprietário individual (ADR-001) | um por usuário; sem tipo "imobiliária" |
| `imobiliarias` | organização (ADR-001) | CNPJ opcional, 14 dígitos, único parcial |
| `membros_imobiliaria` | vínculo usuário × imobiliária | uma linha vigente por par (REV-02); papéis/estados fechados |
| `bairros` | catálogo | slug único; `fonte_dados` obrigatório na prática (EXT-01) |
| `enderecos` | endereço **protegido** | município = São Roque, UF = SP, coordenadas em par |
| `tipos_imovel`, `caracteristicas`, `imovel_caracteristicas` | catálogos e N:N | |
| `imoveis` | anúncio | titular XOR (ADR-002); estados ADR-004; campos mínimos e aluguel > 0 fora do rascunho; `revisao` para concorrência |
| `fotos_imoveis` | metadados de mídia | estado de processamento (REV-03); capa única parcial (REV-05); MIME restrito |
| `logs_auditoria` | trilha mínima | **append-only** por trigger (UPDATE/DELETE bloqueados) |

Não criadas neste ciclo (fases posteriores, ADR-009): verificações e documentos, favoritos, conversas/mensagens/anexos, avaliações/respostas, denúncias/ações de moderação, consentimentos, solicitações de privacidade, notificações e configurações.

## Migrations

- `prisma/migrations/20261126182655_mvp007_modelo_relacional_inicial/migration.sql` — SQL gerado pelo Prisma **revisado** e acrescido de SQL complementar (CHECK, índices parciais, índice funcional e trigger).
- CI: `prisma migrate deploy` em PostgreSQL 17 isolado + `prisma migrate diff --exit-code` (drift) + seed 2×.
- Produção: somente `migrate deploy` por pipeline controlado, com backup prévio. **Nunca** `db push`.
- Rollback: esta é a migration inicial; o retorno é `DROP` do schema em ambiente não produtivo. Mudanças futuras devem seguir expand/contract.

## Políticas de exclusão

`ON DELETE RESTRICT` para usuários, titulares, endereços, tipos, imóveis e fotos (seção 32.7); `SET NULL` em `atualizado_por`, `atribuido_por`, `convidado_por`; `CASCADE` apenas em `imovel_caracteristicas`. A API não exclui fisicamente imóveis nem usuários. Observação: como a auditoria bloqueia UPDATE, a exclusão física de um usuário com eventos de auditoria é recusada pelo banco — comportamento conservador até existir o processo de descarte/anonimização aprovado (DEC-016).

## Backup e restauração

**Estado:** apenas ensaio local. Não existe backup de produção (EXT-05/EXT-06).

Ensaio executado em 26/11/2026, ambiente local de desenvolvimento, dados sintéticos:

1. `pg_dump -Fc` do banco `alugasr_dev` + arquivo compactado do diretório `.storage/`.
2. `pg_restore --no-owner` em banco novo `alugasr_restore`.
3. Verificação: contagens de `imoveis` (10), `fotos_imoveis` (8), `usuarios` (6), `logs_auditoria` (12) e `_prisma_migrations` (1) idênticas à origem; trigger append-only ativo no banco restaurado; todos os derivados das fotos aprovadas presentes na cópia do storage. Duração: ~1 s.

Isso comprova o procedimento técnico básico, **não** RPO/RTO, consistência sob carga, cifragem, isolamento de cópia ou restauração de produção. Procedimento recomendado para um ambiente real: seção 21 da Documentação Mestre.

Comandos de referência (substitua usuário/banco):

```bash
pg_dump -h 127.0.0.1 -U alugasr_dev -d alugasr_dev -Fc -f alugasr.dump
```

```bash
pg_restore -h 127.0.0.1 -U alugasr_dev -d alugasr_restore --no-owner alugasr.dump
```

Banco e objetos precisam ser copiados no mesmo ponto lógico; a reconciliação de fotos órfãs (`fotos_imoveis.status_processamento = 'pendente'` antigo) ainda não tem rotina automática.
