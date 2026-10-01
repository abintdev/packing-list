import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Field = { id: string; label: string; value: string };
type Section = { id: string; title: string; visible: boolean; fields: Field[] };
type ProductColumnRole = "box" | "contents" | "qty" | "unit" | "net" | "gross" | "cbm" | "totalCbm" | "custom";
type ProductColumn = { id: string; header: string; role: ProductColumnRole; width: number };
type ProductRow = { id: string; values: Record<string, string> };
type Totals = { cartons: number; rolls: number; net: number; gross: number; cbm: number };

function cartonsFromBox(boxNo: string) {
  const range = boxNo.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!range) return boxNo.trim() ? 1 : 0;
  return Math.max(0, Number(range[2]) - Number(range[1]) + 1);
}

function imageDataFromUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return Promise.resolve(url);
  return fetch(url).then((r) => r.blob()).then((blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    })
  );
}

const getField = (sections: Section[], id: string) => {
  for (const section of sections) {
    const f = section.fields.find((field) => field.id === id);
    if (f) return f.value;
  }
  return "";
};

export async function generatePackingListPdf({
  sections,
  columns,
  products,
  logo,
  totals,
}: {
  sections: Section[];
  columns: ProductColumn[];
  products: ProductRow[];
  logo: string;
  totals: Totals;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const blue: [number, number, number] = [23, 56, 165];
  const lightBlue: [number, number, number] = [234, 241, 251];
  const visible = sections.filter((s) => s.visible);
  const has = (id: string) => visible.some((s) => s.id === id);

  const logoData = await imageDataFromUrl(logo).catch(() => null);

  const drawHeader = () => {
    doc.setFillColor(...lightBlue);
    doc.rect(0, 0, pageW, 40, "F");
    doc.setFillColor(255, 255, 255);
    doc.ellipse(pageW / 2, 40, 122, 13, "F");

    if (logoData) {
      const format = logoData.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(logoData, format, 8, 5, 30, 30);
    }

    const companyName = getField(visible, "companyName");
    doc.setTextColor(...blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(companyName, pageW - 10, 8, { align: "right" });

    doc.setTextColor(20, 33, 61);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const company = visible.find((s) => s.id === "company_customer");
    const topFields = company?.fields.filter((f) =>
      ["companyAddress", "companyCity", "companyCountry", "gstin"].includes(f.id)
    ) ?? [];
    topFields.forEach((f, i) => {
      doc.text(f.id === "gstin" ? `${f.label}: ${f.value}` : f.value, pageW - 10, 14 + i * 4.5, { align: "right", maxWidth: 125 });
    });
  };

  drawHeader();

  let y = 49;

  if (has("company_customer")) {
    doc.setTextColor(17, 17, 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(getField(visible, "customerName"), margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    const customerSection = visible.find((s) => s.id === "company_customer");
    const customerFields = customerSection?.fields.filter((f) =>
      ["customerAddress", "customerCity", "customerCountry", "customerGst"].includes(f.id)
    ) ?? [];
    customerFields.forEach((f) => {
      doc.text(f.id === "customerGst" ? `${f.label} ${f.value}` : f.value, margin, y);
      y += 4.5;
    });
    doc.text("Place of supply: Foreign Country", margin, y);
  }

  if (has("shipment_reference")) {
    const titleX = 123;
    doc.setTextColor(...blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`PACKING LIST ${getField(visible, "packingListNo")}`, titleX, 49);

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(8.5);
    const shipment = visible.find((s) => s.id === "shipment_reference");
    let my = 56;
    shipment?.fields.forEach((f) => {
      doc.setFont("helvetica", "bold");
      doc.text(f.label, titleX, my);
      doc.setFont("helvetica", "normal");
      doc.text(`:   ${f.value}`, titleX + 37, my);
      my += 5.5;
    });
  }

  if (has("logistics")) {
    y = 85;
    const logistics = visible.find((s) => s.id === "logistics");
    const fields = logistics?.fields ?? [];
    const count = Math.max(fields.length, 1);
    const colW = (pageW - margin * 2) / Math.min(count, 4);

    fields.slice(0, 4).forEach((f, i) => {
      const x = margin + i * colW;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(20, 20, 20);
      doc.text(f.label, x, y);
      doc.setFont("helvetica", "normal");
      doc.text(f.value, x, y + 6, { maxWidth: colW - 3 });
    });
  }

  y = 98;

  if (columns.length > 0) {
    const body = products.map((p) =>
      columns.map((c) => {
        if (c.role === "totalCbm") {
          const box = columns.find((x) => x.role === "box");
          const cbm = columns.find((x) => x.role === "cbm");
          return box && cbm
            ? (cartonsFromBox(p.values[box.id] || "") * Number(p.values[cbm.id] || 0)).toFixed(3)
            : "";
        }
        return p.values[c.id] ?? "";
      })
    );

    const totalRow = columns.map((c, index) => {
      if (index === 1 || c.role === "contents") return "TOTAL";
      if (c.role === "qty") return totals.rolls.toLocaleString();
      if (c.role === "net") return totals.net.toFixed(2);
      if (c.role === "gross") return totals.gross.toFixed(2);
      if (c.role === "totalCbm") return totals.cbm.toFixed(3);
      return "";
    });

    body.push(totalRow);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [columns.map((c) => c.header)],
      body,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7,
        cellPadding: 2.2,
        textColor: [20, 20, 20],
        lineColor: [110, 110, 110],
        lineWidth: 0.2,
        valign: "middle",
      },
      headStyles: {
        fillColor: [243, 245, 248],
        textColor: [20, 20, 20],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: Object.fromEntries(columns.map((c, i) => [i, { cellWidth: c.width, halign: i === 1 ? "left" : "center" }])),
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.row.index === body.length - 1) {
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y + 30) + 8;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text(`SAY TOTAL ${numberToWords(totals.cartons).toUpperCase()} (${totals.cartons}) CARTONS ONLY.`, margin, y);
  y += 8;

  if (has("shipment_summary")) {
    const boxW = (pageW - margin * 2 - 5) / 2;
    const boxH = 42;
    const drawBox = (x: number, title: string) => {
      doc.setDrawColor(70, 98, 190);
      doc.rect(x, y, boxW, boxH);
      doc.setTextColor(...blue);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(title, x + 4, y + 7);
      doc.line(x + 4, y + 9, x + boxW - 4, y + 9);
    };

    drawBox(margin, "PACKAGE CONTENTS (PER CARTON)");
    drawBox(margin + boxW + 5, "SHIPMENT SUMMARY");

    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    const contentsCol = columns.find((c) => c.role === "contents");
    const qtyCol = columns.find((c) => c.role === "qty");
    const unitCol = columns.find((c) => c.role === "unit");
    let sy = y + 16;
    products.forEach((p) => {
      const text = `• ${contentsCol ? p.values[contentsCol.id] : "Product"} (${qtyCol ? p.values[qtyCol.id] : "0"} ${unitCol ? p.values[unitCol.id] : "UNIT"} total)`;
      const lines = doc.splitTextToSize(text, boxW - 8);
      doc.text(lines, margin + 4, sy);
      sy += lines.length * 3.8 + 2;
    });

    const summarySection = visible.find((s) => s.id === "shipment_summary");
    const summaryRows = [
      ["Total Number of Cartons", String(totals.cartons)],
      ["Total Number of Rolls", totals.rolls.toLocaleString()],
      ["Total Gross Weight", `${totals.gross.toFixed(2)} kg`],
      ["Total Net Weight", `${totals.net.toFixed(2)} kg`],
      ...(summarySection?.fields ?? []).map((f) => [f.label, f.value]),
      ["Total CBM", totals.cbm.toFixed(3)],
    ];

    sy = y + 15;
    summaryRows.forEach(([k, v]) => {
      doc.setFont("helvetica", "bold");
      doc.text(k, margin + boxW + 9, sy);
      doc.setFont("helvetica", "normal");
      doc.text(v, pageW - margin - 4, sy, { align: "right", maxWidth: boxW - 18 });
      sy += 4.4;
    });

    y += boxH + 8;
  }

  if (has("declaration")) {
    const declaration = visible.find((s) => s.id === "declaration");
    doc.setTextColor(...blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(declaration?.title || "DECLARATION", margin, y);
    doc.line(margin, y + 1.5, margin + 27, y + 1.5);
    y += 6;

    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    declaration?.fields.forEach((f) => {
      const lines = doc.splitTextToSize(`${f.label}: ${f.value}`, pageW - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 3.8 + 2;
    });
    y += 6;
  }

  if (has("footer")) {
    const footer = visible.find((s) => s.id === "footer");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(`For, ${getField(visible, "footerLeft")}`, margin, y);
    doc.text(getField(visible, "footerRight"), 95, y);
  }

  if (has("footer")) {
    doc.setFillColor(...lightBlue);
    doc.rect(0, pageH - 10, pageW, 10, "F");
    doc.setTextColor(20, 33, 61);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(getField(visible, "footerEmail"), 28, pageH - 4, { align: "center" });
    doc.text(`Page 1 / ${doc.getNumberOfPages()}`, pageW / 2, pageH - 4, { align: "center" });
    doc.text(getField(visible, "footerWebsite"), pageW - 38, pageH - 4, { align: "center" });
  }

  const safeName = (getField(visible, "packingListNo") || "packing-list").replace(/[^a-z0-9-_]+/gi, "_");
  doc.save(`${safeName}.pdf`);
}

function numberToWords(n: number): string {
  if (n === 0) return "ZERO";
  const ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
  const below100 = (x: number) => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "");
  const below1000 = (x: number) => Math.floor(x / 100) ? ones[Math.floor(x / 100)] + " HUNDRED" + (x % 100 ? " " + below100(x % 100) : "") : below100(x);
  if (n < 1000) return below1000(n);
  if (n < 1000000) return below1000(Math.floor(n / 1000)) + " THOUSAND" + (n % 1000 ? " " + below1000(n % 1000) : "");
  return String(n);
}
