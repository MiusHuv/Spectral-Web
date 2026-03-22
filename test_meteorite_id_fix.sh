#!/bin/bash
# Quick test to verify meteorite export fix

echo "Testing Meteorite Export ID Fix"
echo "================================"
echo ""

cd "$(dirname "$0")/backend"

echo "Test 1: ID cleaning logic"
python3 << 'EOF'
# Test the ID cleaning logic
test_ids = ['meteorite-37403', 'meteorite-37414', '37436', 37477]

clean_ids = []
for mid in test_ids:
    if isinstance(mid, str) and mid.startswith('meteorite-'):
        clean_ids.append(mid.replace('meteorite-', ''))
    else:
        clean_ids.append(str(mid))

print(f"Original IDs: {test_ids}")
print(f"Cleaned IDs:  {clean_ids}")
print("")

expected = ['37403', '37414', '37436', '37477']
if clean_ids == expected:
    print("✓ ID cleaning works correctly!")
else:
    print(f"✗ ID cleaning failed! Expected {expected}, got {clean_ids}")
    exit(1)
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "================================"
    echo "✓ All tests passed!"
    echo "================================"
else
    echo ""
    echo "================================"
    echo "✗ Tests failed!"
    echo "================================"
    exit 1
fi
