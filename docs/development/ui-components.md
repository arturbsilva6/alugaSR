# FE-003 — Shell responsivo e componentes comuns

**Issue:** [#9 — MVP-004 / FE-003](https://github.com/arturbsilva6/alugaSR/issues/9)  
**Estado:** implementação em PR de revisão, não disponível em produção e sem merge automático.  
**Referência:** [Documentação Mestre do AlugaSR](https://docs.google.com/document/d/1VmYP60hxvBttjdqYjix0kIa2ybdb3GPq3oywSATzlPg/edit), seções 10, 33–38; UI/UX v1.3.2.  
**Dependência:** FE-002 integrado na main pelo PR #8.

## Objetivo e limites

Entregar o *shell* público (header, navegação, conteúdo principal e rodapé) e os componentes HTML/CSS compartilhados. Esta etapa **não cria a Home funcional**: pesquisa, filtros e detalhes são FE-004/FE-005/FE-006. Não há backend de domínio, autenticação, ações de anúncio ou dados reais.

## Arquivos

- \`frontend/styles/components.css\` — navegação responsiva, footer, layout fluido, botões extras, estados de campo/chip, mensagens, vazio, carregamento e modal.
- \`frontend/styles/main.css\` — importa a nova folha sem duplicar tokens. Páginas anteriores continuam usando \`tokens.css\` e \`base.css\`.
- \`frontend/index.html\` — continua provisória e preserva o aviso exigido pelo teste de fundação.
- \`frontend/design-system.html\` — preserva a vitrine da Etapa 2, com shell compartilhado.
- \`frontend/componentes.html\` — vitrine estática de componentes, dados fictícios e um modal demonstrativo.
- \`frontend/scripts/ui.js\` — inicialização de \`<dialog>\` nativo e retorno do foco ao botão acionador; não há ações de negócio.
- \`frontend/scripts/main.js\` — inicializa apenas comportamento da demonstração e ano do rodapé.
- \`tests/ui-components.test.js\` — testes de semântica HTML, navegação, tokens, componentes e comportamento de modal com eventos simulados.

## Padrões aplicados

1. HTML semântico: \`header\`, \`nav\`, \`main\`, \`footer\`, salto ao conteúdo por teclado e \`aria-current="page"\` somente na rota atual.
2. Em telas de 640 px ou menores, a navegação se reorganiza sem menus que dependam de JavaScript. Componentes utilizam flex/grid fluido, com proteção contra texto longo.
3. Botões, campos e navegação respeitam alvo mínimo do token \`--control-min-height: 2.75rem\` (44 px em zoom padrão de 16 px) e foco \`:focus-visible\`.
4. Estados exemplificados: \`disabled\`, \`aria-invalid\` + texto de erro associado, \`role="status"\` para carregamento, avisos e estado vazio.
5. O modal é **demonstração**. O elemento \`<dialog>\` lida nativamente com Esc e gerenciamento de foco; o script restaura o foco ao acionador ao fechar. Não existe modal de login.
6. Animações são removidas para \`prefers-reduced-motion: reduce\`; não são geradas imagens ou scripts remotos.
7. Não há hexadecimais fora de \`tokens.css\`. A paleta continua provisória (UI-02); a logo original continua pendente (UI-01).

## Como conferir

Na raiz do repositório:

\`\`\`sh
npm ci
npm run lint
npm test
npm run db:validate
\`\`\`

A vitrine está em \`frontend/componentes.html\`, acessível a partir de \`frontend/index.html\` e \`frontend/design-system.html\`. Para testes com servidor estático, pode-se servir apenas \`frontend/\` em uma porta local sem expor API ou credenciais. A página é \`noindex,nofollow\`; textos sinalizam demonstração.

## Aceite e pendências

- [ ] GitHub Actions de governança e fundação em verde, com testes novos e regressão anterior.
- [ ] Testes manuais em 320, 390, 768 e 1440 px, além de zoom 200%; conferir ausência de sobreposição, rolagem horizontal e perda de conteúdo.
- [ ] Teclado: Tab, Shift+Tab, Enter e Esc; foco retorna ao botão que abriu o modal; links e campos rotulados.
- [ ] Validação com leitor de tela e análise de contraste de todos os estados; **não afirmar WCAG 2.2 AA antes desses testes**.
- [ ] Revisão e merge do PR por responsável, sem publicação ou implantação com dados reais.

**Próxima entrega:** FE-004 — Home pública com dados sintéticos e visual da baseline v1.3.2. Os contratos de dados e a geografia dependem das decisões da Documentação Mestre. Não incluir chat, favoritos ou verificação real sem aprovação de escopo.
