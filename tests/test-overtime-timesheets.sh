#!/bin/bash
# Test: Overtime timesheets API
# Files:
# - src/app/api/overtime-timesheets/daily/route.ts
# - src/app/api/overtime-timesheets/monthly/route.ts
# Generated: 2026-08-05

BASE_URL="http://localhost:3000"
AUTH_COOKIE="authjs.session-token=YOUR_SESSION_TOKEN"
EMPLOYEE_ID="1"
ATTENDANCE_CODE_ID="1"
DEPARTMENT_ID="1"
TEST_DATE="2026-08-05"
TEST_MONTH="8"
TEST_YEAR="2026"

printf '%s\n' '================================'
printf '%s\n' 'Testing: overtime timesheets API'
printf '%s\n' '================================'

printf '\n%s\n' '1. Daily POST no auth - expect 401'
curl -s -w '\nHTTP Status: %{http_code}\n' \
  -X POST "$BASE_URL/api/overtime-timesheets/daily" \
  -H 'Content-Type: application/json' \
  -d "{\"date\":\"$TEST_DATE\",\"records\":[{\"employeeId\":$EMPLOYEE_ID,\"attendanceCodeId\":$ATTENDANCE_CODE_ID,\"note\":\"test\"}]}"

printf '\n%s\n' '2. Daily POST invalid body - expect 400'
curl -s -w '\nHTTP Status: %{http_code}\n' \
  -X POST "$BASE_URL/api/overtime-timesheets/daily" \
  -H 'Content-Type: application/json' \
  -H "Cookie: $AUTH_COOKIE" \
  -d '{"date":"2026-08-05","records":[]}'

printf '\n%s\n' '3. Daily GET filtered list - expect 200'
curl -s -w '\nHTTP Status: %{http_code}\n' \
  -X GET "$BASE_URL/api/overtime-timesheets/daily?date=$TEST_DATE&departmentId=$DEPARTMENT_ID" \
  -H "Cookie: $AUTH_COOKIE"

printf '\n%s\n' '4. Daily POST happy path - expect 200 for authorized account'
curl -s -w '\nHTTP Status: %{http_code}\n' \
  -X POST "$BASE_URL/api/overtime-timesheets/daily" \
  -H 'Content-Type: application/json' \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{\"date\":\"$TEST_DATE\",\"records\":[{\"employeeId\":$EMPLOYEE_ID,\"attendanceCodeId\":$ATTENDANCE_CODE_ID,\"note\":\"test cong them gio\"}]}"

printf '\n%s\n' '5. Monthly GET no auth - expect 401 or 403 depending auth middleware'
curl -s -w '\nHTTP Status: %{http_code}\n' \
  -X GET "$BASE_URL/api/overtime-timesheets/monthly?month=$TEST_MONTH&year=$TEST_YEAR&departmentId=$DEPARTMENT_ID"

printf '\n%s\n' '6. Monthly GET missing filter - expect 400'
curl -s -w '\nHTTP Status: %{http_code}\n' \
  -X GET "$BASE_URL/api/overtime-timesheets/monthly?month=$TEST_MONTH&year=$TEST_YEAR" \
  -H "Cookie: $AUTH_COOKIE"

printf '\n%s\n' '7. Monthly GET filtered list - expect 200'
curl -s -w '\nHTTP Status: %{http_code}\n' \
  -X GET "$BASE_URL/api/overtime-timesheets/monthly?month=$TEST_MONTH&year=$TEST_YEAR&departmentId=$DEPARTMENT_ID" \
  -H "Cookie: $AUTH_COOKIE"

printf '\n%s\n' 'How to run:'
printf '%s\n' '1. Start app: npm run dev'
printf '%s\n' '2. Login in browser and copy the session cookie into AUTH_COOKIE'
printf '%s\n' '3. Set EMPLOYEE_ID, ATTENDANCE_CODE_ID, DEPARTMENT_ID to real IDs'
printf '%s\n' '4. Run: bash tests/test-overtime-timesheets.sh'