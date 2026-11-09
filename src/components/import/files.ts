/** Lecture des fichiers dans le navigateur (rien n'est envoyé avant validation de l'utilisateur). */
import { parseCsv } from "@/lib/catalog-import";

/** Réduit une photo (max `maxSide` px, JPEG) pour un envoi rapide même en 4G faible. */
export async function resizeImage(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1_200_000 && file.type === "image/jpeg") return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** Décode un CSV en UTF-8, ou en Windows-1252 (export Excel français) si l'UTF-8 est invalide. */
async function decodeText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

export type Table = { rows: unknown[][]; sheet?: string };

/** Lit un tableau Excel (.xlsx) ou CSV. Pour un classeur, prend la feuille la plus remplie. */
export async function readTable(file: File): Promise<Table> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheets = await readXlsxFile(file);
    const best = sheets.reduce((a, b) => (b.data.length > a.data.length ? b : a), sheets[0]);
    return { rows: (best?.data ?? []) as unknown[][], sheet: sheets.length > 1 ? best?.sheet : undefined };
  }
  if (name.endsWith(".xls")) {
    throw new Error("Ancien format Excel (.xls) : ouvrez-le dans Excel et enregistrez-le en .xlsx ou en CSV.");
  }
  return { rows: parseCsv(await decodeText(file)) };
}
