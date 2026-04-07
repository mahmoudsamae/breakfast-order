import * as XLSX from "xlsx";
import { EXCEL_PRODUCT_COLUMNS } from "@/lib/order-export-rows";

type ExportOrderRow = {
  orderNumber: number | string;
  customerName: string;
  pickupDate: string;
  "Knusperbrötchen": number;
  "Farmerbrötchen": number;
  Laugenbrezel: number;
  Buttercroissant: number;
  totalItemsCount: number;
  totalPrice: number;
  createdAt: string;
};

function berlinDatePart(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function buildOrdersExcelFileName(now = new Date()) {
  return `orders-${berlinDatePart(now)}.xlsx`;
}

export function downloadOrdersExcel(rows: ExportOrderRow[], fileName = buildOrdersExcelFileName()) {
  const totals = {
    "Knusperbrötchen": 0,
    "Farmerbrötchen": 0,
    Laugenbrezel: 0,
    Buttercroissant: 0
  };
  const sheetRows = rows.map((row) => {
    const rowWithCols = {
      "Order Number": row.orderNumber ?? "",
      "Customer Name": row.customerName ?? "",
      "Pickup Date": row.pickupDate ?? "",
      Knusperbrötchen: Number(row["Knusperbrötchen"] ?? 0),
      Farmerbrötchen: Number(row["Farmerbrötchen"] ?? 0),
      Laugenbrezel: Number(row.Laugenbrezel ?? 0),
      Buttercroissant: Number(row.Buttercroissant ?? 0),
      "Total Items Count": Number(row.totalItemsCount ?? 0),
      "Total Price": Number(row.totalPrice ?? 0),
      "Created At": row.createdAt ?? ""
    };
    for (const productName of EXCEL_PRODUCT_COLUMNS) {
      totals[productName as keyof typeof totals] += Number(rowWithCols[productName] ?? 0);
    }
    return rowWithCols;
  });

  sheetRows.push({
    "Order Number": "TOTALS",
    "Customer Name": "",
    "Pickup Date": "",
    Knusperbrötchen: totals["Knusperbrötchen"],
    Farmerbrötchen: totals["Farmerbrötchen"],
    Laugenbrezel: totals.Laugenbrezel,
    Buttercroissant: totals.Buttercroissant,
    "Total Items Count": "",
    "Total Price": "",
    "Created At": ""
  });

  const worksheet = XLSX.utils.json_to_sheet(sheetRows, {
    header: [
      "Order Number",
      "Customer Name",
      "Pickup Date",
      "Knusperbrötchen",
      "Farmerbrötchen",
      "Laugenbrezel",
      "Buttercroissant",
      "Total Items Count",
      "Total Price",
      "Created At"
    ]
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
  XLSX.writeFile(workbook, fileName);
}
