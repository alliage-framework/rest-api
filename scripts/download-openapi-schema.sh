mkdir -p src/generated/schemas
curl https://spec.openapis.org/oas/3.1/schema/2025-02-13 > src/generated/schemas/v3.1.original.json

# Converts original schema to TS
npx quicktype -s schema src/generated/schemas/v3.1.original.json -o src/generated/schemas/v3.1.ts -t OpenAPIV31

# Converts TS to JSON Schema
npx quicktype --lang schema --src-lang typescript --top-level OpenAPIV31 -o src/generated/schemas/v3.1.json src/generated/schemas/v3.1.ts

# Removes original schema
rm src/generated/schemas/v3.1.original.json