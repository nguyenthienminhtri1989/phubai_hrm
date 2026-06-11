#!/bin/bash
# Test: Employee transfer API
# File: src/app/api/employees/transfers/route.ts
# Generated: 2026-06-12

BASE_URL="http://localhost:3000"
# Thay cookie session thuc te vao day sau khi dang nhap tren trinh duyet.
AUTH_COOKIE="next-auth.session-token=YOUR_SESSION_TOKEN"

echo "================================"
echo "Testing: Employee transfer API"
echo "================================"

echo ""
echo "1. GET transfer data - expect 200 with departments, kips, employees"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X GET "$BASE_URL/api/employees/transfers" \
  -H "Cookie: $AUTH_COOKIE"

echo ""
echo "---"

echo ""
echo "2. PATCH happy path - replace ids before running"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X PATCH "$BASE_URL/api/employees/transfers" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d '{
    "employeeIds": [101, 102],
    "targetDepartmentId": 15,
    "targetKipId": 3
  }'

echo ""
echo "---"

echo ""
echo "3. No auth - expect 403"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X GET "$BASE_URL/api/employees/transfers"

echo ""
echo "---"

echo ""
echo "4. Invalid body - missing employeeIds, expect 400"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X PATCH "$BASE_URL/api/employees/transfers" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d '{
    "targetDepartmentId": 15,
    "targetKipId": 3
  }'

echo ""
echo "---"

echo ""
echo "5. Invalid body - non numeric targetDepartmentId, expect 400"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X PATCH "$BASE_URL/api/employees/transfers" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d '{
    "employeeIds": [101],
    "targetDepartmentId": "abc",
    "targetKipId": 3
  }'

echo ""
echo "---"

echo ""
echo "6. Non-existent target department - expect 404"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X PATCH "$BASE_URL/api/employees/transfers" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d '{
    "employeeIds": [101],
    "targetDepartmentId": 999999,
    "targetKipId": 3
  }'

echo ""
echo "================================"
echo "Summary"
echo "- GET catalog and candidate employees"
echo "- PATCH transfer happy path"
echo "- Auth, validation, and not-found checks"
echo ""
echo "How to run:"
echo "1. Start app: npm run dev"
echo "2. Login in browser and copy session cookie"
echo "3. Paste cookie into AUTH_COOKIE"
echo "4. Run: bash tests/test-employee-transfers.sh"
