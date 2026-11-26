import { randomUUID } from "node:crypto";
import { errors, AppError } from "../lib/errors.js";
import { compareMoney } from "../lib/money.js";
import { createValidator, integer, money, rejectUnknownKeys, text, uuidField, assertUuid, queryInteger } from "../lib/validation.js";
import { privateProperty, privatePropertySummary } from "../lib/presenters.js";
import { ImageRejectedError, processImage, VARIANTS } from "../media/imageProcessor.js";

// ADR-004 / RN-I04 — grafo de estados do anúncio sob controle do TITULAR.
// Publicação, rejeição e suspensão são exclusivas da moderação (moderationService).
export const OWNER_TRANSITIONS = Object.freeze({
  submit: { from: ["rascunho", "rejeitado"], to: "em_analise", action: "property.submit" },
  pause: { from: ["publicado"], to: "pausado", action: "property.pause" },
  resume: { from: ["pausado"], to: "publicado", action: "property.resume" },
  "mark-rented": { from: ["publicado", "pausado"], to: "alugado", action: "property.mark_rented" },
  archive: { from: ["rascunho", "rejeitado", "publicado", "pausado", "alugado"], to: "arquivado", action: "property.archive" }
});
// Edição de conteúdo: rascunho; rejeitado e pausado voltam a rascunho e exigem nova
// análise (política conservadora da seção 30.4 para alterações após publicação).
export const EDITABLE_STATUSES = Object.freeze(["rascunho", "rejeitado", "pausado"]);
const PROPERTY_FIELDS = ["title", "description", "propertyTypeId", "rent", "condominium", "iptu", "areaM2",
  "bedrooms", "bathrooms", "parkingSpaces", "features", "address"];
const ADDRESS_FIELDS = ["neighborhoodId", "cep", "street", "number", "complement"];
const MAX_RENT = "1000000.00";
const MAX_AREA = "100000.00";

export function parsePropertyInput(body, { requireRevision }) {
  const v = createValidator();
  if (!rejectUnknownKeys(body, requireRevision ? [...PROPERTY_FIELDS, "revision"] : PROPERTY_FIELDS, v)) v.throwIfInvalid();
  const out = {};
  if (requireRevision) out.revision = integer(v, "revision", body.revision, { min: 1, max: 2_000_000_000, nullable: false });
  if (requireRevision && body.revision === undefined) v.fail("revision", "obrigatório para controle de concorrência");
  out.title = text(v, "title", body.title, { min: 8, max: 150 });
  out.description = text(v, "description", body.description, { min: 0, max: 5000, multiline: true });
  out.propertyTypeId = uuidField(v, "propertyTypeId", body.propertyTypeId);
  for (const f of ["rent", "condominium", "iptu"]) {
    out[f] = money(v, f, body[f]);
    if (out[f] && compareMoney(out[f], MAX_RENT) > 0) v.fail(f, `valor máximo ${MAX_RENT}`);
  }
  out.areaM2 = money(v, "areaM2", body.areaM2);
  if (out.areaM2 && (compareMoney(out.areaM2, "0.00") <= 0 || compareMoney(out.areaM2, MAX_AREA) > 0)) v.fail("areaM2", "deve ser maior que zero e até 100000.00");
  out.bedrooms = integer(v, "bedrooms", body.bedrooms, { min: 0, max: 50 });
  out.bathrooms = integer(v, "bathrooms", body.bathrooms, { min: 0, max: 50 });
  out.parkingSpaces = integer(v, "parkingSpaces", body.parkingSpaces, { min: 0, max: 50 });
  if (body.features !== undefined) {
    if (!Array.isArray(body.features) || body.features.length > 30) v.fail("features", "lista de até 30 identificadores");
    else {
      const ids = body.features.map((id, i) => uuidField(v, `features[${i}]`, id, { nullable: false }));
      out.features = [...new Set(ids.filter(Boolean))];
    }
  }
  if (body.address !== undefined) {
    if (body.address === null) v.fail("address", "não pode ser removido; altere os campos");
    else if (rejectUnknownKeys(body.address, ADDRESS_FIELDS, v, "address.")) {
      const a = body.address;
      out.address = {
        neighborhoodId: uuidField(v, "address.neighborhoodId", a.neighborhoodId, { nullable: false }),
        cep: text(v, "address.cep", a.cep, { max: 9 }),
        street: text(v, "address.street", a.street, { max: 180 }),
        number: text(v, "address.number", a.number, { max: 30 }),
        complement: text(v, "address.complement", a.complement, { max: 100 })
      };
      if (out.address.cep && !/^\d{5}-?\d{3}$/.test(out.address.cep)) v.fail("address.cep", "formato 00000-000");
    }
  }
  v.throwIfInvalid();
  return out;
}

