// Fixtures SINTÉTICAS para testes de integração em PostgreSQL isolado.
// Cada chamada usa sufixo aleatório: arquivos de teste não interferem entre si.
import { randomBytes } from "node:crypto";
import { createPrisma } from "../../backend/src/db/prisma.js";
import { hashPassword } from "../../backend/src/lib/password.js";

export const TEST_DB = process.env.TEST_DATABASE_URL;
export const skipWithoutDb = { skip: !TEST_DB && "TEST_DATABASE_URL ausente" };
export const PASSWORD = "senha-sintetica-de-teste-123";
let cachedHash;

export const suffix = () => randomBytes(5).toString("hex");

export function testPrisma() { return createPrisma(TEST_DB, { max: 4 }); }

export function fixtures(prisma) {
  return {
    async user({ roles = ["usuario"], status = "ativo" } = {}) {
      cachedHash ??= await hashPassword(PASSWORD);
      const s = suffix();
      const user = await prisma.usuario.create({ data: { nome: `Pessoa Sintética ${s}`, email: `teste.${s}@exemplo.test`, status,
        contas: { create: { provedor: "local", senhaHash: cachedHash } }, papeis: { create: roles.map(papel => ({ papel })) } } });
      return user;
    },
    async advertiser(user, statusVerificacao = "verificado") {
      return prisma.anunciante.create({ data: { usuarioId: user.id, nomeExibicao: `Anunciante Sintético ${suffix()}`, statusVerificacao } });
    },
    async agency(creator, { status = "verificado" } = {}) {
      return prisma.imobiliaria.create({ data: { nomeComercial: `Imobiliária Sintética ${suffix()}`, status, criadoPorUsuarioId: creator.id } });
    },
    async member(agency, user, papel = "responsavel", status = "ativo") {
      return prisma.membroImobiliaria.create({ data: { imobiliariaId: agency.id, usuarioId: user.id, papel, status,
        aceitoEm: status === "ativo" ? new Date() : null, removidoEm: status === "removido" ? new Date() : null } });
    },
    async catalog() {
      const s = suffix();
      const [bairro, bairro2, tipo, tipo2, carac] = await Promise.all([
        prisma.bairro.create({ data: { nome: `Bairro Teste ${s}`, slug: `bairro-teste-${s}`, fonteDados: "teste sintético" } }),
        prisma.bairro.create({ data: { nome: `Bairro Teste B ${s}`, slug: `bairro-teste-b-${s}`, fonteDados: "teste sintético" } }),
        prisma.tipoImovel.create({ data: { nome: `Tipo ${s}`, slug: `tipo-${s}` } }),
        prisma.tipoImovel.create({ data: { nome: `Tipo B ${s}`, slug: `tipo-b-${s}` } }),
        prisma.caracteristica.create({ data: { nome: `Carac ${s}`, slug: `carac-${s}` } })
      ]);
      return { bairro, bairro2, tipo, tipo2, carac, s };
    },
    // Cria imóvel diretamente no banco (para testes de leitura pública/integridade).
    async property({ owner, creator, bairro, tipo, status = "publicado", rent = "1500.00", bedrooms = 2, bathrooms = 1, publishedAt, features = [], extra = {} }) {
      const endereco = await prisma.endereco.create({ data: { bairroId: bairro.id, logradouro: "Rua Sintética Privada", numero: "123", complemento: "Casa 9", latitude: "-23.5291234", longitude: "-47.1351234" } });
      const ownerData = owner.nomeComercial ? { imobiliariaId: owner.id } : { anuncianteId: owner.id };
      return prisma.imovel.create({ data: {
        ...ownerData, criadoPorUsuarioId: creator.id, enderecoId: endereco.id, tipoImovelId: tipo.id,
        titulo: `Imóvel sintético ${suffix()}`, descricao: "Descrição sintética suficientemente longa para testes.",
        valorAluguel: rent, valorCondominio: "100.00", valorIptu: "50.00", quartos: bedrooms, banheiros: bathrooms, vagasGaragem: 1,
        status, publicadoEm: ["publicado", "pausado", "alugado"].includes(status) ? (publishedAt ?? new Date()) : null,
        caracteristicas: { create: features.map(c => ({ caracteristicaId: c.id })) }, ...extra
      } });
    }
  };
}
