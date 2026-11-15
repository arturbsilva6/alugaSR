# Banco — preparação

**Status:** sem schema Prisma ou migrations executadas nesta etapa.

As seções 31–33 da Documentação Mestre são a referência para o modelo-alvo de 31 entidades, integridade e decisões técnicas. A entrega MVP-007 implementará apenas o subconjunto estritamente necessário ao MVP e os controles de segurança que forem aplicáveis.

Não usar `prisma db push` em produção. Toda migration deve ser versionada, revisada e testada em base isolada; backups e testes de restauração são obrigatórios antes de dados pessoais reais.
