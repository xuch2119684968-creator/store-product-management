export function money(value: number, currency = "R$") {
  return currency + " " + Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function dateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  });
}

export const operationText: Record<string, string> = {
  INBOUND: "入库",
  OUTBOUND: "出库",
  ADJUSTMENT: "调整",
  STOCKTAKE: "盘点",
  IMPORT: "导入"
};
