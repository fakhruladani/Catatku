-- ───────────── CHECK constraint (tidak didukung Prisma schema) ─────────────
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_monthStart_chk" CHECK ("financialMonthStartDay" BETWEEN 1 AND 28);
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_opening_chk" CHECK (abs("openingBalance") <= 999999999999999);
ALTER TABLE "Category" ADD CONSTRAINT "Category_name_chk" CHECK (length(trim("name")) > 0);
ALTER TABLE "Category" ADD CONSTRAINT "Category_noSelfParent_chk" CHECK ("parentId" IS NULL OR "parentId" <> "id");
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amount_chk" CHECK ("amount" > 0 AND "amount" <= 999999999999999);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_desc_chk" CHECK (length("description") <= 200);
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_amount_chk" CHECK ("amount" >= 0 AND "amount" <= 999999999999999);
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_period_chk" CHECK ("effectiveFrom" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
