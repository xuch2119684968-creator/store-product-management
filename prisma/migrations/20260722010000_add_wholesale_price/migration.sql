-- Add a dedicated wholesale price while preserving all existing product data.
ALTER TABLE "Product" ADD COLUMN "wholesalePrice" DECIMAL(12, 2) NOT NULL DEFAULT 0;
