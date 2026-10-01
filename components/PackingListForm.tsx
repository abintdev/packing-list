"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generatePackingListPdf } from "@/lib/pdf";

type Field = {
  id: string;
  label: string;
  value: string;
};

type Section = {
  id: string;
  title: string;
  visible: boolean;
  fields: Field[];
};

type ProductColumnRole = "box" | "contents" | "qty" | "unit" | "net" | "gross" | "cbm" | "totalCbm" | "custom";

type ProductColumn = {
  id: string;
  header: string;
  role: ProductColumnRole;
  width: number;
};

type ProductRow = {
  id: string;
  values: Record<string, string>;
};

const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const defaultSections: Section[] = [
  {
    id: "company_customer",
    title: "Company & Customer",
    visible: true,
    fields: [
      { id: "companyName", label: "Company name", value: "New East Wave International" },
      { id: "gstin", label: "GSTIN", value: "32DBCPB4419L1ZY" },
      { id: "companyAddress", label: "Company address", value: "SMP-III/138, Karayathumchal, Chembilthotti" },
      { id: "companyCity", label: "Company city", value: "Kannur 670631" },
      { id: "companyCountry", label: "Company country", value: "Kerala KL, India" },
      { id: "customerName", label: "Customer name", value: "CLASSIC FASHION APPAREL INDUSTRY LTD CO." },
      { id: "customerGst", label: "Customer GST / No.", value: "12511" },
      { id: "customerAddress", label: "Customer address", value: "Plot 16, Al Hassan Industrial Estate" },
      { id: "customerCity", label: "Customer city", value: "Irbid JO-IR 21467" },
      { id: "customerCountry", label: "Customer country", value: "Jordan" },
    ],
  },
  {
    id: "shipment_reference",
    title: "Packing List / Shipment Reference",
    visible: true,
    fields: [
      { id: "packingListNo", label: "Packing List No.", value: "PL/26-27/0008" },
      { id: "packingListDate", label: "Packing List Date", value: "14/05/2026" },
      { id: "invoiceReference", label: "Invoice Reference", value: "INV/26-27/0008" },
      { id: "source", label: "Source", value: "NEW26/SC00009" },
      { id: "reference", label: "Reference", value: "NEW26/SO00009" },
      { id: "incoterm", label: "Incoterm", value: "EXW" },
    ],
  },
  {
    id: "logistics",
    title: "Logistics",
    visible: true,
    fields: [
      { id: "portLoading", label: "Port of Loading", value: "Guangzhou" },
      { id: "portDischarge", label: "Port of Discharge", value: "AQB-Aqaba Free Zone" },
      { id: "finalDestination", label: "Final Destination", value: "Aqaba, Jordan" },
      { id: "countryOrigin", label: "Country of Origin", value: "China" },
    ],
  },
  {
    id: "shipment_summary",
    title: "Shipment Summary",
    visible: true,
    fields: [
      { id: "packingType", label: "Packing Type", value: "Master Carton Boxes" },
      { id: "hsCode", label: "HS Code", value: "82079090" },
    ],
  },
  {
    id: "declaration",
    title: "Declaration",
    visible: true,
    fields: [
      {
        id: "declarationText",
        label: "Declaration",
        value:
          "We hereby certify that the information contained in this Packing List is true and correct, and that the goods described herein are packed as stated above and are of the stated origin.",
      },
    ],
  },
  {
    id: "footer",
    title: "Footer & Signature",
    visible: true,
    fields: [
      { id: "footerEmail", label: "Footer Email", value: "neweastwave25@outlook.com" },
      { id: "footerWebsite", label: "Footer Website", value: "https://www.neweastwaveinternational.com" },
      { id: "footerLeft", label: "Signature / For", value: "NEW EAST WAVE INTERNATIONAL" },
      { id: "footerRight", label: "Designation", value: "Proprietor" },
    ],
  },
];

const defaultColumns: ProductColumn[] = [
  { id: "boxNo", header: "Box No.", role: "box", width: 20 },
  { id: "contents", header: "Contents", role: "contents", width: 48 },
  { id: "qty", header: "Qty. of Rolls", role: "qty", width: 20 },
  { id: "unit", header: "Unit", role: "unit", width: 13 },
  { id: "net", header: "Net Weight per Carton (kg)", role: "net", width: 23 },
  { id: "gross", header: "Gross Weight per Carton (kg)", role: "gross", width: 25 },
  { id: "cbm", header: "CBM per Carton", role: "cbm", width: 19 },
  { id: "totalCbm", header: "Total CBM", role: "totalCbm", width: 20 },
];

