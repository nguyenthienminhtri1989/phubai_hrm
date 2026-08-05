-- Store the preferred daily timesheet order for each employee.
ALTER TABLE "Employee" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
