#!/bin/bash
BASE="http://localhost:3001/api"

echo "=== 1. Login ==="
curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{"username":"captain1","password":"123456"}'
echo ""

echo "=== 2. GET ships ==="
curl -s "$BASE/ships" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'ships: {len(d.get(\"data\",[]))}')"
echo ""

echo "=== 3. GET crew ==="
curl -s "$BASE/crew" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'crew: {len(d.get(\"data\",[]))}')"
echo ""

echo "=== 4. GET berths ==="
curl -s "$BASE/berths" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'berths: {len(d.get(\"data\",[]))}')"
echo ""

echo "=== 5. GET plans ==="
curl -s "$BASE/plans" | python3 -c "import sys,json;d=json.load(sys.stdin);[print(f'  {p[\"id\"]}: {p[\"status\"]}') for p in d.get('data',[])]"
echo ""

echo "=== 6. GET voyages ==="
curl -s "$BASE/voyages" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'voyages: {len(d.get(\"data\",[]))}')"
echo ""

echo "=== 7. GET alerts ==="
curl -s "$BASE/alerts" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'alerts: {len(d.get(\"data\",[]))}')"
echo ""

echo "=== 8. GET weather ==="
curl -s "$BASE/alerts/weather" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'warning: {d.get(\"data\",{}).get(\"warning\",\"\")}')"
echo ""

echo "=== 9. Submit p3 ==="
curl -s -X POST "$BASE/plans/p3/submit" -H "Content-Type: application/json" -H "x-user-id: u1"
echo ""

echo "=== 10. Review p3 ==="
curl -s -X POST "$BASE/plans/p3/review" -H "Content-Type: application/json" -H "x-user-id: u2" -d '{"comment":"复核通过"}'
echo ""

echo "=== 11. Inspect p3 ==="
curl -s -X POST "$BASE/plans/p3/inspect" -H "Content-Type: application/json" -H "x-user-id: u3" -d '{"comment":"检查通过"}'
echo ""

echo "=== 12. Release p3 ==="
curl -s -X POST "$BASE/plans/p3/release" -H "Content-Type: application/json" -H "x-user-id: u3" -d '{"comment":"准予放行"}'
echo ""

echo "=== 13. Release p2 (low risk, from reviewing) ==="
curl -s -X POST "$BASE/plans/p2/release" -H "Content-Type: application/json" -H "x-user-id: u2" -d '{"comment":"准予放行"}'
echo ""

echo "=== 14. Revoke p1 ==="
curl -s -X POST "$BASE/plans/p1/revoke" -H "Content-Type: application/json" -H "x-user-id: u3" -d '{"reason":"气象恶化紧急召回"}'
echo ""

echo "=== 15. GET voyages after operations ==="
curl -s "$BASE/voyages" | python3 -c "import sys,json;d=json.load(sys.stdin);[print(f'  {v[\"id\"]}: {v[\"status\"]} ship={v[\"ship_id\"]}') for v in d.get('data',[])]"
echo ""

echo "=== 16. Statistics overview ==="
curl -s "$BASE/statistics/overview" | python3 -c "import sys,json;d=json.load(sys.stdin);print(json.dumps(d.get('data',{}).get('ships',{}),indent=2))"
echo ""

echo "=== 17. Compliance ==="
curl -s "$BASE/statistics/compliance" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'totalPlans: {d.get(\"data\",{}).get(\"totalPlans\",\"\")}')"
echo ""

echo "=== 18. Approval chain p3 ==="
curl -s "$BASE/audit/approval-chain/p3" | python3 -c "import sys,json;d=json.load(sys.stdin);[print(f'  {r[\"node\"]}: {r[\"action\"]} by {r.get(\"operator_name\",r[\"operator_id\"])}') for r in d.get('data',[])]"
echo ""

echo "=== 19. Revoke log ==="
curl -s "$BASE/audit/revoke-log" | python3 -c "import sys,json;d=json.load(sys.stdin);[print(f'  revoke: {r.get(\"reason\",\"\")}') for r in d.get('data',[])]"
echo ""

echo "=== ALL TESTS DONE ==="
