#!/bin/bash
# Test: User self-registration and approval flow
# Files:
# - src/app/api/auth/register/route.ts
# - src/app/api/admin/users/approve/route.ts
# - src/app/api/admin/users/reject/route.ts
# - src/app/api/admin/users/pending-count/route.ts
# Generated: 2026-05-15

BASE_URL="${BASE_URL:-http://localhost:3000}"
# Paste a real ADMIN or HR_MANAGER session cookie here before running protected tests.
# NextAuth v5 commonly uses authjs.session-token or __Secure-authjs.session-token.
AUTH_COOKIE="${AUTH_COOKIE:-authjs.session-token=YOUR_SESSION_TOKEN}"
DEPARTMENT_ID="${DEPARTMENT_ID:-1}"
UNIQUE_SUFFIX="$(date +%s)"
TEST_USERNAME="testduyet_${UNIQUE_SUFFIX}"

echo "================================"
echo "Testing: User registration approval flow"
echo "Base URL: $BASE_URL"
echo "================================"

echo ""
echo "1. Register valid account - expect 201"
REGISTER_BODY="{\"fullName\":\"Nguyen Van Test\",\"username\":\"$TEST_USERNAME\",\"password\":\"123456\",\"employeeCode\":\"TEST$UNIQUE_SUFFIX\",\"departmentId\":$DEPARTMENT_ID}"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "$REGISTER_BODY"

echo ""
echo "---"
echo "2. Register missing required fields - expect 400"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"missing_name\",\"password\":\"123456\"}"

echo ""
echo "---"
echo "3. Register invalid username - expect 400"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"fullName\":\"Nguyen Van Test\",\"username\":\"Ten Dang Nhap\",\"password\":\"123456\",\"departmentId\":$DEPARTMENT_ID}"

echo ""
echo "---"
echo "4. Register duplicate username - expect 409"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"fullName\":\"Nguyen Van Test\",\"username\":\"$TEST_USERNAME\",\"password\":\"123456\",\"departmentId\":$DEPARTMENT_ID}"

echo ""
echo "---"
echo "5. Pending count without admin role - expect count 0 or protected count hidden"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X GET "$BASE_URL/api/admin/users/pending-count"

echo ""
echo "---"
echo "6. Approve without session - expect 401"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X PATCH "$BASE_URL/api/admin/users/approve" \
  -H "Content-Type: application/json" \
  -d "{\"userIds\":[1]}"

echo ""
echo "---"
echo "7. Approve invalid body with admin cookie - expect 400"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X PATCH "$BASE_URL/api/admin/users/approve" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{\"userIds\":[]}"

echo ""
echo "---"
echo "8. Approve selected pending users with admin cookie - replace IDs, expect 200"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X PATCH "$BASE_URL/api/admin/users/approve" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{\"userIds\":[1,2]}"

echo ""
echo "---"
echo "9. Reject selected pending users with admin cookie - replace IDs, expect 200"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X PATCH "$BASE_URL/api/admin/users/reject" \
  -H "Content-Type: application/json" \
  -H "Cookie: $AUTH_COOKIE" \
  -d "{\"userIds\":[3]}"

echo ""
echo "================================"
echo "Summary"
echo "- Registration happy path, validation, duplicate username"
echo "- Approval authentication and validation"
echo "- Manual protected happy path requires a real ADMIN/HR_MANAGER cookie and real pending user IDs"
echo "Run: BASE_URL=http://localhost:3000 DEPARTMENT_ID=1 AUTH_COOKIE='authjs.session-token=...' bash tests/test-user-registration-approval.sh"
echo "================================"
