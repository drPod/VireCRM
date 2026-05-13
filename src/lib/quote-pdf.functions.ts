import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

const inputSchema = z.object({ quoteId: z.string().uuid() });

interface Differentiator {
  title: string;
  body: string;
}
interface LineItem {
  description: string;
  quantity: number;
  unit_price_cents: number;
}

const NAVY = rgb(0.06, 0.09, 0.18);
const NAVY_SOFT = rgb(0.10, 0.14, 0.24);
const BLUE = rgb(0.30, 0.55, 0.95);
const WHITE = rgb(1, 1, 1);
const MUTED = rgb(0.72, 0.78, 0.88);
const BORDER = rgb(0.20, 0.25, 0.35);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;

function money(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fillBg(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: NAVY });
}

export const regenerateQuotePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof inputSchema>) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Verify caller is platform admin
    const { data: isAdmin } = await supabaseAdmin.rpc("is_platform_admin", { _user_id: userId });
    if (!isAdmin) throw new Error("Unauthorized: platform admin required");

    const { data: quote, error } = await supabaseAdmin
      .from("admin_quotes")
      .select("*")
      .eq("id", data.quoteId)
      .single();
    if (error || !quote) throw new Error(error?.message ?? "Quote not found");

    const differentiators = (quote.differentiators ?? []) as unknown as Differentiator[];
    const lineItems = (quote.line_items ?? []) as unknown as LineItem[];

    const pdf = await PDFDocument.create();
    const sans = await pdf.embedFont(StandardFonts.Helvetica);
    const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage([PAGE_W, PAGE_H]);
    fillBg(page);
    let y = PAGE_H - MARGIN;

    const ensureSpace = (needed: number) => {
      if (y - needed < MARGIN) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        fillBg(page);
        y = PAGE_H - MARGIN;
      }
    };

    const drawHeading = (text: string, size = 18) => {
      ensureSpace(size + 12);
      page.drawText(text, { x: MARGIN, y: y - size, size, font: sansBold, color: WHITE });
      y -= size + 6;
      page.drawRectangle({ x: MARGIN, y: y - 2, width: 40, height: 2, color: BLUE });
      y -= 14;
    };

    const drawParagraph = (text: string, size = 10, color = MUTED) => {
      const lines = wrapText(text, sans, size, PAGE_W - MARGIN * 2);
      for (const line of lines) {
        ensureSpace(size + 4);
        page.drawText(line, { x: MARGIN, y: y - size, size, font: sans, color });
        y -= size + 4;
      }
    };

    // ---- Cover header ----
    page.drawText("GENESIS", {
      x: MARGIN, y: y - 22, size: 22, font: sansBold, color: BLUE,
    });
    y -= 30;
    page.drawText("Custom Proposal", {
      x: MARGIN, y: y - 12, size: 12, font: sans, color: MUTED,
    });
    y -= 30;

    page.drawText(quote.title, {
      x: MARGIN, y: y - 24, size: 24, font: sansBold, color: WHITE,
    });
    y -= 36;
    const meta = [
      `Prepared for: ${quote.recipient_name}${quote.recipient_company ? ` (${quote.recipient_company})` : ""}`,
      `Quote #: ${quote.quote_number}`,
      quote.valid_until ? `Valid until: ${quote.valid_until}` : null,
    ].filter(Boolean) as string[];
    for (const m of meta) {
      page.drawText(m, { x: MARGIN, y: y - 11, size: 11, font: sans, color: MUTED });
      y -= 16;
    }
    y -= 12;

    // ---- Line items ----
    drawHeading("Scope & Investment");
    const colDescX = MARGIN;
    const colQtyX = PAGE_W - MARGIN - 180;
    const colPriceX = PAGE_W - MARGIN - 110;
    const colTotalX = PAGE_W - MARGIN - 50;

    page.drawText("Item", { x: colDescX, y: y - 10, size: 9, font: sansBold, color: MUTED });
    page.drawText("Qty", { x: colQtyX, y: y - 10, size: 9, font: sansBold, color: MUTED });
    page.drawText("Unit", { x: colPriceX, y: y - 10, size: 9, font: sansBold, color: MUTED });
    page.drawText("Total", { x: colTotalX, y: y - 10, size: 9, font: sansBold, color: MUTED });
    y -= 16;
    page.drawLine({
      start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5, color: BORDER,
    });
    y -= 8;

    for (const li of lineItems) {
      const descLines = wrapText(li.description || "—", sans, 10, colQtyX - colDescX - 10);
      const rowH = Math.max(14, descLines.length * 13);
      ensureSpace(rowH + 6);
      let dy = y;
      for (const line of descLines) {
        page.drawText(line, { x: colDescX, y: dy - 10, size: 10, font: sans, color: WHITE });
        dy -= 13;
      }
      page.drawText(String(li.quantity), { x: colQtyX, y: y - 10, size: 10, font: sans, color: WHITE });
      page.drawText(money(li.unit_price_cents, quote.currency), {
        x: colPriceX, y: y - 10, size: 10, font: sans, color: WHITE,
      });
      page.drawText(money(li.unit_price_cents * li.quantity, quote.currency), {
        x: colTotalX, y: y - 10, size: 10, font: sansBold, color: WHITE,
      });
      y -= rowH + 4;
    }

    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5, color: BORDER,
    });
    y -= 14;

    const writeRight = (label: string, value: string, bold = false) => {
      const f = bold ? sansBold : sans;
      const c = bold ? WHITE : MUTED;
      page.drawText(label, { x: colPriceX - 20, y: y - 11, size: 11, font: f, color: c });
      page.drawText(value, { x: colTotalX, y: y - 11, size: 11, font: f, color: c });
      y -= 16;
    };
    writeRight("Subtotal", money(quote.subtotal_cents, quote.currency));
    if (quote.discount_cents > 0) {
      writeRight("Discount", `−${money(quote.discount_cents, quote.currency)}`);
    }
    writeRight("Total", money(quote.total_cents, quote.currency), true);

    // ---- Differentiators ----
    if (differentiators.length > 0) {
      y -= 10;
      drawHeading("What Separates Genesis From Other CRMs");
      for (const d of differentiators) {
        const titleLines = wrapText(d.title, sansBold, 11, PAGE_W - MARGIN * 2 - 14);
        const bodyLines = wrapText(d.body, sans, 10, PAGE_W - MARGIN * 2 - 14);
        const blockH = titleLines.length * 14 + bodyLines.length * 13 + 8;
        ensureSpace(blockH);

        // bullet
        page.drawCircle({ x: MARGIN + 3, y: y - 5, size: 2.5, color: BLUE });

        for (const line of titleLines) {
          page.drawText(line, { x: MARGIN + 14, y: y - 11, size: 11, font: sansBold, color: WHITE });
          y -= 14;
        }
        for (const line of bodyLines) {
          page.drawText(line, { x: MARGIN + 14, y: y - 10, size: 10, font: sans, color: MUTED });
          y -= 13;
        }
        y -= 8;
      }
    }

    // ---- Notes ----
    if (quote.notes) {
      y -= 6;
      drawHeading("Notes");
      drawParagraph(quote.notes, 10, MUTED);
    }

    // ---- Footer on every page ----
    const pages = pdf.getPages();
    pages.forEach((p, idx) => {
      p.drawText(
        `Genesis  •  ${quote.quote_number}  •  Page ${idx + 1} of ${pages.length}`,
        { x: MARGIN, y: 24, size: 8, font: sans, color: MUTED },
      );
    });

    const bytes = await pdf.save();

    // Upload (admin client bypasses RLS)
    const path = `${quote.id}/${quote.quote_number}-${Date.now()}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("quote-pdfs")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: pub } = supabaseAdmin.storage.from("quote-pdfs").getPublicUrl(path);
    const pdfUrl = pub.publicUrl;

    await supabaseAdmin
      .from("admin_quotes")
      .update({ pdf_url: pdfUrl })
      .eq("id", quote.id);

    await supabaseAdmin.from("admin_quote_events").insert({
      quote_id: quote.id,
      event_type: "pdf_regenerated",
      actor_user_id: userId,
      note: `PDF regenerated`,
    });

    return { pdfUrl };
  });
