-- Seed existing contacts with random transaction type if null
UPDATE public.contacts
SET "transactionType" = CASE 
  WHEN random() < 0.5 THEN 'Invoice' 
  ELSE 'Order Slip' 
END
WHERE "transactionType" IS NULL OR "transactionType" = '';
