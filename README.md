# AlugaSR

Plataforma web hiperlocal para busca e divulgação de imóveis para aluguel em **São Roque/SP**, desenvolvida como projeto de extensão acadêmica.

> **Status:** planejamento e fundação do repositório. Não existe aplicação funcional, sistema de login, banco conectado ou serviço de imóveis disponível para uso público nesta etapa.

## Escopo do MVP acadêmico
1. Home e pesquisa responsivas por valor de aluguel, cômodos e localização.
2. Modelo relacional com usuários, imóveis, imobiliárias e tabelas necessárias ao MVP.
3. Painel restrito do parceiro para criar descrição, inserir fotos e submeter anúncios à publicação autorizada.

Chat, favoritos, reputação, selos de verificação e mapa avançado não integram o MVP acadêmico atual. Não processamos pagamentos nem contratos locatícios.

## Stack prevista
HTML, CSS e JavaScript no frontend; Node.js + Express na API; PostgreSQL + Prisma para persistência. As versões exatas e os scripts de instalação serão definidos e testados em MVP-001/MVP-002.

## Documentação e contribuição
- [Documentação Mestre do AlugaSR (Google Docs)](https://docs.google.com/document/d/1VmYP60hxvBttjdqYjix0kIa2ybdb3GPq3oywSATzlPg/edit) — consultar principalmente as seções 33 e 37.
- [Guia de contribuição](CONTRIBUTING.md).
- [Política de segurança](SECURITY.md).
- [Plano de desenvolvimento do repositório](docs/development/README.md).
- [Issues e backlog](https://github.com/arturbsilva6/alugaSR/issues).

## Segurança e dados
Somente dados sintéticos nos protótipos e testes. Nunca fazer commit de credenciais, arquivos `.env` reais, documentos pessoais ou fotos privadas. A ativação com dados reais requer segurança, LGPD, backups/restauração e validações externas descritas na documentação mestre.

## Estado dos testes
O primeiro workflow verifica apenas a estrutura documental e regras mínimas de Git. **Não equivale a CI de aplicação, testes de backend, segurança implementada ou homologação acadêmica.**

## Referência visual em implementação (FE-002)

A branch de Design System propõe tokens CSS, estilos-base e uma [vitrine de componentes](frontend/design-system.html), com [decisões e pendências registradas](docs/development/design-system.md). Essa página é demonstrativa e não oferece busca de imóveis, autenticação ou anúncios reais. A identidade visual final depende da aprovação da paleta e da incorporação do logotipo original.

## Componentes de interface (FE-003)

A vitrine [componentes.html](frontend/componentes.html) demonstra cabeçalho, navegação, rodapé, campos e estados da interface. É **estática e sem dados reais**, não uma Home de anúncios. Veja os [critérios de implementação](docs/development/ui-components.md).
