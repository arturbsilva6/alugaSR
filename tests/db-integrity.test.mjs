import test from "node:test";
import assert from "node:assert/strict";
import { fixtures, skipWithoutDb, testPrisma, suffix } from "./helpers/db.mjs";

// DB-001/DB-002/DB-003/MOD-CT02/PHY-03/PHY-05: restrições exercitadas no PostgreSQL real.
const prisma = skipWithoutDb.skip ? null : testPrisma();
const f = prisma && fixtures(prisma);
test.after(async () => { await prisma?.$disconnect(); });

async function rejects(promise, pattern) {
  await assert.rejects(promise, e => pattern.test(String(e.message) + JSON.stringify(e.meta ?? {})));
}

test("e-mail único sem diferenciar maiúsculas e exigido normalizado", skipWithoutDb, async () => {
  const s = suffix();
  await prisma.usuario.create({ data: { nome: "A", email: `dup.${s}@exemplo.test` } });
  await rejects(prisma.$executeRaw`INSERT INTO usuarios (nome, email) VALUES ('B', ${`DUP.${s}@exemplo.test`})`, /usuarios_email_normalizado_check|23514/);
  await rejects(prisma.usuario.create({ data: { nome: "B", email: `dup.${s}@exemplo.test` } }), /Unique|usuarios_email_lower_key|P2002/);
  await rejects(prisma.usuario.create({ data: { nome: "C", email: `c.${s}@exemplo.test`, status: "admin" } }), /usuarios_status_check|check/i);
});

test("imóvel exige exatamente um titular (anunciante XOR imobiliária)", skipWithoutDb, async () => {
  const u = await f.user();
  const adv = await f.advertiser(u);
  const ag = await f.agency(u);
  await rejects(prisma.imovel.create({ data: { criadoPorUsuarioId: u.id } }), /imoveis_titular_unico_check|check/i);
  await rejects(prisma.imovel.create({ data: { criadoPorUsuarioId: u.id, anuncianteId: adv.id, imobiliariaId: ag.id } }), /imoveis_titular_unico_check|check/i);
  const ok = await prisma.imovel.create({ data: { criadoPorUsuarioId: u.id, anuncianteId: adv.id } });
  assert.equal(ok.status, "rascunho");
});

test("rascunho incompleto é permitido; análise/publicação exigem campos mínimos e aluguel > 0", skipWithoutDb, async () => {
  const u = await f.user();
  const adv = await f.advertiser(u);
  const { bairro, tipo } = await f.catalog();
  const draft = await prisma.imovel.create({ data: { criadoPorUsuarioId: u.id, anuncianteId: adv.id, valorAluguel: "0.00" } });
  await rejects(prisma.imovel.update({ where: { id: draft.id }, data: { status: "em_analise" } }), /campos_minimos|check/i);
  await rejects(prisma.imovel.create({ data: { criadoPorUsuarioId: u.id, anuncianteId: adv.id, valorAluguel: "-1.00" } }), /imoveis_valores_check|check/i);
  await rejects(prisma.imovel.create({ data: { criadoPorUsuarioId: u.id, anuncianteId: adv.id, quartos: -1 } }), /imoveis_contadores_check|check/i);
  await rejects(prisma.imovel.create({ data: { criadoPorUsuarioId: u.id, anuncianteId: adv.id, status: "vendido" } }), /imoveis_status_check|check/i);
  const p = await f.property({ owner: adv, creator: u, bairro, tipo, status: "rascunho" });
  await rejects(prisma.imovel.update({ where: { id: p.id }, data: { status: "publicado" } }), /imoveis_publicado_em_check|check/i);
  await rejects(prisma.imovel.update({ where: { id: p.id }, data: { status: "em_analise", valorAluguel: "0.00" } }), /campos_minimos|check/i);
});

test("endereço restrito a São Roque/SP e coordenadas em par válido", skipWithoutDb, async () => {
  const { bairro } = await f.catalog();
  await rejects(prisma.endereco.create({ data: { bairroId: bairro.id, municipio: "Sorocaba" } }), /enderecos_municipio_check|check/i);
  await rejects(prisma.endereco.create({ data: { bairroId: bairro.id, uf: "RJ" } }), /enderecos_uf_check|check/i);
  await rejects(prisma.endereco.create({ data: { bairroId: bairro.id, latitude: "-23.5" } }), /coordenadas_par|check/i);
  await rejects(prisma.endereco.create({ data: { bairroId: "00000000-0000-4000-8000-000000000000" } }), /Foreign key|P2003|fkey/i);
});

