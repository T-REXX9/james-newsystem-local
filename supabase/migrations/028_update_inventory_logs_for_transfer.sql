-- Update inventory_logs table to include 'Transfer Product' transaction type
ALTER TABLE inventory_logs 
DROP CONSTRAINT IF EXISTS inventory_logs_transaction_type_check;

ALTER TABLE inventory_logs 
ADD CONSTRAINT inventory_logs_transaction_type_check 
CHECK (
  transaction_type IN (
    'Purchase Order', 
    'Invoice', 
    'Order Slip', 
    'Transfer Receipt', 
    'Credit Memo', 
    'Stock Adjustment',
    'Transfer Product'
  )
);

COMMENT ON CONSTRAINT inventory_logs_transaction_type_check ON inventory_logs IS 'Updated to include Transfer Product transaction type';
