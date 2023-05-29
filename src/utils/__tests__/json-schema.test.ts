/* eslint-disable @typescript-eslint/no-non-null-assertion */
import path from "path";

import { Project } from "ts-morph";

import {
  convertTypeToJsonSchema,
  TypeNotConvertibleError,
} from "../json-schema";

describe("utils/json-schema", () => {
  describe("#convertTypeToJsonSchema", () => {
    const project = new Project({
      tsConfigFilePath: path.resolve(
        `${__dirname}/../../__tests__/fixtures/tsconfig.json`
      ),
    });
    const files = project.getSourceFiles([
      path.resolve(`${__dirname}/../../__tests__/fixtures/types.ts`),
    ]);
    const file = files[0];

    function getTypeAndFileData(name: string, isEnum = false) {
      const decl = !isEnum ? file.getTypeAlias(name) : file.getEnum(name);

      return {
        type: decl!.getType(),
        fileData: {
          filepath: file.getFilePath(),
          position: file.getLineAndColumnAtPos(decl!.getPos()),
        },
      };
    }

    describe("Scalar types", () => {
      it("should return the schema for a number", () => {
        const { type, fileData } = getTypeAndFileData("NumberType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "number",
        });
      });

      it("should return the schema for a number literal", () => {
        const { type, fileData } = getTypeAndFileData("NumberLiteralType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "number",
          enum: [42],
        });
      });

      it("should return the schema for a string", () => {
        const { type, fileData } = getTypeAndFileData("StringType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "string",
        });
      });

      it("should return the schema for a string literal", () => {
        const { type, fileData } = getTypeAndFileData("StringLiteralType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "string",
          enum: ["foo"],
        });
      });

      it("should return the schema for a boolean", () => {
        const { type, fileData } = getTypeAndFileData("BooleanType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "boolean",
        });
      });

      it("should return the schema for a boolean literal", () => {
        const { type, fileData } = getTypeAndFileData("BooleanLiteralType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "boolean",
          enum: [true],
        });
      });
    });

    describe("Array types", () => {
      it("should return the schema for an array", () => {
        const { type, fileData } = getTypeAndFileData("ArrayType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "array",
          items: {
            type: "number",
          },
        });
      });

      it("should return the schema for a tuple", () => {
        const { type, fileData } = getTypeAndFileData("TupleType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "array",
          items: [
            {
              type: "number",
            },
            {
              type: "string",
            },
            {
              type: "number",
            },
          ],
        });
      });
    });

    describe("Object types", () => {
      it("should return the schema for an object", () => {
        const { type, fileData } = getTypeAndFileData("ObjectType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "object",
          additionalProperties: false,
          properties: {
            numberProp: {
              type: "number",
            },
            stringProp: {
              type: "string",
            },
            booleanProp: {
              type: "boolean",
            },
          },
          required: ["numberProp", "stringProp", "booleanProp"],
        });
      });

      it("should return the schema for an object with optional properties", () => {
        const { type, fileData } = getTypeAndFileData(
          "ObjectTypeWithOptionalProps"
        );

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "object",
          additionalProperties: false,
          properties: {
            numberProp: {
              type: "number",
            },
            stringProp: {
              type: "string",
            },
          },
          required: ["stringProp"],
        });
      });

      it("should return the schema for an object with string index", () => {
        const { type, fileData } = getTypeAndFileData("StringIndexObjectType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "object",
          additionalProperties: {
            type: "number",
          },
        });
      });

      it("should return a schema for an object with number index", () => {
        const { type, fileData } = getTypeAndFileData("NumberIndexObjectType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "object",
          additionalProperties: {
            type: "string",
          },
        });
      });

      it("should return the schema for an object with comments", () => {
        const { type, fileData } = getTypeAndFileData("ObjectTypeWithComments");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "object",
          additionalProperties: false,
          properties: {
            numberProp: {
              description: "This is a number prop",
              type: "number",
            },
          },
          required: ["numberProp"],
        });
      });

      it("should return a schema for an object with metadata", () => {
        const { type, fileData } = getTypeAndFileData("ObjectTypeWithMetadata");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "object",
          additionalProperties: false,
          properties: {
            numberProp: {
              minimum: 3,
              maximum: 10,
              type: "number",
            },
            stringProp: {
              type: "string",
              pattern: "^[a-z]+$",
            },
          },
          required: ["numberProp", "stringProp"],
        });
      });

      it("should return schema for a nested object", () => {
        const { type, fileData } = getTypeAndFileData("NestedObjectType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "object",
          additionalProperties: false,
          properties: {
            nestedObjectProp: {
              type: "object",
              additionalProperties: false,
              properties: {
                booleanProp: {
                  type: "boolean",
                },
                numberProp: {
                  type: "number",
                },
                stringProp: {
                  type: "string",
                },
              },
              required: ["numberProp", "stringProp", "booleanProp"],
            },
            otherNestedObjectProp: {
              type: "object",
              additionalProperties: false,
              properties: {
                deeperNestedObjectProp: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    booleanProp: {
                      type: "boolean",
                    },
                    numberProp: {
                      type: "number",
                    },
                    stringProp: {
                      type: "string",
                    },
                  },
                  required: ["numberProp", "stringProp", "booleanProp"],
                },
              },
              required: ["deeperNestedObjectProp"],
            },
          },
          required: ["nestedObjectProp", "otherNestedObjectProp"],
        });
      });

      it("should return schema for an object with recursion", () => {
        const { type, fileData } = getTypeAndFileData("ObjectWithRecursion");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          additionalProperties: false,
          properties: {
            recursiveProperty: {
              additionalProperties: false,
              properties: {
                children: {
                  items: {
                    $ref: "#/properties/recursiveProperty",
                  },
                  type: "array",
                },
                name: {
                  type: "string",
                },
              },
              required: ["name", "children"],
              type: "object",
            },
          },
          required: ["recursiveProperty"],
          type: "object",
        });
      });

      it("should fail silently when metadata is not valid JSON", () => {
        const { type, fileData } = getTypeAndFileData(
          "ObjectTypeWithInvalidMetadata"
        );

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "object",
          additionalProperties: false,
          properties: {
            numberProp: {
              maximum: 10,
              // no "minimum" property becaues it is not valid JSON
              type: "number",
            },
          },
          required: ["numberProp"],
        });
      });

      it("should not convert a property marked as ignored", () => {
        const { type, fileData } = getTypeAndFileData(
          "ObjectTypeWithIgnoredProp"
        );

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "object",
          additionalProperties: false,
          // There's no "numberProp" property because it is ignored
          properties: {
            stringProp: {
              type: "string",
            },
          },
          required: ["stringProp"],
        });
      });

      it('should allow to override a property\'s schema by using the "type" metadata', () => {
        const { type, fileData } = getTypeAndFileData(
          "ObjectTypeWithOverriddenSchema"
        );

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "object",
          additionalProperties: false,
          properties: {
            date: {
              type: "string",
              pattern: "[0-9]{2}-[0-9]{2}-[0-9]{4}",
            },
          },
          required: ["date"],
        });
      });
    });

    describe("Union types", () => {
      it("should return a schema for an union", () => {
        const { type, fileData } = getTypeAndFileData("UnionType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          anyOf: [
            {
              type: "string",
            },
            {
              type: "number",
            },
            {
              additionalProperties: false,
              properties: {
                booleanProp: {
                  type: "boolean",
                },
                numberProp: {
                  type: "number",
                },
                stringProp: {
                  type: "string",
                },
              },
              required: ["numberProp", "stringProp", "booleanProp"],
              type: "object",
            },
            {
              type: "boolean",
            },
          ],
        });
      });

      it("should return a schema using enum for a union of strings", () => {
        const { type, fileData } = getTypeAndFileData("StringUnionType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "string",
          enum: ["foo", "bar", "baz"],
        });
      });

      it("should return a schema for a union of numbers", () => {
        const { type, fileData } = getTypeAndFileData("NumberUnionType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "number",
          enum: [3, 1, 2],
        });
      });

      it("should return a schema without enum for a union of booleans", () => {
        const { type, fileData } = getTypeAndFileData("BooleanUnionType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "boolean",
        });
      });

      it("should return a schema for a union type containing a boolean literal among other types", () => {
        const { type, fileData } = getTypeAndFileData(
          "SingleBooleanLiteralUnionType"
        );

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          anyOf: [
            {
              type: "string",
            },
            {
              type: "boolean",
              enum: [true],
            },
          ],
        });
      });

      it("should return a schema with an enum for an union of true booleans only", () => {
        const { type, fileData } = getTypeAndFileData(
          "TrueBooleanLiteralUnionType"
        );
        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "boolean",
          enum: [true],
        });
      });

      it("should return a schema with an enum for an union of false booleans only", () => {
        const { type, fileData } = getTypeAndFileData(
          "FalseBooleanLiteralUnionType"
        );
        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "boolean",
          enum: [false],
        });
      });
    });

    describe("Intersection types", () => {
      it("should return the schema of an intersection", () => {
        const { type, fileData } = getTypeAndFileData("IntersectionType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          additionalProperties: {
            type: "string",
          },
          properties: {
            booleanProp: {
              type: "boolean",
            },
            numberProp: {
              type: "number",
            },
            stringProp: {
              type: "string",
            },
          },
          required: ["stringProp", "booleanProp"],
          type: "object",
        });
      });
    });

    describe("Enum types", () => {
      it("should return the schema of an enum of strings", () => {
        const { type, fileData } = getTypeAndFileData("StringEnumType", true);

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "string",
          enum: ["foo", "bar", "baz"],
        });
      });

      it("should return the schema of an enum of numbers", () => {
        const { type, fileData } = getTypeAndFileData("NumberEnumType", true);

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "number",
          enum: [1, 2, 3],
        });
      });

      it("should return an empty schema if the enum is empty", () => {
        const { type, fileData } = getTypeAndFileData("EmptyEnumType", true);

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({});
      });
    });

    describe("Null types", () => {
      it("should return the schema of a null type", () => {
        const { type, fileData } = getTypeAndFileData("NullType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "null",
        });
      });

      it("should return the schema of an unefined type", () => {
        const { type, fileData } = getTypeAndFileData("UndefinedType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({
          type: "null",
        });
      });
    });

    describe("Any types", () => {
      it("should return the schema of an any type", () => {
        const { type, fileData } = getTypeAndFileData("AnyType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({});
      });

      it("should return the schema of an unknown type", () => {
        const { type, fileData } = getTypeAndFileData("UnknownType");

        expect(convertTypeToJsonSchema(type, fileData)).toEqual({});
      });
    });

    describe("Errors", () => {
      it("should throw an error if the type can't be converted", () => {
        const { type, fileData } = getTypeAndFileData("InvalidType");

        expect(() => convertTypeToJsonSchema(type, fileData)).toThrow(
          TypeNotConvertibleError
        );
      });
    });
  });
});