function toColumns(input) {
  const map = { title: "titulo", description: "descricao", rent: "valorAluguel", condominium: "valorCondominio", iptu: "valorIptu",
    areaM2: "areaM2", bedrooms: "quartos", bathrooms: "banheiros", parkingSpaces: "vagasGaragem", propertyTypeId: "tipoImovelId" };
  const data = {};
  for (const [k, col] of Object.entries(map)) if (input[k] !== undefined) data[col] = input[k];
  return data;
}

const addressColumns = a => ({ bairroId: a.neighborhoodId, cep: a.cep ?? null, logradouro: a.street ?? null, numero: a.number ?? null, complemento: a.complement ?? null });

// Requisitos para enviar à análise (RN-P06 / RN-I05 / ADR-004).
export function submissionProblems(row, approvedPhotos) {
  const p = [];
  if (!row.titulo || row.titulo.length < 8) p.push({ field: "title", reason: "obrigatório (mínimo 8 caracteres)" });
  if (!row.descricao || row.descricao.length < 20) p.push({ field: "description", reason: "obrigatório (mínimo 20 caracteres)" });
  if (!row.tipoImovel?.ativo) p.push({ field: "propertyTypeId", reason: "tipo de imóvel ativo obrigatório" });
  if (!row.endereco?.bairro?.ativo) p.push({ field: "address.neighborhoodId", reason: "bairro ativo do catálogo obrigatório" });
  if (row.valorAluguel === null || compareMoney(row.valorAluguel.toFixed(2), "0.00") <= 0) p.push({ field: "rent", reason: "aluguel maior que zero obrigatório" });
  if (row.quartos === null) p.push({ field: "bedrooms", reason: "obrigatório" });
  if (approvedPhotos < 1) p.push({ field: "photos", reason: "ao menos uma foto processada" });
  return p;
}

