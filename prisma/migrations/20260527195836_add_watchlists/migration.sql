-- CreateTable
CREATE TABLE "watchlists" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "assetType" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_items" (
    "id" BIGSERIAL NOT NULL,
    "watchlistId" BIGINT NOT NULL,
    "symbol" VARCHAR(50) NOT NULL,
    "positionRank" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "watchlists_userId_idx" ON "watchlists"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "watchlists_userId_assetType_key" ON "watchlists"("userId", "assetType");

-- CreateIndex
CREATE INDEX "watchlist_items_watchlistId_positionRank_idx" ON "watchlist_items"("watchlistId", "positionRank");

-- CreateIndex
CREATE INDEX "watchlist_items_symbol_idx" ON "watchlist_items"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "watchlist_items_watchlistId_symbol_key" ON "watchlist_items"("watchlistId", "symbol");

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
