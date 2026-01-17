-- Add flavors and sizes_prices columns to products table
ALTER TABLE products 
ADD COLUMN flavors TEXT DEFAULT NULL,
ADD COLUMN sizes_prices TEXT DEFAULT NULL;

-- Add comment to columns
COMMENT ON COLUMN products.flavors IS 'JSON array of product flavors, e.g. ["فانيليا", "شوكولاتة"]';
COMMENT ON COLUMN products.sizes_prices IS 'JSON array of sizes and prices, e.g. [{"size":"صغير","price":50}, {"size":"كبير","price":75}]';
