# AlugaSR — Demonstração integrada do MVP acadêmico (FE-003 a FE-006)

**Status:** implementação em branch para revisão; não é versão de produção.  
**Origem visual:** protótipo UI/UX **v1.3.2**, com suas ilustrações SVG originais.  
**Referência normativa:** [Documentação Mestre](https://docs.google.com/document/d/1VmYP60hxvBttjdqYjix0kIa2ybdb3GPq3oywSATzlPg/edit), especialmente DEC-003 e seções 33–39.  
**Issue:** [#11](https://github.com/arturbsilva6/alugaSR/issues/11), base FE-003 da issue #9.

## Telas incluídas

- `frontend/index.html` — Home com hero, busca pública, categorias e destaques fictícios.
- `frontend/imoveis.html` — filtros combinados por região ilustrativa, tipo, aluguel máximo e quartos; ordenação, paginação, resultados vazios e limpeza de filtros.
- `frontend/imovel.html` — detalhe ilustrativo de imóvel, custos discriminados, total condicional, características e retorno preservando filtros.
- `frontend/como-anunciar.html` — seleção de fluxo de proprietário direto ou imobiliária parceira, somente simulação.
- `frontend/painel.html` — rascunhos em memória, edição, validação e transição simulada para “Em análise”, sem publicação.
- `frontend/seguranca.html` — informações transparentes sobre privacidade, limites da demonstração, localização e ausência de pagamentos.
- `frontend/design-system.html` e `frontend/componentes.html` — vitrines técnicas preservadas.
- `frontend/assets/*.svg` — três ilustrações aprovadas como **referências fictícias**, sem fotos reais nem EXIF.

## Comportamentos

A busca do HTML navega por GET com parâmetros locais **não sensíveis** (`regiao`, `tipo`, `ate`, `quartos`, `ordem`, `pagina`). Um módulo JS valida/normaliza as opções, filtra o conjunto estático `DEMO_LISTINGS`, ordena e pagina em blocos de três. O detalhamento guarda os filtros em `voltar`, que é normalizado novamente em vez de aceitar links externos. Nenhuma informação de endereço completo, latitude/longitude, telefone, usuário ou documento está no fixture.

O total mensal é somado apenas quando aluguel, condomínio e IPTU forem números conhecidos, não negativos e de periodicidade mensal. Ausência ou diferença de periodicidade deve renderizar **“A confirmar”**, nunca inventar zero.

O painel em `painel.html` **não tem autenticação nem autorização**. A seleção de perfil por URL muda somente o texto. Rascunhos e filas são elementos em memória temporária, sem `localStorage`, API, credenciais, fotos ou persistência. “Enviar para análise” só muda um estado local, não publica. O upload é explicitamente desabilitado. Formulários de exemplo não recebem dados reais.

O botão de contato no detalhe abre um diálogo explicativo. **Não há conversa, login, favoritos ou reserva funcional.** Estes fluxos são pós-MVP acadêmico e dependem de backend com acesso autorizado.

## Como visualizar

Com o repositório atualizado, é possível abrir `frontend/index.html` diretamente em navegador que aceite módulos ES em arquivos locais. Caso o navegador restrinja módulos em `file://`, use servidor estático **local**:

```sh
cd frontend
python -m http.server 8080 --bind 127.0.0.1
```

Acesse `http://127.0.0.1:8080/index.html`. Esse comando não publica o site na internet.

## Qualidade

- `npm ci`, `npm run lint`, `npm test`, `npm run db:validate` usam o pipeline já existente.
- Os testes cobrem projeção sintética dos dados, filtro/ordem/paginação, custo mensal conhecido/desconhecido, segurança das URLs de retorno, validação de rascunhos e compatibilidade do frontend antigo.
- **Pendente de inspeção manual:** 320/390/768/1440 px, zoom 200%, teclado e leitor de tela; evidências e resultados devem ser anexados ao PR quando executados.
- O status “0 falhas no CI” valida os testes executados, não prova ausência de bugs, segurança de produção ou homologação WCAG/LGPD.

## Pendências para transformar em aplicativo real

1. UI-01/UI-02: logo original e paleta/fonte final aprovadas.
2. EXT-01: catálogo de bairros validado para São Roque.
3. MVP-007/008: modelo físico PostgreSQL/Prisma, migrations, API e dados de anúncio com autorização.
4. MVP-009..014: sessões seguras, papéis, vínculo com imóvel, processamento de fotos e moderação auditável.
5. Testes humanos, acessibilidade, conformidade e controles LGPD antes do uso de dados verdadeiros.

**Nunca** promover o estado sintético do painel como autorização real. Nenhuma foto ou documento privado deve ser enviado a esta demonstração.
