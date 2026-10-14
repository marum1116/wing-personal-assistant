export const RICH_MENU_WIDTH = 2500;
export const RICH_MENU_HEIGHT = 1686;
export const RICH_MENU_EXCEL_URL =
  "https://1drv.ms/x/c/9bd7af7f5c25ad41/IQAkWwmfLgFuT6hubXFEMGY_AU5v3uZy-bXHxjaW1QcF-7w";

export type RichMenuAction =
  | { type: "uri"; label: string; uri: string }
  | { type: "message"; label: string; text: string };

export type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number };
  action: RichMenuAction;
};

function cell(col: number, row: number): { x: number; y: number; width: number; height: number } {
  const colWidth = Math.floor(RICH_MENU_WIDTH / 3);
  const rowHeight = Math.floor(RICH_MENU_HEIGHT / 2);
  const x = col * colWidth;
  const y = row * rowHeight;
  return {
    x,
    y,
    width: col === 2 ? RICH_MENU_WIDTH - x : colWidth,
    height: row === 1 ? RICH_MENU_HEIGHT - y : rowHeight
  };
}

export const RICH_MENU_LABELS = [
  "Excel",
  "通常調整さん",
  "未払い",
  "引率チェック",
  "個人練習集金確認",
  "塁に連絡"
] as const;

export function buildRichMenuAreas(excelUrl: string = RICH_MENU_EXCEL_URL): RichMenuArea[] {
  const message = (label: string, text: string, col: number, row: number): RichMenuArea => ({
    bounds: cell(col, row),
    action: { type: "message", label, text }
  });
  return [
    { bounds: cell(0, 0), action: { type: "uri", label: "Excel", uri: excelUrl } },
    message("通常調整さん", "通常調整さん", 1, 0),
    message("未払い", "未払い", 2, 0),
    message("引率チェック", "引率チェック", 0, 1),
    message("個人練習集金確認", "個人練習集金確認", 1, 1),
    message("塁に連絡", "塁に連絡", 2, 1)
  ];
}
