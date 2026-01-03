/*
  Warnings:

  - A unique constraint covering the columns `[asset_id,date]` on the table `asset_prices` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "asset_prices_asset_id_date_key" ON "asset_prices"("asset_id", "date");
