# Política de segurança — AlugaSR

**Estado:** projeto em fase inicial, sem implantação pública da aplicação.

## Comunicar vulnerabilidades
Evite registrar exploits, credenciais, tokens, endereços pessoais, documentos privados ou outras informações sensíveis em issues públicas. Use o recurso de **Private vulnerability reporting** do GitHub, quando habilitado pelo responsável pelo repositório. Caso ainda não esteja habilitado, solicite ao mantenedor um canal privado antes de enviar detalhes técnicos sensíveis. Não inclua dados sensíveis em PRs ou comentários públicos.

## Princípios
- Nunca versionar `.env` real, senhas, tokens, certificados, dumps, documentos privados ou fotos reais sem autorização.
- Privacidade por padrão: dados sintéticos no ambiente de demonstração e testes.
- Autorização no backend por papel, recurso, titular e vínculo organizacional.
- Uploads reais dependem de validação, quarentena, isolamento de originais e remoção de metadados EXIF/GPS.
- Sessões, recuperação de conta, auditoria, retenção, backup/restauração e LGPD seguem as decisões da Documentação Mestre, especialmente seções 18–22, 25, 28, 33 e 37.

Este arquivo é uma diretriz de contribuição, **não** comprovação de implementação de segurança.
