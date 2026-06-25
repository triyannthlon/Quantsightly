-- CreateTable
CREATE TABLE "saved_comparators" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "config" TEXT NOT NULL,
    "positionRank" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_comparators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_comparators_userId_idx" ON "saved_comparators"("userId");

-- AddForeignKey
ALTER TABLE "saved_comparators" ADD CONSTRAINT "saved_comparators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
