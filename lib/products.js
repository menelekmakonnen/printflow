/**
 * PopOut Studios — Product Catalog
 * Sourced from Zoho Books export.
 * Categories group products for the New Job form.
 */

export const PRODUCT_CATALOG = [
    // === DESIGN SERVICES ===
    { id: 'logo_design_corporate', name: 'Logo Design (Corporate)', description: 'Corporate logo design for starting businesses (includes brand guideline and stationery designs)', rate: 400.00, type: 'service', category: 'Design Services' },
    { id: 'production_design_charge', name: 'Production Design Charge', description: 'Design service charge for production.', rate: 350.00, type: 'service', category: 'Design Services' },
    { id: 'production_design_fee', name: 'Production Design Fee', description: 'Graphic design fee for production', rate: 150.00, type: 'service', category: 'Design Services' },
    { id: 'qr_code', name: 'QR Code', description: 'Creation of QR Code', rate: 150.00, type: 'service', category: 'Design Services' },
    { id: 'express_production_charge', name: 'Express Production Charge', description: 'Extra charges for the express job production (within 32 hours)', rate: 500.00, type: 'service', category: 'Design Services' },

    // === BUSINESS STATIONERY ===
    { id: 'business_cards_print', name: 'Business Cards Print', description: 'Printing of Business Cards (print and matte/soft-touch laminate - 100pcs)', rate: 160.00, type: 'goods', unit: 'pack', category: 'Business Stationery' },
    { id: 'letterhead_zeta_bond', name: 'Letterhead Print (Zeta & Bond)', description: 'Printing of 1 ream letterhead (bond/zeta paper)', rate: 270.00, type: 'goods', unit: 'ream', category: 'Business Stationery' },
    { id: 'zeta_letterhead', name: 'Zeta Letterhead', description: 'Printing of 1 ream zeta letterhead', rate: 550.00, type: 'goods', unit: 'pcs', category: 'Business Stationery' },
    { id: 'envelope_dl', name: 'Envelope DL', description: 'Printing of DL Envelopes.', rate: 60.00, type: 'goods', unit: 'pack', category: 'Business Stationery' },
    { id: 'envelope_c5', name: 'Envelope C5 (Pack)', description: 'Printing of C5 envelope', rate: 100.00, type: 'goods', unit: 'pack', category: 'Business Stationery' },
    { id: 'envelope_c4', name: 'Envelope C4 (Pack)', description: 'Printing of C4 envelopes', rate: 135.00, type: 'goods', unit: 'pack', category: 'Business Stationery' },
    { id: 'folder_a4', name: 'Folder (A4)', description: 'Printing of a corporate folder with an inner pocket', rate: 17.00, type: 'goods', unit: 'pcs', category: 'Business Stationery' },
    { id: 'waybill_booklet_a4', name: 'Waybill Booklet (A4)', description: 'Printing of a carbonless A4 waybill booklet. 50 original and duplicate sheets', rate: 45.00, type: 'goods', unit: 'books', category: 'Business Stationery' },
    { id: 'receipt_booklet_a5', name: 'Receipt Booklet (A5)', description: 'Printing of A5 carbonless booklet (50 original and duplicate sheets)', rate: 30.00, type: 'goods', unit: 'pcs', category: 'Business Stationery' },

    // === BROCHURES & CATALOGUES ===
    { id: 'a4_brochure_print', name: 'A4 Brochure Print', description: 'Printing of 18 paged A4 brochure', rate: 42.00, type: 'goods', unit: 'pcs', category: 'Brochures & Catalogues' },
    { id: 'a5_brochure_print', name: 'A5 Brochure Print', description: 'Printing of 4-page A5 brochure with Matte laminate', rate: 9.00, type: 'goods', unit: 'pcs', category: 'Brochures & Catalogues' },
    { id: 'trifold_brochure', name: 'Tri-Fold Brochure', description: 'Printing of A4 trifold Brochure (135g/170g)', rate: 4.00, type: 'goods', unit: 'pcs', category: 'Brochures & Catalogues' },
    { id: 'custom_brochure', name: 'Custom Sized Brochure', description: 'Printing of 12x35 inches 250g card with matte laminate', rate: 35.00, type: 'goods', unit: 'pcs', category: 'Brochures & Catalogues' },
    { id: 'a6_membership_booklet', name: 'A6 Membership Booklet', description: 'Printing of 16 paged A6 membership booklet with hard cover', rate: 19.00, type: 'goods', unit: 'pcs', category: 'Brochures & Catalogues' },
    { id: 'a4_document_print', name: 'A4 Document Print', description: 'Printing of 92 paged A4 document with comb binding.', rate: 148.00, type: 'goods', unit: 'pcs', category: 'Brochures & Catalogues' },
    { id: 'catalogue_print', name: 'Catalogue Print', description: 'Printing of 306 paged document with perfect binding.', rate: 425.00, type: 'goods', unit: 'pcs', category: 'Brochures & Catalogues' },

    // === PAPER & CARD PRINTING ===
    { id: 'a4_bond_paper', name: 'A4 Bond Paper', description: 'Printing of A4 Bond paper', rate: 1.30, type: 'goods', unit: 'sheets', category: 'Paper & Card Printing' },
    { id: 'a4_bond_paper_fb', name: 'A4 Bond Paper F/B', description: 'Printing of A4 Bond paper (duplex)', rate: 2.60, type: 'goods', unit: 'sheets', category: 'Paper & Card Printing' },
    { id: 'a3_artpaper_135g_oneside', name: 'A3 Artpaper 135g (Oneside)', description: 'Printing of A3 Artpaper 135g', rate: 3.00, type: 'goods', unit: 'sheets', category: 'Paper & Card Printing' },
    { id: 'a3_artpaper_135g_fb', name: 'A3 Artpaper 135g (F/B)', description: 'Printing of A3 Artpaper 135g', rate: 6.00, type: 'goods', unit: 'sheets', category: 'Paper & Card Printing' },
    { id: 'a4_artpaper_135g_oneside', name: 'A4 Artpaper 135g (Oneside)', description: 'Printing of A4 Artpaper 135g', rate: 1.50, type: 'goods', unit: 'sheets', category: 'Paper & Card Printing' },
    { id: 'a4_artpaper_135g_fb', name: 'A4 Artpaper 135g (F/B)', description: 'Printing of A4 Artpaper 135g', rate: 3.00, type: 'goods', unit: 'sheets', category: 'Paper & Card Printing' },
    { id: 'a4_card_print', name: 'A4 Card Print', description: 'Printing of A4 250/300/350g card', rate: 3.00, type: 'goods', unit: 'pcs', category: 'Paper & Card Printing' },
    { id: 'a5_card_print', name: 'A5 Card Print', description: 'A5 250g card print with matte laminate', rate: 8.00, type: 'goods', unit: 'pcs', category: 'Paper & Card Printing' },
    { id: 'a6_card_print', name: 'A6 Card Print', description: 'Printing of A6 card F/B (mattecard 300g)', rate: 2.50, type: 'goods', unit: 'pcs', category: 'Paper & Card Printing' },
    { id: 'sample_print', name: 'Sample Print', description: 'Production charge for a sample print.', rate: 100.00, type: 'goods', category: 'Paper & Card Printing' },

    // === BANNERS & SIGNAGE ===
    { id: 'pullup_banner_with_stand', name: 'Pull-up Banner [with Stand]', description: 'Printing of New Pull-up Banner with stand.', rate: 750.00, type: 'goods', unit: 'pcs', category: 'Banners & Signage' },
    { id: 'pullup_banner_print', name: 'Pull-up Banner Print', description: 'Printing of pull-up banner (replacement)', rate: 180.00, type: 'goods', unit: 'pcs', category: 'Banners & Signage' },
    { id: 'advertising_banner', name: 'Advertising Banner', description: 'Printing of ads banner 12x6 ft', rate: 450.00, type: 'goods', unit: 'pcs', category: 'Banners & Signage' },

    // === FLYERS & STICKERS ===
    { id: 'advertising_flyers_a5', name: 'Advertising Flyers [A5]', description: 'Printing of A5 Advertising flyers', rate: 1.00, type: 'goods', unit: 'pcs', category: 'Flyers & Stickers' },
    { id: 'sticker_print_a3', name: 'Sticker Print (A3)', description: 'Printing of A3 SAV', rate: 6.00, type: 'goods', category: 'Flyers & Stickers' },
    { id: 'round_sticker_label', name: 'Round Sticker Label', description: 'Printing of round label stickers 2.5 inches', rate: 0.80, type: 'goods', unit: 'pcs', category: 'Flyers & Stickers' },
    { id: 'advertising_stickers', name: 'Advertising Stickers', description: 'Printing of advertising stickers (22x16 inches)', rate: 16.00, type: 'goods', unit: 'pcs', category: 'Flyers & Stickers' },

    // === BRANDING & APPAREL ===
    { id: 'tshirt_printing', name: 'T-Shirt Printing', description: 'T-Shirt printing service', rate: 20.00, type: 'service', category: 'Branding & Apparel' },
    { id: 'branded_tshirt_jersey', name: 'Branded T-Shirt (Jersey)', description: 'Design and Printing of T-Shirt (jersey type)', rate: 50.00, type: 'goods', unit: 'pcs', category: 'Branding & Apparel' },
    { id: 'branded_tshirt_cotton', name: 'Branded T-shirt (Cotton)', description: 'Printing of a branded cotton t-shirt', rate: 60.00, type: 'goods', unit: 'pcs', category: 'Branding & Apparel' },
    { id: 'bottle_flask_branding', name: 'Bottle/Flask Branding', description: 'Branding of thermox bottle / flasks', rate: 15.00, type: 'service', category: 'Branding & Apparel' },
    { id: 'apron_branding', name: 'Apron Branding', description: 'Printing on Aprons', rate: 15.00, type: 'service', category: 'Branding & Apparel' },
    { id: 'branded_cap', name: 'Branded Cap', description: 'Printing on a Baseball cap (embroidery/print)', rate: 60.00, type: 'goods', unit: 'pcs', category: 'Branding & Apparel' },
    { id: 'branded_lanyards', name: 'Branded Lanyards', description: 'Branded cotton lanyards', rate: 15.00, type: 'goods', unit: 'pcs', category: 'Branding & Apparel' },

    // === ID CARDS & TAGS ===
    { id: 'pvc_id_card_cb', name: 'PVC ID Card Print C/B', description: 'Printing of PVC ID card (color and black)', rate: 17.00, type: 'goods', category: 'ID Cards & Tags' },
    { id: 'pvc_id_card_cc', name: 'PVC ID Card Print C/C', description: 'Printing of PVC ID Card (colored both sides)', rate: 34.00, type: 'goods', unit: 'pcs', category: 'ID Cards & Tags' },
    { id: 'pvc_holographic_lamination', name: 'PVC Holographic Lamination', description: 'Laminating of PVC IDs', rate: 5.00, type: 'goods', category: 'ID Cards & Tags' },
    { id: 'id_tag_plastic_holder', name: 'ID Tag + Plastic ID Holder', description: 'Round ID Tag with a plastic ID card holder', rate: 12.00, type: 'goods', unit: 'pcs', category: 'ID Cards & Tags' },
    { id: 'a6_tag_lanyard', name: 'A6 Tag Print + Lanyard', description: 'A6 printed tag, with pouch laminate and lanyard', rate: 8.00, type: 'goods', unit: 'pcs', category: 'ID Cards & Tags' },

    // === PACKAGING ===
    { id: 'paper_bag_medium_perfume', name: 'Branded Paper Bags [Medium Perfume]', description: '4x9.2.5 inches sized paper bags (two-color print)', rate: 11.00, type: 'goods', unit: 'pcs', category: 'Packaging' },
    { id: 'paper_bag_small_lipcare', name: 'Branded Paper Bags [Lipcare Small]', description: 'Small-sized paper bags (two-color print)', rate: 7.50, type: 'goods', unit: 'pcs', category: 'Packaging' },
    { id: 'paper_bag_small_jewelry', name: 'Branded Paper Bags [Small Jewelry]', description: 'Small-sized paper bags (two-color print)', rate: 7.50, type: 'goods', unit: 'pcs', category: 'Packaging' },
    { id: 'paper_bag_medium_jewelry', name: 'Branded Paper Bags [Medium Jewelry]', description: '4x9.2.5 inches sized paper bags (two-color print)', rate: 11.00, type: 'goods', unit: 'pcs', category: 'Packaging' },
];

/**
 * Get all unique categories
 */
export function getCategories() {
    const cats = new Set();
    PRODUCT_CATALOG.forEach(p => cats.add(p.category));
    return Array.from(cats);
}

/**
 * Get products grouped by category
 */
export function getProductsByCategory() {
    const groups = {};
    PRODUCT_CATALOG.forEach(p => {
        if (!groups[p.category]) groups[p.category] = [];
        groups[p.category].push(p);
    });
    return groups;
}

/**
 * Find a product by ID
 */
export function getProductById(id) {
    return PRODUCT_CATALOG.find(p => p.id === id) || null;
}
