-- Add optional resignation date for employees who have left the company.
ALTER TABLE "Employee" ADD COLUMN "resignationDate" TIMESTAMP(3);
