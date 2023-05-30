mkdir .tmp-open-api-spec
cd .tmp-open-api-spec
git clone https://github.com/OAI/OpenAPI-Specification.git
if [ ! -f ../src/generated/schemas ]; then
  mkdir -p ../src/generated/schemas
fi
cat OpenAPI-Specification/schemas/v3.0/schema.json | npx json2ts >../src/generated/schemas/v3.0.d.ts
printf "export default " >../src/generated/schemas/v3.0.ts
cat OpenAPI-Specification/schemas/v3.0/schema.json >>../src/generated/schemas/v3.0.ts
cd ..
rm -rf .tmp-open-api-spec
