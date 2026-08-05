#!/bin/bash
# Test: Daily timesheet employee ordering
# Route: src/app/api/timesheets/daily/route.ts
# Generated: 2026-08-05

BASE_URL="http://localhost:3000"
AUTH_COOKIE="authjs.session-token=YOUR_SESSION_TOKEN"
EMPLOYEE_ID_1="1"
EMPLOYEE_ID_2="2"

printf '%s\n' '================================'
printf '%s\n' 'Testing: daily timesheet ordering'
printf '%s\n' '================================'

printf '\n%s\n' '1. No auth - expect 401'
curl -s -w '\nHTTP Status: %{http_code}\n' \
  -X PATCH "$BASE_URL/api/timesheets/daily" \
  -H 'Content-Type: application/json' \
  -d '{"orders":[{"employeeId":1,"sortOrder":0}]}'

printf '\n%s\n' '2. Invalid body - expect 400'
curl -s -w '\nHTTP Status: %{http_code}\n' \
  -X PATCH "$BASE_URL/api/timesheets/daily" \
  -H 'Content-Type: application/json' \
  -H "Cookie: $AUTH_COOKIE" \
  -d '{"orders":[{"employeeId":"abc","sortOrder":0}]}'

printf '\n%s\n' '3. Duplicate employees - expect 400'
curl -s -w '\nHTTP Status: %{http_code}\n' \
  -X PATCH "$BASE_URL/api/timesheets/daily" \
  -H 'Content-Type: application/json' \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{\"orders\":[{\"employeeId\":$EMPLOYEE_ID_1,\"sortOrder\":0},{\"employeeId\":$EMPLOYEE_ID_1,\"sortOrder\":1}]}"

printf '\n%s\n' '4. Valid ordering - expect 200 for an authorized account'
curl -s -w '\nHTTP Status: %{http_code}\n' \
  -X PATCH "$BASE_URL/api/timesheets/daily" \
  -H 'Content-Type: application/json' \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{\"orders\":[{\"employeeId\":$EMPLOYEE_ID_1,\"sortOrder\":0},{\"employeeId\":$EMPLOYEE_ID_2,\"sortOrder\":1}]}"

printf '\n%s\n' 'How to run:'
printf '%s\n' '1. Start app: npm run dev'
printf '%s\n' '2. Login with ADMIN, HR_MANAGER, or TIMEKEEPER and copy the session cookie'
printf '%s\n' '3. Run: bash tests/test-timesheets-daily-order.sh'
