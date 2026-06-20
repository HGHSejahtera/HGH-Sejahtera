import Papa from 'papaparse';

/**
 * Parses TikTok Shop CSV files.
 * TikTok CSV format is tab-separated (\t) despite the .csv extension.
 */
export const CSVParserService = {
    parse: (file) => {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                // TikTok uses weird delimiters sometimes, try to auto-detect or force tab/comma
                // Usually it's comma separated but values might have quotes. Papa handles this.
                complete: (results) => {
                    try {
                        const standardized = CSVParserService.standardize(results.data);
                        resolve(standardized);
                    } catch (error) {
                        reject(error);
                    }
                },
                error: (error) => reject(error)
            });
        });
    },

    standardize: (data) => {
        return data.map(row => {
            // Find keys regardless of exact case/spacing
            const getVal = (possibleKeys) => {
                for (const key of Object.keys(row)) {
                    if (possibleKeys.includes(key.trim())) {
                        return row[key];
                    }
                }
                return null;
            };

            const orderId = getVal(['Order ID', 'Order ID']);
            const sku = getVal(['Seller SKU', 'Seller SKU', 'SKU']);
            const productName = getVal(['Product Name', 'Product Name']);
            const variation = getVal(['Variation', 'SKU Name']);
            const quantity = parseInt(getVal(['Quantity', 'Quantity']) || '1', 10);
            const status = getVal(['Order Status', 'Order Status']);

            if (!orderId || !sku) {
                console.warn('Skipping invalid row:', row);
                return null;
            }

            return {
                Platform: 'TikTok',
                OrderID: orderId,
                SellerSKU: sku,
                ProductName: productName,
                Variation: variation,
                Quantity: quantity,
                Status: status,
                RawData: row
            };
        }).filter(item => item !== null);
    }
};
