# Segurança, privacidade e riscos — estado implementado

Referências: seções 18–21, 25, 26.12, 27.18, 28.8 e 33 da Documentação Mestre. Este documento lista o que o **código** faz hoje e o que continua pendente. Ele não substitui revisão de segurança independente nem parecer jurídico.

## Controles implementados e testados

| Controle | Implementação | Teste |
|---|---|---|
| Senhas | Argon2id nativo do Node 26 (`crypto.argon2`), m=19 MiB, t=2, p=1, formato PHC; verificação em tempo constante; hash fictício quando o e-mail não existe | `unit-domain`, `api-auth` |
| Sessão | token aleatório de 256 bits; banco guarda só SHA-256; cookie HttpOnly, SameSite=Strict, `Secure` + prefixo `__Host-` com HTTPS; expiração absoluta (8 h) e por inatividade (30 min); revogação em logout, logout-all, troca de senha e suspensão | `api-auth` |
| CSRF | token HMAC derivado da sessão no cabeçalho `X-CSRF-Token`; checagem de `Origin`/`Referer`; mutações só com JSON | `api-auth` |
| Enumeração/força bruta | resposta neutra única; bloqueio por conta após 5 falhas/15 min; limite por IP | `api-auth` |
| Autorização (BOLA/IDOR) | escopo do titular derivado da sessão em toda consulta; imobiliária exige vínculo ativo e papel `responsavel`/`gestor`; recursos de terceiros respondem 404 | `api-partner` |
| Mass assignment | allowlist de campos; desconhecidos → 422; `status`, titular e `revisao` nunca aceitos do cliente | `api-partner`, `unit-domain` |
| Publicação | titular não publica; moderador com vínculo ao titular é bloqueado; justificativa obrigatória; transições com revisão otimista e bloqueio de linha | `api-photos-moderation`, `api-partner` |
| Uploads | tipo real por assinatura; SVG/GIF/HTML/executáveis recusados; MIME declarado deve coincidir; limite de bytes e de pixels; reprocessamento WebP sem EXIF/GPS/XMP; quarentena; originais privados; chaves geradas pelo servidor; servidos com `nosniff` | `api-photos-moderation`, `unit-domain` |
| Privacidade pública | DTOs explícitos; endereço/coordenadas nunca em respostas públicas nem no HTML; localização em nível de bairro | `api-public`, E2E |
| Erros e logs | sem stack/SQL/valores enviados; log de erro 500 só com requestId, rota e código | `backend`, `api-public` |
| Auditoria | eventos de login, transições, fotos e moderação; metadados minimizados; tabela append-only | `db-integrity`, `api-auth`, `api-photos-moderation` |
| Cabeçalhos | Helmet com CSP `default-src 'self'`, `frame-ancestors 'none'`, HSTS com HTTPS, `Referrer-Policy: same-origin`; respostas privadas `no-store` | inspeção + testes |
| Segredos | `.env` ignorado; varredura própria no CI; valores fictícios documentados | `security:secrets` |
| Produção falha fechada | exige `SESSION_SECRET` forte, `APP_ORIGINS`, `COOKIE_SECURE=true`; recusa storage local; moderação bloqueada sem MFA; feature flags pós-MVP proibidas; seed recusado | `unit-domain` |

## Pendências e riscos conhecidos

| ID | Risco / lacuna | Severidade proposta | Situação |
|---|---|---|---|
| R1 | MFA de moderação/administração não implementado | Alta | Moderação bloqueada em produção (RN-A04, EXT-08) |
| R2 | Limitador de taxa em memória (instância única) | Média | Exige armazenamento compartilhado antes de escalar |
| R3 | Storage de produção, antivírus e retenção de originais/derivados | Alta para dados reais | Apenas adaptador local de desenvolvimento (DEC-011, EXT-05, DEC-016) |
| R4 | Backup real, RPO/RTO, resposta a incidentes | Alta para dados reais | Somente ensaio local (EXT-06) |
| R5 | Política de privacidade, termos, bases legais, canal do titular | Bloqueante para C1 | Pendente de revisão humana/jurídica (EXT-04) |
| R6 | Senhas vazadas (lista de comprometidas) | Média | Apenas lista mínima de senhas triviais |
| R7 | Catálogo oficial de bairros e validação geográfica | Média | Catálogo sintético rotulado (EXT-01) |
| R8 | Fotos pendentes órfãs (falha entre gravação e processamento) | Baixa | Ficam privadas e invisíveis; falta rotina de reconciliação |
| R9 | Acessibilidade validada por pessoas/leitores de tela | Média | Apenas verificações automáticas (UI-07) |
| R10 | Contas de banco separadas (runtime/migração/backup) e TLS | Alta para produção | Não configurado (ambiente local) |

Nenhuma destas pendências deve ser tratada como resolvida por CI verde.
