// Text lines from a PDF, with each piece's horizontal position, so a
// statement parser can tell columns (withdrawals vs deposits) apart.

export interface PdfTextItem {
  str: string;
  /** Left edge. */
  x: number;
  /** Right edge. */
  xEnd: number;
}

export interface PdfLine {
  page: number;
  items: PdfTextItem[];
  /** The line's text, pieces in left-to-right order. */
  text: string;
}

/** The parts of a pdf.js text item this module reads. */
interface RawTextItem {
  str: string;
  transform: number[];
  width: number;
}

/** Pieces closer than this vertically sit on the same line. */
const SAME_LINE = 2;

/** Group one page's text pieces into lines, top to bottom. */
export function linesFromItems(page: number, raw: RawTextItem[]): PdfLine[] {
  const pieces = raw
    .filter((r) => r.str.trim())
    .map((r) => ({ str: r.str.trim(), x: r.transform[4], y: r.transform[5], width: r.width }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: { y: number; items: PdfTextItem[] }[] = [];
  for (const p of pieces) {
    const line = lines.find((l) => Math.abs(l.y - p.y) <= SAME_LINE);
    const item = { str: p.str, x: p.x, xEnd: p.x + p.width };
    if (line) line.items.push(item);
    else lines.push({ y: p.y, items: [item] });
  }
  return lines.map((l) => {
    const items = l.items.sort((a, b) => a.x - b.x);
    return { page, items, text: items.map((i) => i.str).join(" ") };
  });
}

/** The pdf.js API surface used here, so callers can pass either build. */
export interface PdfJsLike {
  getDocument(src: { data: Uint8Array }): {
    promise: Promise<{
      numPages: number;
      getPage(n: number): Promise<{
        getTextContent(): Promise<{ items: unknown[] }>;
      }>;
      destroy(): Promise<void>;
    }>;
  };
}

export async function pdfLines(pdfjs: PdfJsLike, data: Uint8Array): Promise<PdfLine[]> {
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const lines: PdfLine[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      const raw = content.items.filter(
        (i): i is RawTextItem => typeof (i as RawTextItem).str === "string"
      );
      lines.push(...linesFromItems(n, raw));
    }
    return lines;
  } finally {
    await doc.destroy();
  }
}

/**
 * Read a PDF in the browser. The file never leaves the device: pdf.js
 * runs locally in a web worker.
 */
export async function loadPdfLines(file: File): Promise<PdfLine[]> {
  // Served from public/pdfjs (scripts/copy-pdfjs.mjs) and kept out of the
  // bundler, which breaks pdf.js at load time.
  const pdfjs = (await import(/* webpackIgnore: true */ PDFJS_URL)) as PdfJsLike & {
    GlobalWorkerOptions: { workerSrc: string };
  };
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  return pdfLines(pdfjs, new Uint8Array(await file.arrayBuffer()));
}

const PDFJS_URL = "/pdfjs/pdf.min.mjs";
const PDFJS_WORKER_URL = "/pdfjs/pdf.worker.min.mjs";
