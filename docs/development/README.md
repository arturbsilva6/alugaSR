# Engenharia e desenvolvimento

A [Documentação Mestre do AlugaSR](https://docs.google.com/document/d/1VmYP60hxvBttjdqYjix0kIa2ybdb3GPq3oywSATzlPg/edit) (seção 37) governa requisitos, escopo, DoR/DoD, rastreabilidade, branches e releases.

## Escopo acadêmico
- Pesquisa pública responsiva por valor, cômodos e localização em São Roque/SP.
- Banco relacional com usuários, imóveis, imobiliárias e tabelas de apoio.
- Painel restrito do parceiro para descrição, fotos e publicação com fluxo autorizado.

Chat, favoritos, reputação e mapas avançados são pós-MVP salvo alteração formal de escopo.

## Estado de implantação
Este repositório está em preparação. O workflow `governance.yml` verifica arquivos básicos, não build, API, banco, dependências, segurança de aplicação ou testes de usuário. MVP-001/MVP-002 definirão versões, scripts e novos checks. Não confundir CI documental com homologação de produto.

## Rastreabilidade
Use ID nas issues e títulos de PRs; inclua requisito, decisão, dependência, testes executados e evidências. Não registrar informações pessoais sensíveis ou dados reais no repositório público.

## Design System (MVP-003 / FE-002)

A implementação inicial dos tokens e componentes visuais está documentada em [design-system.md](design-system.md). A vitrine local é `frontend/design-system.html` e funciona apenas como demonstração, sem dados reais ou integração com API.

A paleta ainda depende da homologação UI-02 e o logo original está pendente (UI-01). Não considerar a vitrine como frontend funcional ou como prova completa de acessibilidade.
