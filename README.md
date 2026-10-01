# Packing List Generator

A Next.js 16 + React + TypeScript packing-list PDF generator based on the supplied New East Wave International reference document.

## Features

- No database.
- No authentication.
- All company, customer, shipment, logistics and declaration fields are editable.
- Add/remove unlimited product/carton rows.
- Automatic carton, roll, net-weight, gross-weight and CBM totals.
- Live document preview styled after the supplied packing-list reference.
- Client-side PDF generation with jsPDF + AutoTable.
- Company logo included from the supplied image.
- Optional logo replacement from the browser.
- PDF file name uses the Packing List number.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For production:

```bash
npm run build
npm start
```

## PDF behavior

The browser generates the PDF directly; no API or database is required.

### Calculation rule

For each product:

- Cartons = parsed from Box No. range, e.g. `1 - 42` = 42 cartons.
- Total CBM = cartons × CBM per carton.
- Total net weight = cartons × net weight per carton.
- Total gross weight = cartons × gross weight per carton.
- Total rolls = the editable Qty. of Rolls value.

If you enter a single box number rather than a range, it is treated as one carton.

## Notes

The visual layout is intentionally modeled on the supplied one-page reference. For production use, you can further fine-tune fonts, spacing, signature area, footer wording and multi-page behavior to match your company's final approved template.

### Preview responsiveness

The live preview uses a fixed A4 design canvas and automatically scales the complete page to the available panel width, so the customer details, packing-list number and right-side company information remain visible instead of being horizontally cropped.
