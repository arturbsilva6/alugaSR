# ADR-010 — Decisões de implementação do MVP (MVP-007 a MVP-013)

- **Status:** PROPOSTA (aguarda aprovação do responsável técnico; não altera ADR-001..009)
- **Data:** 26/11/2026
- **Contexto:** a Documentação Mestre deixa como "pendências técnicas antes do código" (seção 32.10) alguns detalhes que precisavam de uma escolha concreta para implementar o MVP com dados sintéticos. As escolhas abaixo são conservadoras e reversíveis.

## Decisões propostas

1. **Hash de senha:** `crypto.argon2` nativo do Node.js 26 (Argon2id, m=19456 KiB, t=2, p=1), sem dependência nativa externa. Parâmetros devem ser recalibrados no hardware de produção.
2. **UUID:** gerado no banco (`gen_random_uuid()`), exceto fotos (geradas no servidor para definir a chave de armazenamento antes do insert) e seed (UUID determinístico para idempotência).
3. **Estados:** `VARCHAR` + `CHECK` versionado (seção 32.3), não enum nativo.
4. **CSRF:** token sincronizado derivado por HMAC do hash da sessão, enviado em `X-CSRF-Token`; sem estado adicional no banco.
5. **Upload:** corpo binário (`image/jpeg|png|webp`) na rota de fotos, sem multipart e sem base64; processamento síncrono com `sharp` 0.35.5 (MVP), respondendo 201. Em produção, recomenda-se fila/worker (seção 27.7).
6. **Storage:** adaptador local `.storage/` restrito a desenvolvimento/teste; derivados servidos **pela API** (não por diretório estático), após checar publicação. Produção fica bloqueada até a escolha de Object Storage (DEC-011/EXT-05).
7. **Edição após publicação (RN-I06, política conservadora):** anúncio publicado não é editável; o titular pausa, edita (volta a rascunho) e reenvia para análise. Rejeitado também volta a rascunho ao ser editado.
8. **Encargos (UI-05, provisório):** `valor_condominio` e `valor_iptu` são tratados como valores **mensais declarados**; o total só é calculado quando todos são conhecidos.
9. **Visibilidade pública:** pausado/alugado/arquivado → HTTP 410 em links antigos; rascunho/análise/rejeitado/suspenso → 404. Titular suspenso deixa de aparecer na vitrine.
10. **Paginação:** cursor keyset assinado por HMAC (impede adulteração), com `total` agregado de publicados.
11. **Auditoria:** `logs_auditoria` append-only por trigger; histórico de estados do anúncio é derivado da auditoria (sem nova tabela, MD-15).
12. **Elegibilidade:** envio e publicação exigem `status_verificacao`/`status` = `verificado` do titular. Como o processo real de verificação (EXT-03) não existe, o status é atribuído apenas ao seed sintético; nenhum selo público é exibido.
13. **Frontend:** mesma origem da API (Express serve `frontend/`), cookie `SameSite=Strict`; modo offline com fixtures do PR #12 quando a API não responde.

14. **Dependência transitiva vulnerável (26/11/2026):** o `npm audit` do CI bloqueou o aviso alto GHSA-7589-6fvf-x4pw (ReDoS em `effect` ≤ 3.22.0), trazido por `prisma@7.10.1` → `@prisma/config` (que fixa `effect@3.20.0`). Não há patch na linha 7 do Prisma e a linha 8 ainda é RC/major. Adotado `overrides: { "effect": "3.22.5" }` (mesma major, versão corrigida), validado com `prisma validate/generate/migrate deploy/migrate diff`, seed, 106 testes e E2E. Remover o override quando o Prisma publicar versão com `effect` corrigido.

## Consequências

- Nenhuma dessas escolhas habilita dados reais (Gate C1 continua bloqueado).
- Itens 5, 6 e 8 precisam ser revistos quando EXT-05 e UI-05 forem decididos.
