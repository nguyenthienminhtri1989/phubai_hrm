-- Store daily overtime attendance marks separately from regular and extra timesheets.
CREATE TABLE "OvertimeTimesheet" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "attendanceCodeId" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeTimesheet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OvertimeTimesheet_employeeId_date_key" ON "OvertimeTimesheet"("employeeId", "date");

ALTER TABLE "OvertimeTimesheet" ADD CONSTRAINT "OvertimeTimesheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OvertimeTimesheet" ADD CONSTRAINT "OvertimeTimesheet_attendanceCodeId_fkey" FOREIGN KEY ("attendanceCodeId") REFERENCES "AttendanceCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;