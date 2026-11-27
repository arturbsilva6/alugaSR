// Seed SOMENTE SINTÉTICO e idempotente (Gate C0; seções 28.3, 33.6, 37.11).
// Nenhum dado pessoal, endereço, telefone ou imóvel real. Fotos são ilustrativas de banco
// de imagens com licença registrada em CREDITOS-IMAGENS.md (UI-03). E-mails usam o domínio
// reservado .test. Bairros são rótulos ilustrativos — o catálogo oficial de
// São Roque depende de EXT-01 e NÃO é afirmado aqui.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createPrisma } from "../backend/src/db/prisma.js";
import { hashPassword } from "../backend/src/lib/password.js";
import { createLocalStorage } from "../backend/src/storage/localStorage.js";
import { processImage } from "../backend/src/media/imageProcessor.js";

if (process.env.NODE_ENV === "production") {
  console.error("Seed sintético bloqueado em produção.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Defina DATABASE_URL (banco de desenvolvimento ou teste).");
  process.exit(1);
}

// UUID determinístico (formato v5) para tornar o seed idempotente.
export function seedId(name) {
  const h = createHash("sha1").update(`alugasr-seed:${name}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

const SOURCE = "Catálogo SINTÉTICO de demonstração — não validado (EXT-01)";
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "AlugaSR-demo-2026";
const prisma = createPrisma(process.env.DATABASE_URL, { max: 2 });
const storage = createLocalStorage(process.env.STORAGE_LOCAL_DIR || ".storage");

const neighborhoods = [
  ["centro-exemplo", "Centro (exemplo)"],
  ["regiao-ilustrativa-norte", "Região ilustrativa Norte"],
  ["regiao-ilustrativa-sul", "Região ilustrativa Sul"]
];
const types = [["casa", "Casa"], ["apartamento", "Apartamento"], ["sobrado", "Sobrado"], ["kitnet", "Kitnet"]];
const features = [
  ["area-de-servico", "Área de serviço", "comodidade"], ["quintal", "Quintal", "area-externa"],
  ["vaga-coberta", "Vaga coberta", "garagem"], ["aceita-pets", "Aceita animais de estimação", "regras"],
  ["mobiliado", "Mobiliado", "comodidade"], ["varanda", "Varanda", "area-externa"]
];

const users = [
  { key: "admin", nome: "Administração Demo (fictícia)", email: "admin@alugasr.test", roles: ["usuario", "administrador"] },
  { key: "moderador", nome: "Moderação Demo (fictícia)", email: "moderador@alugasr.test", roles: ["usuario", "moderador"] },
  { key: "imobiliaria", nome: "Responsável Imobiliária Exemplo (fictício)", email: "imobiliaria@alugasr.test", roles: ["usuario"] },
  { key: "atendente", nome: "Atendente Imobiliária Exemplo (fictício)", email: "atendente@alugasr.test", roles: ["usuario"] },
  { key: "proprietario", nome: "Proprietário Exemplo (fictício)", email: "proprietario@alugasr.test", roles: ["usuario"] },
  { key: "pendente", nome: "Proprietário Pendente (fictício)", email: "proprietario.pendente@alugasr.test", roles: ["usuario"] }
];

// Conteúdo derivado das fixtures sintéticas do PR #12 (frontend/scripts/fixtures.js).
const listings = [
  { key: "demo-001", owner: "agency", status: "publicado", title: "Casa térrea próxima ao centro e serviços (fictícia)", type: "casa", hood: "centro-exemplo",
    rent: "1850.00", condo: "0.00", iptu: "95.00", bedrooms: 3, bathrooms: 2, parking: 1, area: "92.00", photos: ["casa-entardecer", "sala-de-estar", "cozinha-integrada"], features: ["area-de-servico", "quintal"],
    description: "Casa ilustrativa com ambientes integrados e fácil acesso aos serviços da região central. Anúncio FICTÍCIO para demonstração acadêmica: não é uma oferta real." },
  { key: "demo-002", owner: "agency", status: "publicado", title: "Apartamento bem iluminado (fictício)", type: "apartamento", hood: "regiao-ilustrativa-norte",
    rent: "1650.00", condo: null, iptu: "0.00", bedrooms: 2, bathrooms: 1, parking: 1, area: "64.00", photos: ["sala-de-estar", "predio-apartamentos"], features: ["vaga-coberta"],
    description: "Apartamento fictício com dois dormitórios. O condomínio não foi informado, portanto o total mensal aparece como 'a confirmar'. Não é uma oferta real." },
  { key: "demo-003", owner: "individual", status: "publicado", title: "Sobrado com área externa (fictício)", type: "sobrado", hood: "regiao-ilustrativa-sul",
    rent: "2850.00", condo: "0.00", iptu: "170.00", bedrooms: 3, bathrooms: 2, parking: 2, area: "130.00", photos: ["casa-entardecer", "interior-corredor", "cozinha-integrada"], features: ["quintal", "varanda", "aceita-pets"],
    description: "Sobrado demonstrativo com dois pavimentos e espaço ao ar livre. Dados sintéticos para testes de interface; não está disponível para locação." },
  { key: "demo-004", owner: "individual", status: "publicado", title: "Casa compacta para começar uma nova fase (fictícia)", type: "casa", hood: "centro-exemplo",
    rent: "1200.00", condo: "0.00", iptu: null, bedrooms: 1, bathrooms: 1, parking: 0, area: "45.00", photos: ["casa-entardecer", "cozinha-integrada"], features: [],
    description: "Casa compacta de demonstração para validar filtros por faixa de preço e quantidade de cômodos. Anúncio fictício." },
  { key: "demo-005", owner: "agency", status: "publicado", title: "Apartamento com dois quartos (fictício)", type: "apartamento", hood: "centro-exemplo",
    rent: "2100.00", condo: "220.00", iptu: "90.00", bedrooms: 2, bathrooms: 2, parking: 1, area: "78.00", photos: ["interior-corredor", "cozinha-integrada", "predio-apartamentos"], features: ["area-de-servico", "vaga-coberta", "mobiliado"],
    description: "Apartamento fictício que ilustra a composição completa de aluguel, condomínio e IPTU quando todos os valores são conhecidos." },
  { key: "demo-006", owner: "agency", status: "publicado", title: "Sobrado para quem busca mais espaço (fictício)", type: "sobrado", hood: "regiao-ilustrativa-norte",
    rent: "3200.00", condo: "0.00", iptu: "150.00", bedrooms: 4, bathrooms: 3, parking: 2, area: "160.00", photos: ["casa-entardecer", "sala-de-estar", "interior-corredor"], features: ["quintal", "varanda"],
    description: "Exemplo acadêmico de imóvel amplo. Não é um anúncio publicado por proprietário ou imobiliária real." },
  { key: "demo-007", owner: "agency", status: "em_analise", title: "Kitnet mobiliada aguardando análise (fictícia)", type: "kitnet", hood: "centro-exemplo",
    rent: "950.00", condo: "80.00", iptu: "0.00", bedrooms: 1, bathrooms: 1, parking: 0, area: "28.00", photos: ["cozinha-integrada", "interior-corredor"], features: ["mobiliado"],
    description: "Anúncio sintético enviado para análise, usado para demonstrar a fila de moderação. Não aparece na busca pública." },
  { key: "demo-008", owner: "agency", status: "rascunho", title: "Rascunho de casa em preparação (fictício)", type: "casa", hood: "regiao-ilustrativa-sul",
    rent: null, condo: null, iptu: null, bedrooms: null, bathrooms: null, parking: null, area: null, photos: [], features: [],
    description: null },
  { key: "demo-009", owner: "individual", status: "pausado", title: "Apartamento pausado pelo titular (fictício)", type: "apartamento", hood: "regiao-ilustrativa-sul",
    rent: "1400.00", condo: "150.00", iptu: "40.00", bedrooms: 2, bathrooms: 1, parking: 1, area: "55.00", photos: ["sala-de-estar", "predio-apartamentos"], features: [],
    description: "Anúncio sintético pausado: não aparece na busca e o link antigo informa indisponibilidade." }
];

// Fotos ILUSTRATIVAS de banco de imagens (licença Unsplash, ver CREDITOS-IMAGENS.md):
// não retratam imóveis reais de São Roque nem os anúncios fictícios. Passam pelo
// mesmo pipeline de upload (reprocessamento sem metadados) antes de virar derivado.
const PHOTO_ALT = {
  "casa-entardecer": "Foto ilustrativa de fachada de casa (banco de imagens, não é o imóvel anunciado)",
  "predio-apartamentos": "Foto ilustrativa de prédio residencial (banco de imagens, não é o imóvel anunciado)",
  "sala-de-estar": "Foto ilustrativa de sala de estar (banco de imagens, não é o imóvel anunciado)",
  "cozinha-integrada": "Foto ilustrativa de cozinha integrada (banco de imagens, não é o imóvel anunciado)",
  "interior-corredor": "Foto ilustrativa de interior de apartamento (banco de imagens, não é o imóvel anunciado)"
};

async function syntheticPhotos(names, propertyId) {
  // Fotos de versões anteriores do seed (ilustrações SVG e ordem antiga) são
  // retiradas por remoção lógica; fotos enviadas pelo painel não são tocadas.
  const current = new Set(names.map(name => seedId(`foto-v3:${propertyId}:${name}`)));
  const legacy = [seedId(`foto:${propertyId}:0`), ...[0, 1, 2].map(i => seedId(`foto-v2:${propertyId}:${i}`))].filter(id => !current.has(id));
  await prisma.fotoImovel.updateMany({
    where: { id: { in: legacy }, excluidoEm: null },
    data: { principal: false, statusProcessamento: "removido", excluidoEm: new Date() }
  });
  for (const [index, name] of names.entries()) {
    const photoId = seedId(`foto-v3:${propertyId}:${name}`);
    const source = await readFile(new URL(`../frontend/assets/fotos/${name}.webp`, import.meta.url));
    const processed = await processImage(source, { declaredType: "image/webp" });
    for (const [variant, data] of Object.entries(processed.derived)) {
      const key = `derived/${photoId}/${variant}.webp`;
      if (!(await storage.exists(key))) await storage.put(key, data);
    }
    if (!(await storage.exists(`originals/${photoId}`))) await storage.put(`originals/${photoId}`, source);
    const existing = await prisma.fotoImovel.findUnique({ where: { id: photoId }, select: { id: true } });
    if (!existing) {
      await prisma.fotoImovel.create({ data: {
        id: photoId, imovelId: propertyId, chaveArmazenamento: `originals/${photoId}`, ordem: index, principal: index === 0,
        textoAlternativo: PHOTO_ALT[name], statusProcessamento: "aprovado",
        mimeTypeValidado: "image/webp", tamanhoBytes: BigInt(source.length), hashConteudo: processed.sha256
      } });
    }
  }
}

async function main() {
  for (const [slug, nome] of neighborhoods) {
    await prisma.bairro.upsert({ where: { slug }, create: { id: seedId(`bairro:${slug}`), slug, nome, fonteDados: SOURCE }, update: { nome, fonteDados: SOURCE } });
  }
  for (const [slug, nome] of types) {
    await prisma.tipoImovel.upsert({ where: { slug }, create: { id: seedId(`tipo:${slug}`), slug, nome }, update: { nome } });
  }
  for (const [slug, nome, categoria] of features) {
    await prisma.caracteristica.upsert({ where: { slug }, create: { id: seedId(`carac:${slug}`), slug, nome, categoria }, update: { nome, categoria } });
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const ids = {};
  for (const u of users) {
    const id = seedId(`usuario:${u.key}`);
    ids[u.key] = id;
    await prisma.usuario.upsert({
      where: { id }, create: { id, nome: u.nome, email: u.email, status: "ativo", emailVerificadoEm: new Date() },
      update: { nome: u.nome, status: "ativo" }
    });
    await prisma.contaAutenticacao.upsert({
      where: { usuarioId_provedor: { usuarioId: id, provedor: "local" } },
      create: { usuarioId: id, provedor: "local", senhaHash: passwordHash }, update: { senhaHash: passwordHash }
    });
    for (const papel of u.roles) {
      await prisma.papelUsuario.upsert({ where: { usuarioId_papel: { usuarioId: id, papel } }, create: { usuarioId: id, papel }, update: {} });
    }
  }

  const agencyId = seedId("imobiliaria:exemplo");
  await prisma.imobiliaria.upsert({
    where: { id: agencyId },
    // Status interno "verificado" apenas para a demonstração do fluxo; nenhum selo público é exibido (EXT-03).
    create: { id: agencyId, nomeComercial: "Imobiliária Exemplo (fictícia)", status: "verificado", criadoPorUsuarioId: ids.imobiliaria,
      descricao: "Organização sintética para demonstração acadêmica." },
    update: { nomeComercial: "Imobiliária Exemplo (fictícia)", status: "verificado" }
  });
  for (const [key, papel] of [["imobiliaria", "responsavel"], ["atendente", "atendente"]]) {
    await prisma.membroImobiliaria.upsert({
      where: { imobiliariaId_usuarioId: { imobiliariaId: agencyId, usuarioId: ids[key] } },
      create: { imobiliariaId: agencyId, usuarioId: ids[key], papel, status: "ativo", aceitoEm: new Date() },
      update: { papel, status: "ativo" }
    });
  }
  const advertiserId = seedId("anunciante:proprietario");
  await prisma.anunciante.upsert({
    where: { usuarioId: ids.proprietario },
    create: { id: advertiserId, usuarioId: ids.proprietario, nomeExibicao: "Proprietário Exemplo (fictício)", statusVerificacao: "verificado" },
    update: { statusVerificacao: "verificado" }
  });
  await prisma.anunciante.upsert({
    where: { usuarioId: ids.pendente },
    create: { id: seedId("anunciante:pendente"), usuarioId: ids.pendente, nomeExibicao: "Proprietário Pendente (fictício)", statusVerificacao: "pendente" },
    update: { statusVerificacao: "pendente" }
  });

  const base = Date.parse("2026-11-01T12:00:00Z");
  for (const [i, l] of listings.entries()) {
    const id = seedId(`imovel:${l.key}`);
    if (await prisma.imovel.findUnique({ where: { id }, select: { id: true } })) continue;
    const endereco = await prisma.endereco.create({
      // Endereço propositalmente incompleto e fictício; nunca retornado na API pública.
      data: { id: seedId(`endereco:${l.key}`), bairroId: seedId(`bairro:${l.hood}`), logradouro: "Rua Fictícia de Demonstração", numero: "S/N" },
      select: { id: true }
    });
    const owner = l.owner === "agency" ? { imobiliariaId: agencyId } : { anuncianteId: advertiserId };
    const creator = l.owner === "agency" ? ids.imobiliaria : ids.proprietario;
    const published = ["publicado", "pausado"].includes(l.status) ? new Date(base + i * 3_600_000) : null;
    await prisma.imovel.create({ data: {
      id, ...owner, criadoPorUsuarioId: creator, atualizadoPorUsuarioId: creator, enderecoId: endereco.id,
      tipoImovelId: seedId(`tipo:${l.type}`), titulo: l.title, descricao: l.description,
      valorAluguel: l.rent, valorCondominio: l.condo, valorIptu: l.iptu, areaM2: l.area,
      quartos: l.bedrooms, banheiros: l.bathrooms, vagasGaragem: l.parking, status: l.status, publicadoEm: published,
      caracteristicas: { create: l.features.map(slug => ({ caracteristicaId: seedId(`carac:${slug}`) })) }
    } });
    await prisma.logAuditoria.create({ data: { atorId: null, acao: "property.create", tipoRecurso: "imovel", recursoId: id, metadados: { para: l.status, origem: "seed_sintetico" } } });
  }
  for (const l of listings) if (l.photos.length) await syntheticPhotos(l.photos, seedId(`imovel:${l.key}`));

  const counts = { bairros: await prisma.bairro.count(), usuarios: await prisma.usuario.count(), imoveis: await prisma.imovel.count(), fotos: await prisma.fotoImovel.count() };
  console.info("Seed sintético concluído:", JSON.stringify(counts));
}

try { await main(); }
finally { await prisma.$disconnect(); }