test("capa única entre fotos aprovadas ativas; removidas não bloqueiam nova capa", skipWithoutDb, async () => {
  const u = await f.user();
  const adv = await f.advertiser(u);
  const im = await prisma.imovel.create({ data: { criadoPorUsuarioId: u.id, anuncianteId: adv.id } });
  const key = () => `originals/${crypto.randomUUID()}`;
  await prisma.fotoImovel.create({ data: { imovelId: im.id, chaveArmazenamento: key(), principal: true, statusProcessamento: "aprovado" } });
  await rejects(prisma.fotoImovel.create({ data: { imovelId: im.id, chaveArmazenamento: key(), principal: true, statusProcessamento: "aprovado" } }), /capa_unica|Unique|P2002/);
  await rejects(prisma.fotoImovel.create({ data: { imovelId: im.id, chaveArmazenamento: key(), principal: true, statusProcessamento: "pendente" } }), /principal_aprovada|check/i);
  await prisma.fotoImovel.updateMany({ where: { imovelId: im.id }, data: { principal: false, statusProcessamento: "removido", excluidoEm: new Date() } });
  await prisma.fotoImovel.create({ data: { imovelId: im.id, chaveArmazenamento: key(), principal: true, statusProcessamento: "aprovado" } });
  await rejects(prisma.fotoImovel.create({ data: { imovelId: im.id, chaveArmazenamento: key(), mimeTypeValidado: "image/svg+xml" } }), /fotos_imoveis_mime_check|check/i);
});

test("membro único por imobiliária, papéis/estados fechados e CNPJ normalizado", skipWithoutDb, async () => {
  const u = await f.user();
  const ag = await f.agency(u);
  await f.member(ag, u, "responsavel");
  await rejects(f.member(ag, u, "gestor"), /Unique|P2002/);
  const u2 = await f.user();
  await rejects(prisma.membroImobiliaria.create({ data: { imobiliariaId: ag.id, usuarioId: u2.id, papel: "dono" } }), /papel_check|check/i);
  await rejects(prisma.membroImobiliaria.create({ data: { imobiliariaId: ag.id, usuarioId: u2.id, papel: "gestor", status: "ativo" } }), /datas_check|check/i);
  await rejects(prisma.imobiliaria.create({ data: { nomeComercial: "X", criadoPorUsuarioId: u.id, cnpj: "1234567800019A" } }), /cnpj_digitos|check/i);
});

test("FK RESTRICT impede órfãos e exclusão de titular com imóveis", skipWithoutDb, async () => {
  const u = await f.user();
  const adv = await f.advertiser(u);
  await prisma.imovel.create({ data: { criadoPorUsuarioId: u.id, anuncianteId: adv.id } });
  await rejects(prisma.anunciante.delete({ where: { id: adv.id } }), /Foreign key|P2003|fkey|violates/i);
  await rejects(prisma.usuario.delete({ where: { id: u.id } }), /Foreign key|P2003|fkey|violates|restrict/i);
});

test("auditoria é append-only (UPDATE/DELETE bloqueados no banco)", skipWithoutDb, async () => {
  const log = await prisma.logAuditoria.create({ data: { acao: "teste.integridade", tipoRecurso: "teste" } });
  await rejects(prisma.logAuditoria.update({ where: { id: log.id }, data: { acao: "teste.alterado" } }), /append-only/);
  await rejects(prisma.logAuditoria.delete({ where: { id: log.id } }), /append-only/);
  await rejects(prisma.logAuditoria.create({ data: { acao: "Ação Inválida!", tipoRecurso: "x" } }), /acao_check|check/i);
});

test("transação desfaz estado parcial em caso de falha (DB-003)", skipWithoutDb, async () => {
  const u = await f.user();
  const adv = await f.advertiser(u);
  const title = `Transação ${suffix()}`;
  await assert.rejects(prisma.$transaction(async tx => {
    await tx.imovel.create({ data: { criadoPorUsuarioId: u.id, anuncianteId: adv.id, titulo: title } });
    await tx.imovel.create({ data: { criadoPorUsuarioId: u.id } }); // viola titular único
  }));
  assert.equal(await prisma.imovel.count({ where: { titulo: title } }), 0);
});
