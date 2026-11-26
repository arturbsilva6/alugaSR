# Roteiro de apresentação do MVP (dados sintéticos)

Duração sugerida: 10–12 minutos. Pré-requisito: `npm run db:migrate`, `npm run db:seed` e `npm start` em banco local. Avise o público de que **todos os anúncios, contas e imagens são fictícios**.

1. **Contexto (1 min).** AlugaSR conecta quem procura aluguel em São Roque/SP a proprietários e imobiliárias. Não há pagamento, contrato, análise de crédito nem documentação locatícia.
2. **Frente 1 — busca pública (3 min).** Abrir `/`, filtrar por bairro e aluguel máximo; em `/imoveis.html` combinar quartos e ordenação por menor preço; abrir um detalhe. Mostrar: total mensal só quando os encargos são conhecidos ("a confirmar" no apartamento sem condomínio), localização apenas por bairro, galeria. Usar "Voltar aos resultados" e mostrar os filtros preservados. Opcional: reduzir a janela para 320 px.
3. **Frente 2 — banco relacional (2 min).** Mostrar `prisma/schema.prisma` (usuários, imóveis, imobiliárias e tabelas de apoio) e o SQL complementar: titular único (proprietário XOR imobiliária), aluguel > 0 fora do rascunho, capa única, auditoria append-only.
4. **Frente 3 — painel restrito (4 min).** Entrar como `imobiliaria@alugasr.test`; criar rascunho incompleto; provocar erro de aluguel inválido (dados preservados); completar, enviar foto (explicar a remoção de EXIF/GPS) e "Enviar para análise" — o anúncio **não** é publicado. Sair e entrar como `moderador@alugasr.test`; abrir a fila, tentar rejeitar sem justificativa (bloqueado) e aprovar. Voltar à busca pública e encontrar o anúncio.
5. **Segurança e limites (1 min).** Mostrar `proprietario.pendente@alugasr.test` (salva rascunho, não envia) e `atendente@alugasr.test` (sem acesso à gestão). Citar os gates C1–C3 e as pendências EXT (bairros oficiais, LGPD, storage, backup, MFA).
6. **Evidências (1 min).** Abrir a [matriz de status](STATUS_IMPLEMENTACAO.md) e o resultado do CI no PR.

Não declare o sistema "validado com usuários" nem "pronto para produção".
