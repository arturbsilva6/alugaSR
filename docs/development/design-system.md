# Design System no código — AlugaSR (MVP-003 / FE-002)

**Status:** implementação inicial em branch de revisão, **não homologada** e sem merge confirmado.  
**Base:** [Documentação Mestre](https://docs.google.com/document/d/1VmYP60hxvBttjdqYjix0kIa2ybdb3GPq3oywSATzlPg/edit), especialmente seções 10, 33, 34, 35 e 36; baseline visual UI/UX v1.3.2.  
**Rastreabilidade:** [issue #7](https://github.com/arturbsilva6/alugaSR/issues/7); FE-002 e FE-017; UI-01/UI-02.

## O que foi implementado

- \`frontend/styles/tokens.css\`: variáveis semânticas para cores, fontes, espaçamento, raio, foco e dimensões mínimas de controle.
- \`frontend/styles/base.css\`: reset leve, regras tipográficas, acessibilidade básica e componentes \`.button\`, \`.field\`, \`.chip\`, \`.card\` e \`.notice\`.
- \`frontend/styles/main.css\`: importa os dois módulos e estiliza apenas a estrutura provisória e a prévia.
- \`frontend/design-system.html\`: catálogo de demonstração local, sem API, dados reais ou ações de negócio.
- \`tests/design-system.test.js\`: verificações estáticas, rastreabilidade dos tokens e contraste matemático de pares críticos.

## Identidade visual — decisão ainda pendente

A seção **10.2** do documento mestre traz a proposta de **vermelho da marca \`#E30613\`**, **preto \`#171717\`** e **amarelo \`#FFC83D\`**. As telas v1.3.2 adotaram **\`#B42318\`** nas ações, enquanto a seção 34 registra também a variante histórica **\`#C62828\`**. Esta etapa não escolhe uma das cores como identidade oficial. Na implementação:

| Token | Valor provisório | Fonte / uso |
| --- | --- | --- |
| \`--color-brand-red\` | \`#E30613\` | Proposta de assinatura da marca na seção 10 |
| \`--color-action-primary\` | \`#B42318\` | Botões, ações e links conforme mockup v1.3.2 |
| \`--color-brand-yellow\` | \`#FFC83D\` | Apoio sem texto branco, proposta da seção 10 |
| \`--color-text\` | \`#171717\` | Textos principais |
| \`--color-page\` | \`#F7F7F5\` | Fundo |
| \`--color-focus\` | \`#1D4ED8\` | Indicador de foco por teclado |

**UI-02 permanece aberta:** a decisão final requer aprovação explícita, atualização do Google Docs e ajuste centralizado dos tokens. O logotipo aprovado (A em forma de casa vermelho + SR preto) **não foi recriado**; falta arte original aprovada (UI-01).

## Tipografia

A seção 10.3 propõe **Sora Bold para títulos e Inter para texto comum**. A seção 34 usa Inter como referência geral. Para evitar fontes não licenciadas ou requisições externas, os tokens apenas declaram famílias com fallbacks de sistema; nenhum arquivo de fonte foi distribuído ou baixado. O resultado visual precisa ser inspecionado novamente quando as fontes autorizadas forem incorporadas.

## Uso local e testes

Após \`npm ci\` na raiz, os comandos existentes continuam válidos:

\`\`\`sh
npm run lint
npm test
npm run check
\`\`\`

Abra \`frontend/design-system.html\` em navegador local (ou via um servidor estático de desenvolvimento). A página permanece com \`noindex, nofollow\`, é demonstrativa e não envia dados. O endpoint HTTP existente continua independente dessas alterações.

O teste Node compara combinações críticas de cores com o requisito matemático mínimo de 4,5:1, identifica referências a tokens inexistentes e verifica elementos básicos de acessibilidade. **Isso não substitui auditoria WCAG**, teste visual em Chromium ou revisão com leitor de tela.

## Critérios pendentes para conclusão

- [ ] UI-01: adicionar a arte original da logo, com autorização e versões.
- [ ] UI-02: homologar paleta e tipografia finais, atualizar tokens e documentação mestre.
- [ ] Executar teste real da prévia em 320/390/768/1440 px e zoom 200%.
- [ ] Validar foco/teclado e uso com leitor de tela.
- [ ] Aprovar PR após CI e revisão manual; sem merge automático.
- [ ] Avançar para FE-003 (componentes comuns reais) e FE-004 (Home) apenas na etapa seguinte.

Esta implementação não inclui chat, favoritos, reputação, cadastro de anúncios, banco, API de imóveis nem selos reais, conforme DEC-003.
