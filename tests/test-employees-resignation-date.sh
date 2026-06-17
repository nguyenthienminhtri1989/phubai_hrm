#!/bin/bash
# Test: Employee resignation date
# File: src/app/api/employees/route.ts, src/app/api/employees/[id]/route.ts
# Generated: 2026-06-17

BASE_URL="${BASE_URL:-http://localhost:3000}"
AUTH_COOKIE="${AUTH_COOKIE:-next-auth.session-token=YOUR_SESSION_TOKEN}"
EMPLOYEE_ID="${EMPLOYEE_ID:-1}"
DEPARTMENT_ID="${DEPARTMENT_ID:-1}"
UNIQUE_SUFFIX="$(date +%s)"

echo "================================"
echo "Testing: Employee resignation date"
echo "================================"

echo ""
echo "1. No auth - GET employees should reject"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X GET "$BASE_URL/api/employees"

echo ""
echo "---"
echo "2. POST inactive employee without resignationDate - expect 400"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$BASE_URL/api/employees" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{
    \"code\": \"TEST-NGHI-$UNIQUE_SUFFIX\",
    \"fullName\": \"Nhan vien test nghi viec\",
    \"departmentId\": $DEPARTMENT_ID,
    \"isActive\": false
  }"

echo ""
echo "---"
echo "3. POST inactive employee with resignationDate - expect 200"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$BASE_URL/api/employees" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{
    \"code\": \"TEST-NGHI-OK-$UNIQUE_SUFFIX\",
    \"fullName\": \"Nhan vien test co ngay nghi\",
    \"departmentId\": $DEPARTMENT_ID,
    \"isActive\": false,
    \"resignationDate\": \"2026-06-17T00:00:00.000Z\"
  }"

echo ""
echo "---"
echo "4. PATCH existing employee to inactive with resignationDate - expect 200"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X PATCH "$BASE_URL/api/employees/$EMPLOYEE_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{
    \"isActive\": false,
    \"resignationDate\": \"2026-06-17T00:00:00.000Z\"
  }"

echo ""
echo "---"
echo "5. PATCH existing employee back to active - resignationDate should be cleared"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X PATCH "$BASE_URL/api/employees/$EMPLOYEE_ID" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{
    \"isActive\": true
  }"

echo ""
echo "---"
echo "6. DELETE soft-deactivates employee and sets resignationDate to current date"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X DELETE "$BASE_URL/api/employees/$EMPLOYEE_ID" \
  -H "Cookie: $AUTH_COOKIE"

echo ""
echo "Done. Set BASE_URL, AUTH_COOKIE, EMPLOYEE_ID, and DEPARTMENT_ID before running against real data."
