export const BRAND_REGISTRY = {
    'MAKARIZO': 'MKZ',
    'CITRA': 'CTR',
    'MUSTIKA RATU': 'MSR',
    'KAHF': 'KHF',
    'MY BABY': 'MYB'
};

export const CATEGORY_REGISTRY = {
    'SHAMPOO': 'SHP',
    'SHAMPOO & CONDITIONER': 'SHP',
    'HAIR CARE': 'HCR',
    'PERSONAL CARE': 'PCR',
    'BABY & MATERNITY': 'BBY',
    'BABY SKINCARE': 'BBY',
    'BODY CREAMS & LOTIONS': 'PCR',
    'DEODORANTS & ANTIPERSPIRANTS': 'PCR',
    'FACIAL CLEANSERS': 'PCR'
};

export const VARIANT_REGISTRY = {
    'MAKARIZO|ALOE & MELON EXTRACT': 'CSAL',
    'MAKARIZO|AMBER WOOD': 'HBAW',
    'MAKARIZO|BRIGHT RADIANCE': 'FWBR',
    'MAKARIZO|ACNE CARE': 'FWAC',
    'CITRA|RADIANT GLOW PEARL': 'RGP',
    'CITRA|PERFECT BRIGHT BENGKOANG': 'PBB',
    'MUSTIKA RATU|HAIR TONIC': 'THT',
    'KAHF|MATTE DAPPER': 'PMD',
    'KAHF|SLEEK CLASSY': 'PSC',
    'KAHF|WATER BASED POMADE MATTE DAPPER': 'PMD',
    'KAHF|WATER BASED POMADE SLEEK CLASSY': 'PSC',
    'KAHF|ACNE CARE AMINO GEL': 'FWACAG',
    'KAHF|BRIGHT REVITALIZING AMINO GEL': 'FWBRAG',
    'KAHF|ACNE AND PORE CLEANSER': 'FWAPC',
    'KAHF|TRIPLE ACTION OIL AND COMEDO DEFENSE': 'FWTOCD',
    'KAHF|BRIGHTENING AND DARK SPOT': 'FWBDS',
    'KAHF|BRIGHTENING AN DARK SPOT': 'FWBDS', 
    'KAHF|OIL ACNE': 'FWOA',
    'KAHF|SKIN ENERGIZING AND BRIGHTENING': 'FWSEB',
    'KAHF|ACTIVE FRESH': 'DAF',
    'KAHF|EXTRA DRY': 'DED',
    'KAHF|COOLING POWER': 'DCP',
    'MY BABY|MINYAK TELON LEMONGRASS': 'MTLG',
    'MY BABY|MINYAK TELON LAVENDER': 'MTLV',
    'MY BABY|MINYAK TELON CITRONELLA': 'MTCT',
    'MY BABY|LEMONGRASS': 'MTLG', 
    'MY BABY|LAVENDER': 'MTLV', 
    'MY BABY|CITRONELLA': 'MTCT' 
};

const STOP_WORDS = new Set(['AND', '&', 'THE', 'OF', 'FOR', 'WITH', 'A', 'AN']);
const ACCEPTED_UNITS = new Set(['ML', 'G', 'MG', 'L', 'KG', 'PCS']);

function getConsonants(str) {
    return str.replace(/[AEIOUaeiou\s]/g, '');
}

function derive3LetterCode(name) {
    const cleanStr = name.replace(/[^a-zA-Z\s]/g, '').trim();
    if (!cleanStr) return 'XXX';
    
    const words = cleanStr.split(/\s+/).filter(w => w.length > 0);
    let code;

    if (words.length === 1) {
        const cons = getConsonants(words[0]);
        code = cons.length >= 3 ? cons.substring(0, 3) : words[0].substring(0, 3);
    } else if (words.length === 2) {
        code = words[0].substring(0, 2) + words[1].substring(0, 1);
    } else {
        code = words[0].substring(0, 1) + words[1].substring(0, 1) + words[2].substring(0, 1);
    }

    return code.toUpperCase().padEnd(3, 'X');
}

export function deriveBrandCode(brand) {
    if (!brand) return 'XXX';
    const upper = brand.toUpperCase().trim();
    if (BRAND_REGISTRY[upper]) return BRAND_REGISTRY[upper];
    return derive3LetterCode(brand);
}

export function deriveCategoryCode(category) {
    if (!category) return 'XXX';
    const upper = category.toUpperCase().trim();
    const cleanCategory = upper.replace(/\s\(\d+\)$/, '').trim();
    if (CATEGORY_REGISTRY[cleanCategory]) return CATEGORY_REGISTRY[cleanCategory];
    return derive3LetterCode(cleanCategory);
}

export function deriveVariantCode(brand, variation) {
    if (!variation) return 'XXX';
    const brandUpper = (brand || '').toUpperCase().trim();
    const varUpper = variation.toUpperCase().trim();
    const key = `${brandUpper}|${varUpper}`;
    
    if (VARIANT_REGISTRY[key]) return VARIANT_REGISTRY[key];

    const words = varUpper.split(/\s+/).filter(w => !STOP_WORDS.has(w) && w.length > 0);
    
    if (words.length === 0) return 'XXX';

    let code = words.map(w => w[0]).join('');

    if (code.length < 3) {
        code = words[0].substring(0, 3);
    }
    
    if (code.length > 8) {
        code = code.substring(0, 8);
    }

    return code.toUpperCase();
}

export function deriveSizeCode(sizeStr) {
    if (!sizeStr || sizeStr.trim() === '') return '';
    
    const digitsMatch = sizeStr.match(/\d+(\.\d+)?/);
    if (!digitsMatch) return '';
    const digits = digitsMatch[0];

    const unitMatch = sizeStr.replace(/[^a-zA-Z]/g, '').toUpperCase();
    let unit = unitMatch;

    if (!ACCEPTED_UNITS.has(unit)) {
        unit = unit.substring(0, 5);
    }

    return `${digits}${unit}`;
}

export function GenerateMasterSKU(input, existingSkus = []) {
    const brand = input.Brand || input.brand;
    const category = input.Category || input.category;
    const variation = input.Variation || input.variation;
    const size = input.Size || input.size;

    if (!brand || brand.trim() === '') return { status: 'error', message: 'Brand is required.' };
    if (!category || category.trim() === '') return { status: 'error', message: 'Category is required.' };
    if (!variation || variation.trim() === '') return { status: 'error', message: 'Variation is required.' };

    const brandCode = deriveBrandCode(brand);
    const catCode = deriveCategoryCode(category);
    const varCode = deriveVariantCode(brand, variation);
    const sizeCode = deriveSizeCode(size);

    const baseSku = `${brandCode}-${catCode}-${varCode}${sizeCode}`;

    let finalSku = baseSku;
    let suffix = 2;
    let conflictDetected = false;

    const skuSet = new Set(existingSkus.map(s => s && typeof s === 'string' ? s.toUpperCase() : ''));

    while (skuSet.has(finalSku)) {
        conflictDetected = true;
        finalSku = `${baseSku}-${suffix}`;
        suffix++;
    }

    return {
        master_sku: finalSku,
        parts: {
            brand_code: brandCode,
            category_code: catCode,
            variant_code: varCode,
            size_code: sizeCode
        },
        conflict_detected: conflictDetected,
        status: conflictDetected ? 'conflict_resolved' : 'ok',
        message: 'Master SKU generated successfully.'
    };
}
