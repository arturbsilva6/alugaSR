import sharp from "sharp";
import { createHash } from "node:crypto";

// Pipeline de imagens (seção 19.2; RN-F02/F04; CT-07):
// 1) identifica o tipo REAL pelos magic bytes (não confia em extensão/MIME declarado);
// 2) aceita somente JPEG, PNG e WebP — SVG, GIF, HTML, executáveis e desconhecidos são recusados;
// 3) limita pixels de entrada (decompression bomb);
// 4) reprocessa para WebP aplicando a orientação e DESCARTANDO metadados (EXIF/GPS/XMP/ICC);
// 5) gera derivados de listagem (thumb) e de detalhe.
sharp.cache(false);

export function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.subarray(0, 4).toString("latin1") === "RIFF" && buffer.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

const FORMAT_FOR_MIME = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
export const VARIANTS = Object.freeze({ thumb: 480, detail: 1280 });

export class ImageRejectedError extends Error {
  constructor(reason) { super(reason); this.reason = reason; }
}

export async function processImage(buffer, { declaredType, maxInputPixels = 40_000_000, minDimension = 200 } = {}) {
  const detected = detectImageType(buffer);
  if (!detected) throw new ImageRejectedError("tipo_nao_permitido");
  if (declaredType && declaredType !== detected) throw new ImageRejectedError("tipo_declarado_divergente");

  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: maxInputPixels, failOn: "error" }).metadata();
  } catch {
    throw new ImageRejectedError("imagem_invalida_ou_grande_demais");
  }
  if (meta.format !== FORMAT_FOR_MIME[detected]) throw new ImageRejectedError("conteudo_divergente");
  if ((meta.pages ?? 1) > 1) throw new ImageRejectedError("animacao_nao_permitida");
  if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < minDimension) {
    throw new ImageRejectedError("dimensoes_insuficientes");
  }

  const derived = {};
  try {
    for (const [name, width] of Object.entries(VARIANTS)) {
      // .rotate() aplica a orientação EXIF antes de descartá-la; sem .withMetadata()
      // o sharp não copia EXIF, GPS, XMP nem perfil ICC para a saída.
      derived[name] = await sharp(buffer, { limitInputPixels: maxInputPixels, failOn: "error" })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    }
  } catch {
    throw new ImageRejectedError("falha_no_processamento");
  }
  return {
    mimeType: detected,
    sizeBytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    derived
  };
}