const defaultProducts: ProductRow[] = [
  {
    id: "product_1",
    values: {
      boxNo: "1 - 42",
      contents: "SP-25 SAGA STAPLE PIN",
      qty: "1000",
      unit: "ROLL",
      net: "11.00",
      gross: "11.70",
      cbm: "0.08",
      totalCbm: "3.360",
    },
  },
];

function fieldValue(sections: Section[], id: string) {
  for (const section of sections) {
    const field = section.fields.find((f) => f.id === id);
    if (field) return field.value;
  }
  return "";
}

function getCartons(boxNo: string) {
  const range = boxNo.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!range) return boxNo.trim() ? 1 : 0;
  return Math.max(0, Number(range[2]) - Number(range[1]) + 1);
}

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function PackingListForm() {
  const [sections, setSections] = useState<Section[]>(defaultSections);
  const [columns, setColumns] = useState<ProductColumn[]>(defaultColumns);
  const [products, setProducts] = useState<ProductRow[]>(defaultProducts);
  const [logo, setLogo] = useState("/company-logo.jpg");
  const [busy, setBusy] = useState(false);

  const updateField = (sectionId: string, fieldId: string, value: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, fields: section.fields.map((f) => (f.id === fieldId ? { ...f, value } : f)) }
          : section
      )
    );
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, title } : s)));
  };

  const removeSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const addField = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              fields: [...s.fields, { id: uid("field"), label: "New Field", value: "" }],
            }
          : s
      )
    );
  };

  const updateFieldLabel = (sectionId: string, fieldId: string, label: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, fields: section.fields.map((f) => (f.id === fieldId ? { ...f, label } : f)) }
          : section
      )
    );
  };

  const removeField = (sectionId: string, fieldId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) } : s
      )
    );
  };

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      {
        id: uid("section"),
        title: "New Section",
        visible: true,
        fields: [{ id: uid("field"), label: "New Field", value: "" }],
      },
    ]);
  };

  const addProduct = () => {
    const values: Record<string, string> = {};
    columns.forEach((column) => {
      values[column.id] =
        column.role === "qty" || column.role === "net" || column.role === "gross" || column.role === "cbm" || column.role === "totalCbm"
          ? "0"
          : "";
    });
    setProducts((prev) => [...prev, { id: uid("product"), values }]);
  };

  const removeProduct = (id: string) => setProducts((prev) => prev.filter((p) => p.id !== id));

  const updateProductValue = (productId: string, columnId: string, value: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, values: { ...p.values, [columnId]: value } } : p))
    );
  };

  const updateColumn = (columnId: string, key: "header" | "width", value: string) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, [key]: key === "width" ? toNumber(value) : value } : c))
    );
  };

  const removeColumn = (columnId: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    setProducts((prev) =>
      prev.map((p) => {
        const values = { ...p.values };
        delete values[columnId];
        return { ...p, values };
      })
    );
  };

  const addColumn = () => {
    const id = uid("column");
    setColumns((prev) => [...prev, { id, header: "New Header", role: "custom", width: 20 }]);
    setProducts((prev) => prev.map((p) => ({ ...p, values: { ...p.values, [id]: "" } })));
  };

  const totals = useMemo(() => {
    const roleColumn = (role: ProductColumnRole) => columns.find((c) => c.role === role)?.id;
    const boxId = roleColumn("box");
    const qtyId = roleColumn("qty");
    const netId = roleColumn("net");
    const grossId = roleColumn("gross");
    const cbmId = roleColumn("cbm");

    const cartons = boxId
      ? products.reduce((sum, p) => sum + getCartons(p.values[boxId] || ""), 0)
      : 0;
    const rolls = qtyId ? products.reduce((sum, p) => sum + toNumber(p.values[qtyId] || "0"), 0) : 0;
    const net = netId && boxId
      ? products.reduce((sum, p) => sum + getCartons(p.values[boxId] || "") * toNumber(p.values[netId] || "0"), 0)
      : 0;
    const gross = grossId && boxId
      ? products.reduce((sum, p) => sum + getCartons(p.values[boxId] || "") * toNumber(p.values[grossId] || "0"), 0)
      : 0;
    const cbm = cbmId && boxId
      ? products.reduce((sum, p) => sum + getCartons(p.values[boxId] || "") * toNumber(p.values[cbmId] || "0"), 0)
      : 0;

    return { cartons, rolls, net, gross, cbm };
  }, [columns, products]);

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function downloadPdf() {
    setBusy(true);
    try {
      await generatePackingListPdf({ sections, columns, products, logo, totals });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSections(defaultSections);
    setColumns(defaultColumns);
    setProducts(defaultProducts);
    setLogo("/company-logo.jpg");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <img src={logo} alt="Company logo" />
            <div>
              <div className="brand-title">Packing List Generator</div>
              <div className="brand-subtitle">Fully editable document • No database required</div>
            </div>
          </div>
          <div className="top-actions">
            <button className="btn" onClick={reset}>Reset</button>
            <button className="btn btn-primary" onClick={downloadPdf} disabled={busy}>
              {busy ? "Generating..." : "Generate PDF"}
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="layout">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Packing List Builder</h2>
                <div className="panel-subtitle">Edit sections, fields, products and table headers.</div>
              </div>
              <button className="small-btn" onClick={addSection}>+ Add Section</button>
            </div>

            <div className="panel-body">
              <div className="section">
                <h3 className="section-title">Company Logo</h3>
                <div className="field">
                  <label>Upload / replace logo</label>
                  <input type="file" accept="image/*" onChange={handleLogo} />
                </div>
              </div>

              {sections.map((section) => (
                <EditableSection
                  key={section.id}
                  section={section}
                  updateField={updateField}
                  updateFieldLabel={updateFieldLabel}
                  updateSectionTitle={updateSectionTitle}
                  removeSection={removeSection}
                  addField={addField}
                  removeField={removeField}
                />
              ))}

              <div className="section">
                <div className="section-toolbar">
                  <div>
                    <h3 className="section-title" style={{ marginBottom: 3 }}>Product Table</h3>
                    <div className="helper">Every column header, width and column itself is editable/removable. Add unlimited new columns.</div>
                  </div>
                  <button className="small-btn" onClick={addColumn}>+ Add Column</button>
                </div>

                <div className="products-wrap">
                  <table className="product-table builder-table">
                    <thead>
                      <tr>
                        {columns.map((column) => (
                          <th key={column.id}>
                            <input
                              value={column.header}
                              onChange={(e) => updateColumn(column.id, "header", e.target.value)}
                              className="header-input"
                              title="Edit table header"
                            />
                            <input
                              type="number"
                              min="8"
                              value={column.width}
                              onChange={(e) => updateColumn(column.id, "width", e.target.value)}
                              className="width-input"
                              title="PDF column width"
                            />
                            <button className="tiny-danger" onClick={() => removeColumn(column.id)}>Remove</button>
                          </th>
                        ))}
                        <th>Row</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id}>
                          {columns.map((column) => (
                            <td key={column.id}>
                              <input
                                value={product.values[column.id] ?? ""}
                                onChange={(e) => updateProductValue(product.id, column.id, e.target.value)}
                              />
                            </td>
                          ))}
                          <td>
                            <button className="small-btn btn-danger" onClick={() => removeProduct(product.id)}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="row-actions">
                  <button className="small-btn" onClick={addProduct}>+ Add Product Row</button>
                  <span className="helper">
                    Calculated totals: {totals.cartons} cartons • {totals.rolls.toLocaleString()} rolls • {totals.net.toFixed(2)} kg net • {totals.gross.toFixed(2)} kg gross • {totals.cbm.toFixed(3)} CBM
                  </span>
                </div>
              </div>

              <div className="notice">
                <strong>Fully editable:</strong> section titles, section fields, field labels, field values, product headers, product rows, column widths and document sections can all be changed. Removed sections/fields/columns are excluded from the PDF.
              </div>
            </div>
          </section>

          <section className="panel preview-sticky">
            <div className="panel-header">
              <h2>Live Preview</h2>
            </div>
            <div className="preview">
              <Preview sections={sections} columns={columns} products={products} totals={totals} logo={logo} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function EditableSection({
  section,
  updateField,
  updateFieldLabel,
  updateSectionTitle,
  removeSection,
  addField,
  removeField,
}: {
  section: Section;
  updateField: (sectionId: string, fieldId: string, value: string) => void;
  updateFieldLabel: (sectionId: string, fieldId: string, label: string) => void;
  updateSectionTitle: (sectionId: string, title: string) => void;
  removeSection: (sectionId: string) => void;
  addField: (sectionId: string) => void;
  removeField: (sectionId: string, fieldId: string) => void;
}) {
  return (
    <div className="section">
      <div className="section-toolbar">
        <div className="section-heading-editor">
          <input
            className="section-title-input"
            value={section.title}
            onChange={(e) => updateSectionTitle(section.id, e.target.value)}
          />
        </div>
        <div className="section-actions">
          <button className="small-btn" onClick={() => addField(section.id)}>+ Add Field</button>
          <button className="small-btn btn-danger" onClick={() => removeSection(section.id)}>Remove Section</button>
        </div>
      </div>

      {section.fields.length === 0 ? (
        <div className="empty-fields">No fields. Click “+ Add Field”.</div>
      ) : (
        <div className="form-grid">
          {section.fields.map((field) => (
            <div className="field editable-field" key={field.id}>
              <div className="field-label-row">
                <input
                  className="field-label-input"
                  value={field.label}
                  onChange={(e) => updateFieldLabel(section.id, field.id, e.target.value)}
                />
                <button
                  className="tiny-danger"
                  onClick={() => removeField(section.id, field.id)}
                  title="Remove field"
                >
                  ×
                </button>
              </div>
              <input
                value={field.value}
                onChange={(e) => updateField(section.id, field.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}


    </div>
  );
}


function Preview({
  sections,
  columns,
  products,
  totals,
  logo,
}: {
  sections: Section[];
  columns: ProductColumn[];
  products: ProductRow[];
  totals: { cartons: number; rolls: number; net: number; gross: number; cbm: number };
  logo: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const updateScale = () => {
      const available = Math.max(320, el.clientWidth - 28);
      setScale(Math.min(1, available / 794));
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    window.addEventListener("resize", updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  const get = (id: string) => fieldValue(sections, id);

  const company = sections.find((s) => s.id === "company_customer");
  const shipment = sections.find((s) => s.id === "shipment_reference");
  const logistics = sections.find((s) => s.id === "logistics");
  const summary = sections.find((s) => s.id === "shipment_summary");
  const declaration = sections.find((s) => s.id === "declaration");
  const footer = sections.find((s) => s.id === "footer");

  const customerFields = company?.fields.filter((f) =>
    ["customerName", "customerAddress", "customerCity", "customerCountry", "customerGst"].includes(f.id)
  ) ?? [];

  const companyFields = company?.fields.filter((f) =>
    ["companyName", "companyAddress", "companyCity", "companyCountry", "gstin"].includes(f.id)
  ) ?? [];

  const productRows = products.map((p) => {
    const boxColumn = columns.find((c) => c.role === "box");
    const cbmColumn = columns.find((c) => c.role === "cbm");
    return {
      p,
      totalCbm: boxColumn && cbmColumn
        ? (getCartons(p.values[boxColumn.id] || "") * toNumber(p.values[cbmColumn.id] || "0")).toFixed(3)
        : "",
    };
  });

  return (
    <div ref={viewportRef} className="preview-viewport">
      <div className="paper-stage" style={{ width: `${794 * scale}px`, height: `${1123 * scale}px` }}>
        <div className="paper" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <div className="paper-top">
            <img className="preview-logo" src={logo} alt="Logo" />
            <div className="paper-company">
              <h1>{companyFields.find((f) => f.id === "companyName")?.value || ""}</h1>
              {companyFields.filter((f) => f.id !== "companyName").map((f) => <div key={f.id}>{f.label === "GSTIN" ? `${f.label}: ${f.value}` : f.value}</div>)}
            </div>
          </div>

          <div className="preview-body">
            {company && (
              <div className="preview-meta">
                <div className="customer-block">
                  <h3>{customerFields.find((f) => f.id === "customerName")?.value || ""}</h3>
                  {customerFields.filter((f) => f.id !== "customerName").map((f) => (
                    <div className="line" key={f.id}>
                      {f.id === "customerGst" ? `${f.label} ${f.value}` : f.value}
                    </div>
                  ))}
                  <div className="line">Place of supply: Foreign Country</div>
                </div>

                {shipment && (
                  <div className="shipment-reference-block">
                    <div className="preview-title">
                      PACKING LIST {shipment.fields.find((f) => f.id === "packingListNo")?.value || ""}
                    </div>
                    <div className="preview-meta-right">
                      {shipment.fields.map((f) => (
                        <div className="meta-row" key={f.id}><span>{f.label}</span><span>{f.value}</span></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {logistics && (
              <div className="preview-logistics">
                {logistics.fields.map((f) => (
                  <div key={f.id}><h4>{f.label}</h4><div>{f.value}</div></div>
                ))}
              </div>
            )}

            {columns.length > 0 && (
              <table className="preview-table">
                <thead>
                  <tr>
                    {columns.map((c) => <th key={c.id}>{c.header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {productRows.map(({ p, totalCbm }) => (
                    <tr key={p.id}>
                      {columns.map((c) => (
                        <td key={c.id}>
                          {c.role === "totalCbm" ? totalCbm : p.values[c.id] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="preview-total">
                    {columns.map((c, i) => (
                      <td key={c.id}>
                        {i === 1 || c.role === "contents"
                          ? "TOTAL"
                          : c.role === "qty"
                            ? totals.rolls.toLocaleString()
                            : c.role === "net"
                              ? totals.net.toFixed(2)
                              : c.role === "gross"
                                ? totals.gross.toFixed(2)
                                : c.role === "totalCbm"
                                  ? totals.cbm.toFixed(3)
                                  : ""}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            )}

            <div style={{ marginTop: 12, fontWeight: 800 }}>
              SAY TOTAL {numberToWords(totals.cartons).toUpperCase()} ({totals.cartons}) CARTONS ONLY.
            </div>

            {summary && (
              <div className="summary-grid">
                <div className="summary-box">
                  <h4>PACKAGE CONTENTS (PER CARTON)</h4>
                  {products.length ? products.map((p) => (
                    <p key={p.id}>• {p.values[columns.find((c) => c.role === "contents")?.id || ""] || "Product"} — {p.values[columns.find((c) => c.role === "qty")?.id || ""] || "0"} {p.values[columns.find((c) => c.role === "unit")?.id || ""] || "UNIT"} total</p>
                  )) : <p>• No products added</p>}
                </div>
                <div className="summary-box">
                  <h4>SHIPMENT SUMMARY</h4>
                  <div className="summary-line"><span>Total Number of Cartons</span><span>{totals.cartons}</span></div>
                  <div className="summary-line"><span>Total Number of Rolls</span><span>{totals.rolls.toLocaleString()}</span></div>
                  <div className="summary-line"><span>Total Gross Weight</span><span>{totals.gross.toFixed(2)} kg</span></div>
                  <div className="summary-line"><span>Total Net Weight</span><span>{totals.net.toFixed(2)} kg</span></div>
                  {summary.fields.map((f) => <div className="summary-line" key={f.id}><span>{f.label}</span><span>{f.value}</span></div>)}
                  <div className="summary-line"><span>Total CBM</span><span>{totals.cbm.toFixed(3)}</span></div>
                </div>
              </div>
            )}

            {declaration && (
              <div className="preview-declaration">
                <h4>{declaration.title}</h4>
                {declaration.fields.map((f) => <div key={f.id}><strong>{f.label}:</strong> {f.value}</div>)}
              </div>
            )}

            {footer && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginTop: 20 }}>
                <div>
                  <strong>For,</strong> {footer.fields.find((f) => f.id === "footerLeft")?.value || ""}
                </div>
                <div style={{ textAlign: "center", fontWeight: 700 }}>
                  {footer.fields.find((f) => f.id === "footerRight")?.value || ""}
                </div>
              </div>
            )}
          </div>

          {footer && (
            <div className="paper-footer">
              <span>{footer.fields.find((f) => f.id === "footerEmail")?.value || ""}</span>
              <span>Page 1 / 1</span>
              <span>{footer.fields.find((f) => f.id === "footerWebsite")?.value || ""}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