export function createPartnerPropertyService({ repository, catalogRepository, audit, storage, config }) {
  async function validateReferences(input) {
    const v = createValidator();
    if (input.propertyTypeId && !(await catalogRepository.activeType(input.propertyTypeId))) v.fail("propertyTypeId", "tipo inexistente ou inativo");
    if (input.address?.neighborhoodId && !(await catalogRepository.activeNeighborhood(input.address.neighborhoodId))) {
      v.fail("address.neighborhoodId", "bairro inexistente ou inativo no catálogo de São Roque");
    }
    if (input.features?.length) {
      const active = await catalogRepository.activeFeatureIds(input.features);
      input.features.forEach((id, i) => { if (!active.includes(id)) v.fail(`features[${i}]`, "característica inexistente ou inativa"); });
    }
    v.throwIfInvalid();
  }

  async function load(scope, id, client) {
    const row = await repository.findProperty(scope.ownerWhere, assertUuid(id), client);
    if (!row) throw errors.notFound(); // não revela existência de imóvel de outro titular
    return row;
  }

  // Bloqueia a linha do imóvel dentro da transação (concorrência de edição/fotos/estado).
  async function lock(tx, scope, id) {
    const rows = await tx.$queryRaw`SELECT id FROM imoveis WHERE id = ${id}::uuid FOR UPDATE`;
    if (!rows.length) throw errors.notFound();
    return load(scope, id, tx);
  }

  // Retorna os dados para levar um anúncio editável ao estado de rascunho.
  function editTransition(row) {
    if (!EDITABLE_STATUSES.includes(row.status)) {
      throw errors.invalidTransition("Este anúncio não pode ser editado no estado atual. Pause-o antes de editar.");
    }
    return row.status === "rascunho" ? {} : { status: "rascunho" };
  }

  async function bumpAfterMediaChange(tx, scope, row, user) {
    const extra = editTransition(row);
    await tx.imovel.update({ where: { id: row.id }, data: { ...extra, revisao: { increment: 1 }, atualizadoPorUsuarioId: user.id } });
    if (extra.status) {
      await audit.record({ actorId: user.id, action: "property.update", resourceType: "imovel", resourceId: row.id,
        metadata: { de: row.status, para: "rascunho", origem: "foto" } }, tx);
    }
  }

  return {
    async list(scope, query) {
      const v = createValidator();
      for (const key of Object.keys(query)) if (!["status", "page", "pageSize"].includes(key)) v.fail(key, "parâmetro não permitido");
      const statuses = ["rascunho", "em_analise", "publicado", "rejeitado", "pausado", "alugado", "arquivado", "suspenso"];
      if (query.status !== undefined && !statuses.includes(query.status)) v.fail("status", "estado inválido");
      const page = queryInteger(v, "page", query.page, { min: 1, max: 10000 }) ?? 1;
      const pageSize = queryInteger(v, "pageSize", query.pageSize, { min: 1, max: 50 }) ?? 20;
      v.throwIfInvalid();
      const [rows, total] = await repository.listProperties(scope.ownerWhere, { status: query.status, take: pageSize, skip: (page - 1) * pageSize });
      return { data: rows.map(privatePropertySummary), page: { page, pageSize, total, hasMore: page * pageSize < total } };
    },

    async get(scope, id) {
      return privateProperty(await load(scope, id), scope.basePath + "/" + assertUuid(id));
    },

    async create(scope, user, body) {
      if (scope.blocked) throw errors.forbidden("Titular bloqueado para novos anúncios");
      const input = parsePropertyInput(body ?? {}, { requireRevision: false });
      await validateReferences(input);
      const id = await repository.transaction(async tx => {
        let enderecoId;
        if (input.address) enderecoId = (await tx.endereco.create({ data: addressColumns(input.address), select: { id: true } })).id;
        const created = await tx.imovel.create({
          data: {
            ...scope.ownerData, ...toColumns(input), enderecoId, status: "rascunho",
            criadoPorUsuarioId: user.id, atualizadoPorUsuarioId: user.id,
            caracteristicas: input.features?.length ? { create: input.features.map(caracteristicaId => ({ caracteristicaId })) } : undefined
          },
          select: { id: true }
        });
        await audit.record({ actorId: user.id, action: "property.create", resourceType: "imovel", resourceId: created.id,
          metadata: { para: "rascunho", titular: scope.kind } }, tx);
        return created.id;
      });
      return this.get(scope, id);
    },

    async update(scope, user, id, body) {
      const input = parsePropertyInput(body ?? {}, { requireRevision: true });
      await validateReferences(input);
      await repository.transaction(async tx => {
        const row = await lock(tx, scope, assertUuid(id));
        if (row.revisao !== input.revision) throw errors.conflict("O anúncio foi alterado por outra operação. Recarregue e tente novamente.");
        const extra = editTransition(row);
        const data = { ...toColumns(input), ...extra, revisao: { increment: 1 }, atualizadoPorUsuarioId: user.id };
        if (input.address) {
          if (row.endereco) await tx.endereco.update({ where: { id: row.endereco.id }, data: addressColumns(input.address) });
          else data.enderecoId = (await tx.endereco.create({ data: addressColumns(input.address), select: { id: true } })).id;
        }
        if (input.features) {
          await tx.imovelCaracteristica.deleteMany({ where: { imovelId: row.id } });
          if (input.features.length) await tx.imovelCaracteristica.createMany({ data: input.features.map(caracteristicaId => ({ imovelId: row.id, caracteristicaId })) });
        }
        await tx.imovel.update({ where: { id: row.id }, data });
        await audit.record({ actorId: user.id, action: "property.update", resourceType: "imovel", resourceId: row.id,
          metadata: { de: row.status, para: extra.status ?? row.status, campos: Object.keys(input).filter(k => k !== "revision" && input[k] !== undefined) } }, tx);
      });
      return this.get(scope, id);
    },

    async transition(scope, user, id, name, body) {
      const t = OWNER_TRANSITIONS[name];
      if (!t) throw errors.notFound();
      const v = createValidator();
      rejectUnknownKeys(body ?? {}, ["revision"], v);
      const revision = integer(v, "revision", body?.revision, { min: 1, max: 2_000_000_000, nullable: false });
      if (body?.revision === undefined) v.fail("revision", "obrigatório para controle de concorrência");
      v.throwIfInvalid();

      await repository.transaction(async tx => {
        const row = await lock(tx, scope, assertUuid(id));
        if (row.revisao !== revision) throw errors.conflict("O anúncio foi alterado por outra operação. Recarregue e tente novamente.");
        if (!t.from.includes(row.status)) throw errors.invalidTransition();
        let to = t.to;
        const data = {};
        if (name === "submit" || name === "resume") {
          if (scope.blocked || !scope.eligible) {
            throw errors.forbidden("Titular ainda não elegível para publicação (verificação pendente). O rascunho continua salvo.");
          }
        }
        if (name === "submit") {
          const approved = await repository.countApprovedPhotos(row.id, tx);
          const problems = submissionProblems(row, approved);
          if (problems.length) throw errors.validation(problems, "O anúncio ainda não atende aos requisitos de envio para análise");
        }
        if (name === "resume") {
          // Se tipo/bairro foram desativados enquanto pausado, retorna à análise.
          if (!row.tipoImovel?.ativo || !row.endereco?.bairro?.ativo) to = "em_analise";
        }
        if (name === "archive") data.arquivadoEm = new Date();
        const { count } = await tx.imovel.updateMany({
          where: { id: row.id, status: row.status, revisao: row.revisao },
          data: { ...data, status: to, revisao: { increment: 1 }, atualizadoPorUsuarioId: user.id }
        });
        if (count !== 1) throw errors.conflict();
        await audit.record({ actorId: user.id, action: t.action, resourceType: "imovel", resourceId: row.id,
          metadata: { de: row.status, para: to } }, tx);
      });
      return this.get(scope, id);
    },

    async history(scope, id) {
      const row = await load(scope, id);
      const entries = await audit.listForResource("imovel", row.id, [
        "property.create", "property.update", "property.submit", "property.pause", "property.resume", "property.mark_rented",
        "property.archive", "property.approve", "property.reject", "property.suspend"
      ]);
      const moderation = new Set(["property.approve", "property.reject", "property.suspend"]);
      return entries.map(e => ({
        action: e.acao.replace(/^property\./, ""),
        from: e.metadados?.de ?? null,
        to: e.metadados?.para ?? null,
        // Motivo de decisão da moderação é informado ao titular; identidade do revisor não.
        reason: moderation.has(e.acao) ? (e.metadados?.motivo ?? null) : null,
        actor: moderation.has(e.acao) ? "moderacao" : (e.atorId === null ? "sistema" : "titular"),
        at: e.ocorridoEm.toISOString()
      }));
    },

    // Upload (seção 19.2): autorização → estado → cota → quarentena → validação
    // real e reprocessamento (sem EXIF/GPS) → derivados privados → registro.
    async uploadPhoto(scope, user, id, buffer, declaredType) {
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw errors.validation([{ field: "body", reason: "arquivo de imagem obrigatório" }]);
      const propertyId = assertUuid(id);
      const photoId = randomUUID();
      await repository.transaction(async tx => {
        const row = await lock(tx, scope, propertyId);
        editTransition(row);
        if ((await repository.countActivePhotos(row.id, tx)) >= config.upload.maxPhotosPerProperty) {
          throw errors.validation([{ field: "photos", reason: `limite de ${config.upload.maxPhotosPerProperty} fotos por anúncio` }]);
        }
        const nextOrder = row.fotos.reduce((m, p) => Math.max(m, p.ordem + 1), 0);
        await tx.fotoImovel.create({ data: { id: photoId, imovelId: row.id, chaveArmazenamento: `originals/${photoId}`, ordem: nextOrder, statusProcessamento: "pendente" } });
      });

      const quarantineKey = `quarantine/${photoId}`;
      await storage.put(quarantineKey, buffer);
      let processed;
      try {
        processed = await processImage(buffer, { declaredType, maxInputPixels: config.upload.maxInputPixels });
        for (const [variant, data] of Object.entries(processed.derived)) await storage.put(`derived/${photoId}/${variant}.webp`, data);
        await storage.move(quarantineKey, `originals/${photoId}`);
      } catch (error) {
        await storage.remove(quarantineKey);
        await storage.removePrefix(`derived/${photoId}`);
        await repository.transaction(async tx => {
          await tx.fotoImovel.update({ where: { id: photoId }, data: { statusProcessamento: "rejeitado", excluidoEm: new Date() } });
          await audit.record({ actorId: user.id, action: "photo.reject", resourceType: "foto_imovel", resourceId: photoId,
            metadata: { imovel: propertyId, motivo: error instanceof ImageRejectedError ? error.reason : "erro_interno" } }, tx);
        });
        if (error instanceof ImageRejectedError) {
          throw new AppError(error.reason === "tipo_nao_permitido" || error.reason === "tipo_declarado_divergente" ? 415 : 422,
            "IMAGE_REJECTED", "Imagem recusada: use JPEG, PNG ou WebP válido, com no mínimo 200 px", { fields: [{ field: "body", reason: error.reason }] });
        }
        throw error;
      }

      await repository.transaction(async tx => {
        const row = await lock(tx, scope, propertyId);
        const hasCover = row.fotos.some(p => p.principal);
        await tx.fotoImovel.update({
          where: { id: photoId },
          data: { statusProcessamento: "aprovado", mimeTypeValidado: processed.mimeType, tamanhoBytes: BigInt(processed.sizeBytes), hashConteudo: processed.sha256, principal: !hasCover }
        });
        await bumpAfterMediaChange(tx, scope, row, user);
        await audit.record({ actorId: user.id, action: "photo.upload", resourceType: "foto_imovel", resourceId: photoId,
          metadata: { imovel: propertyId, mime: processed.mimeType, bytes: processed.sizeBytes } }, tx);
      });
      const detail = await this.get(scope, propertyId);
      return { property: detail, photo: detail.photos.find(p => p.id === photoId) };
    },

    async updatePhoto(scope, user, id, photoIdRaw, body) {
      const v = createValidator();
      rejectUnknownKeys(body ?? {}, ["alt", "isCover", "order"], v);
      const alt = text(v, "alt", body?.alt, { max: 250 });
      const order = integer(v, "order", body?.order, { min: 0, max: 1000, nullable: false });
      if (body?.isCover !== undefined && body.isCover !== true) v.fail("isCover", "use true para definir a capa");
      v.throwIfInvalid();
      const propertyId = assertUuid(id);
      const photoId = assertUuid(photoIdRaw);
      await repository.transaction(async tx => {
        const row = await lock(tx, scope, propertyId);
        const photo = row.fotos.find(p => p.id === photoId);
        if (!photo) throw errors.notFound();
        if (body.isCover && photo.statusProcessamento !== "aprovado") throw errors.invalidTransition("Somente foto processada pode ser capa");
        if (body.isCover) await tx.fotoImovel.updateMany({ where: { imovelId: row.id, principal: true }, data: { principal: false } });
        await tx.fotoImovel.update({ where: { id: photoId }, data: { ...(alt !== undefined ? { textoAlternativo: alt } : {}), ...(order !== undefined ? { ordem: order } : {}), ...(body.isCover ? { principal: true } : {}) } });
        await bumpAfterMediaChange(tx, scope, row, user);
        await audit.record({ actorId: user.id, action: "photo.update", resourceType: "foto_imovel", resourceId: photoId, metadata: { imovel: propertyId } }, tx);
      });
      return this.get(scope, propertyId);
    },

    // Remoção lógica: derivados apagados; original privado mantido até a política
    // de retenção ser aprovada (RN-F05 / DEC-016 — PENDENTE).
    async removePhoto(scope, user, id, photoIdRaw) {
      const propertyId = assertUuid(id);
      const photoId = assertUuid(photoIdRaw);
      await repository.transaction(async tx => {
        const row = await lock(tx, scope, propertyId);
        const photo = row.fotos.find(p => p.id === photoId);
        if (!photo) throw errors.notFound();
        await tx.fotoImovel.update({ where: { id: photoId }, data: { statusProcessamento: "removido", principal: false, excluidoEm: new Date() } });
        if (photo.principal) {
          const next = row.fotos.find(p => p.id !== photoId && p.statusProcessamento === "aprovado");
          if (next) await tx.fotoImovel.update({ where: { id: next.id }, data: { principal: true } });
        }
        await bumpAfterMediaChange(tx, scope, row, user);
        await audit.record({ actorId: user.id, action: "photo.remove", resourceType: "foto_imovel", resourceId: photoId, metadata: { imovel: propertyId } }, tx);
      });
      await storage.removePrefix(`derived/${photoId}`);
      return this.get(scope, propertyId);
    },

    async photoStream(scope, id, photoIdRaw, variant) {
      if (!Object.hasOwn(VARIANTS, variant)) throw errors.notFound();
      const photo = await repository.findPhoto(scope.ownerWhere, assertUuid(id), assertUuid(photoIdRaw));
      if (!photo || photo.statusProcessamento !== "aprovado") throw errors.notFound();
      const key = `derived/${photo.id}/${variant}.webp`;
      if (!(await storage.exists(key))) throw errors.notFound();
      return storage.stream(key);
    }
  };
}
