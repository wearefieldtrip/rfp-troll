// Reads the RFP tracker: every cell's text, plus the link behind each proposal title (a link or a Drive smart chip).
import { getAccessToken } from "./google.ts";
import type { SheetRow } from "./tracker-import.ts";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

async function get(url: string, what: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await getAccessToken()}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Google Sheets could not ${what} (${res.status}): ${body?.error?.message ?? res.statusText}`);
  }
  return await res.json();
}

/** Column number (0 is A) as a sheet column letter. */
const columnLetter = (index: number): string => (index < 26 ? String.fromCharCode(65 + index) : columnLetter(Math.floor(index / 26) - 1) + String.fromCharCode(65 + (index % 26)));

const linkOf = (cell: any): string | null =>
  cell?.hyperlink ??
  cell?.textFormatRuns?.find((r: any) => r.format?.link?.uri)?.format.link.uri ??
  cell?.chipRuns?.find((r: any) => r.chip?.richLinkProperties?.uri)?.chip.richLinkProperties.uri ??
  null;

/** The data rows of the tracker tab, in sheet order. Row numbers are the sheet's own (the header is row 1). */
export async function readTracker(sheetId: string, tab: string): Promise<SheetRow[]> {
  const values = await get(`${SHEETS}/${sheetId}/values/${encodeURIComponent(tab)}?majorDimension=ROWS`, "read the tracker");
  const rows: string[][] = values.values ?? [];
  if (rows.length < 2) return [];

  // A header's line breaks become spaces: "Spec Work\nStatement" is "Spec Work Statement".
  const header = rows[0].map((h) => h.replace(/\s+/g, " ").trim());
  const linkColumn = header.indexOf("Link");
  if (linkColumn < 0 || header.indexOf("Project") < 0) throw new Error('The tracker needs "Project" and "Link" columns.');

  const letter = columnLetter(linkColumn);
  const grid = await get(
    `${SHEETS}/${sheetId}?includeGridData=true&ranges=${encodeURIComponent(`${tab}!${letter}1:${letter}${rows.length}`)}&fields=sheets.data.rowData.values(formattedValue,hyperlink,chipRuns,textFormatRuns)`,
    "read the proposal links",
  );
  const linkCells: any[] = grid.sheets?.[0]?.data?.[0]?.rowData ?? [];

  return rows.slice(1).map((r, i) => {
    const cells: Record<string, string> = {};
    header.forEach((name, col) => {
      if (name) cells[name] = (r[col] ?? "").toString();
    });
    const linkCell = linkCells[i + 1]?.values?.[0];
    return { row: i + 2, cells, linkTitle: (r[linkColumn] ?? "").toString(), linkUrl: linkOf(linkCell) };
  });
}
