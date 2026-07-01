-- Script to delete test OrderImports data for AGT003
-- Due to ON DELETE CASCADE, this will also delete associated ImportedOrders and ImportedOrderItems

DELETE FROM "OrderImports" 
WHERE "AgentID" = (
    SELECT "UserID" 
    FROM "Users" 
    WHERE "StaffID" = 'AGT003' 
    LIMIT 1
);
