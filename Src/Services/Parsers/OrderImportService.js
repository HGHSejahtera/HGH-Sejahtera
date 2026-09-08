/**
 * Service to handle the logic of taking parsed raw order rows,
 * matching them against the database, and generating pick lists.
 */
export const OrderImportService = {
    /**
     * Groups parsed rows into an array of Orders.
     * @param {Array} parsedData Standardized data from CSV/XLSX parsers
     */
    groupIntoOrders: (parsedData) => {
        const ordersMap = new Map();

        parsedData.forEach(item => {
            if (!ordersMap.has(item.OrderID)) {
                ordersMap.set(item.OrderID, {
                    OrderID: item.OrderID,
                    Platform: item.Platform,
                    Status: item.Status,
                    Items: []
                });
            }

            ordersMap.get(item.OrderID).Items.push({
                SellerSKU: item.SellerSKU,
                ProductName: item.ProductName,
                Variation: item.Variation,
                Quantity: item.Quantity,
            });
        });

        return Array.from(ordersMap.values());
    },

    /**
     * Generates a consolidated pick list from a list of orders.
     * Aggregates by Barcode.
     * @param {Array} orders Array of grouped orders
     */
    generatePickList: (orders) => {
        const pickListMap = new Map();

        orders.forEach(order => {
            // For now, we assume all orders imported are to be picked.
            // In a real scenario, we might filter by Status === "To Ship".
            order.Items.forEach(item => {
                if (!pickListMap.has(item.Barcode)) {
                    pickListMap.set(item.Barcode, {
                        Barcode: item.Barcode,
                        ProductName: item.ProductName,
                        Variation: item.Variation,
                        TotalQuantity: 0,
                        OrderIDs: new Set()
                    });
                }

                const pickItem = pickListMap.get(item.Barcode);
                pickItem.TotalQuantity += item.Quantity;
                pickItem.OrderIDs.add(order.OrderID);
            });
        });

        return Array.from(pickListMap.values()).map(item => ({
            ...item,
            OrderIDs: Array.from(item.OrderIDs) // Convert Set to Array for easier rendering
        })).sort((a, b) => b.TotalQuantity - a.TotalQuantity); // Sort by highest quantity first
    }
};
