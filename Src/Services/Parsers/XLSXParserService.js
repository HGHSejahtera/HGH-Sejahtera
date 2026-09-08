/**
 * Parses Shopee XLSX files.
 */
export const XLSXParserService = {
    parse: (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const XLSX = await import('xlsx');
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Assume first sheet is the order list
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // Convert to JSON
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Array of arrays
                    
                    // The first row should be headers
                    const headers = json[0];
                    const rows = json.slice(1);
                    
                    const mappedData = rows.map(rowArray => {
                        const rowObj = {};
                        headers.forEach((header, index) => {
                            rowObj[header] = rowArray[index];
                        });
                        return rowObj;
                    });

                    const standardized = XLSXParserService.standardize(mappedData);
                    resolve(standardized);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    },

    standardize: (data) => {
        return data.map(row => {
            const getVal = (possibleKeys) => {
                for (const key of Object.keys(row)) {
                    if (possibleKeys.includes(key.trim())) {
                        return row[key];
                    }
                }
                return null;
            };

            const orderId = getVal(['Order ID', 'Order Sn.']);
            const sku = getVal(['Parent SKU', 'SKU Reference No.', 'SKU']); // Shopee usually uses Parent SKU or SKU Reference No.
            const productName = getVal(['Product Name']);
            const variation = getVal(['Variation Name']);
            const quantity = parseInt(getVal(['Quantity']) || '1', 10);
            const status = getVal(['Order Status']);
            const createdTime = getVal(['Order Creation Date', 'Order Created Time', 'Order Creation Time', 'Creation Date', 'Order Date', 'Created Date']);

            if (!orderId || !sku) {
                console.warn('Skipping invalid row:', row);
                return null;
            }

            return {
                Platform: 'Shopee',
                OrderID: orderId,
                SellerSKU: sku,
                ProductName: productName,
                Variation: variation,
                Quantity: quantity,
                Status: status,
                CreatedTime: createdTime || new Date().toISOString(),
                CreatedAt: createdTime || new Date().toISOString(),
                RawData: row
            };
        }).filter(item => item !== null);
    }
};
