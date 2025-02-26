# Downloads yq binanry
OS=$(uname -s | tr A-Z a-z)
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ]; then
  ARCH="arm64"
fi
if [ "$ARCH" = "x86_64" ]; then
  ARCH="amd64"
fi
PLATFORM="${OS}_${ARCH}"
echo "OS: $OS"
echo "ARCH: $ARCH"
echo "PLATFORM: $PLATFORM"
wget "https://github.com/mikefarah/yq/releases/latest/download/yq_$PLATFORM" -O ./yq
chmod +x ./yq

# Downloads OpenAPI schema
mkdir .tmp-open-api-spec
cd .tmp-open-api-spec
git clone https://github.com/OAI/OpenAPI-Specification.git
if [ ! -f ../src/generated/schemas ]; then
  mkdir -p ../src/generated/schemas
fi
# Generates TypeScript types from OpenAPI schema
cat OpenAPI-Specification/schemas/v3.0/schema.yaml | ../yq eval -o=json | npx json2ts >../src/generated/schemas/v3.0.d.ts

# Generates TS exporting OpenAPI schema
printf "export default " >../src/generated/schemas/v3.0.ts
cat OpenAPI-Specification/schemas/v3.0/schema.yaml | ../yq eval -o=json >> ../src/generated/schemas/v3.0.ts

cd ..

## Cleanup
rm -rf .tmp-open-api-spec
rm -rf yq
