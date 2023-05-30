import {
  JSONSchema6,
  JSONSchema6Definition,
  JSONSchema6TypeName,
} from "json-schema";
import { Symbol as TSSymbol, Type, ts } from "ts-morph";

interface JSDocProperties {
  description?: string;
  ignore?: boolean;
  type?: JSONSchema6TypeName;
}

export class TypeNotConvertibleError extends Error {
  constructor(
    public type: Type<ts.Type>,
    public fileData: FileData,
    message: string
  ) {
    super(message);
  }
}

interface FileData {
  filepath: string;
  position: {
    line: number;
    column: number;
  };
}

export function getFileData(symbol: TSSymbol): FileData {
  const node = symbol.getDeclarations()[0];
  const file = node.getSourceFile();
  return {
    filepath: file.getFilePath(),
    position: file.getLineAndColumnAtPos(node.getPos()),
  };
}

function tryOrReturn<FuncReturn, FallbackReturn>(
  f: () => FuncReturn,
  fallback: FallbackReturn
): FuncReturn | FallbackReturn {
  try {
    return f();
  } catch (e) {
    return fallback;
  }
}

function convertNumberTypeToJsonSchema(): JSONSchema6Definition {
  return {
    type: "number",
  };
}

function convertNumberLiteralTypeToJsonSchema(
  t: Type<ts.Type>
): JSONSchema6Definition {
  return {
    type: "number",
    enum: [t.getLiteralValue() as number],
  };
}

function convertBooleanTypeToJsonSchema(): JSONSchema6Definition {
  return {
    type: "boolean",
  };
}

function convertBooleanLiteralTypeToJsonSchema(
  t: Type<ts.Type>
): JSONSchema6Definition {
  return {
    type: "boolean",
    enum: [t.getText() === "true"],
  };
}

function convertStringTypeToJsonSchema(): JSONSchema6Definition {
  return {
    type: "string",
  };
}

function convertStringLiteralTypeToJsonSchema(
  t: Type<ts.Type>
): JSONSchema6Definition {
  return {
    type: "string",
    enum: [t.getLiteralValue() as string],
  };
}

function convertArrayTypeToJsonSchema(
  t: Type<ts.Type>,
  path: string[],
  visitedTypes: { type: Type<ts.Type>; path: string[] }[],
  fileData: FileData
): JSONSchema6Definition {
  const arrayElementType = t.getArrayElementType();
  return {
    type: "array",
    items:
      arrayElementType &&
      convertTypeToJsonSchema(
        arrayElementType,
        fileData,
        [...path, "items"],
        visitedTypes
      ),
  };
}

function convertTupleTypeToJsonSchema(
  t: Type<ts.Type>,
  path: string[],
  visitedTypes: { type: Type<ts.Type>; path: string[] }[],
  fileData: FileData
): JSONSchema6Definition {
  return {
    type: "array",
    items: t
      .getTupleElements()
      .map((subType, index) =>
        convertTypeToJsonSchema(
          subType,
          fileData,
          [...path, "items", index.toString()],
          visitedTypes
        )
      ),
  };
}

function extractJSdocProperties(s: TSSymbol): JSDocProperties {
  const description = s.compilerSymbol
    .getDocumentationComment(undefined)
    .map((c) => c.text)
    .join("\n");
  return {
    ...(description !== "" ? { description } : {}),
    ...s.getJsDocTags().reduce((acc, tag) => {
      return {
        ...acc,
        [tag.getName()]: tryOrReturn(
          () =>
            JSON.parse(
              tag
                .getText()
                .map((t) => t.text)
                .join("")
            ),
          undefined
        ),
      };
    }, {}),
  };
}

function convertObjectTypeToJsonSchema(
  t: Type<ts.Type>,
  path: string[],
  visitedTypes: { type: Type<ts.Type>; path: string[] }[],
  fileData: FileData
): JSONSchema6Definition {
  // If the type has been already visited then we're in a recursion
  // so we simply make a ref to that type
  const visitedType = visitedTypes.find((vt) => vt.type === t);
  if (visitedType) {
    return {
      $ref: `#/${visitedType.path.join("/")}`,
    };
  }

  const updatedVisitedTypes = [
    ...visitedTypes,
    {
      type: t,
      path,
    },
  ];

  const required: string[] = [];
  const properties = t
    .getProperties()
    .reduce((acc: Record<string, JSONSchema6Definition>, property) => {
      const jsDocProps = extractJSdocProperties(property);
      if (Object.keys(jsDocProps).includes("ignore")) {
        return acc;
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      let type = property.getDeclarations()[0]!.getType();
      if (type.isNullable()) {
        type = type.getNonNullableType();
      } else {
        required.push(property.getName());
      }
      let schema: JSONSchema6Definition;
      if (jsDocProps.type) {
        schema = jsDocProps;
      } else {
        const convertedSchema = convertTypeToJsonSchema(
          type,
          getFileData(property),
          [...path, "properties", property.getName()],
          updatedVisitedTypes
        );
        schema = {
          ...jsDocProps,
          ...convertedSchema,
        };
      }
      return {
        ...acc,
        [property.getName()]: schema,
      };
    }, {});
  const additionalPropertiesType =
    t.getStringIndexType() || t.getNumberIndexType();
  return {
    type: "object",
    additionalProperties: additionalPropertiesType
      ? convertTypeToJsonSchema(
          additionalPropertiesType,
          fileData,
          [...path, "additionalProperties"],
          updatedVisitedTypes
        )
      : false,
    ...(required.length > 0 ? { required } : {}),
    ...(Object.keys(properties).length > 0 ? { properties } : {}),
  };
}

function convertEnumTypeToJsonSchema(t: Type<ts.Type>): JSONSchema6Definition {
  const symbol = t.getSymbolOrThrow();

  const values = symbol.getDeclarations().flatMap((n) => {
    return n
      .asKindOrThrow(ts.SyntaxKind.EnumDeclaration)
      .getMembers()
      .flatMap((m) => {
        const value = m.getValue();
        return [value as string | number];
      });
  });

  if (values.length === 0) {
    return {};
  }

  return {
    type: typeof values[0] === "number" ? "number" : "string",
    enum: values,
  };
}

function convertUnionTypeToJsonSchema(
  t: Type<ts.Type>,
  path: string[],
  visitedTypes: { type: Type<ts.Type>; path: string[] }[],
  fileData: FileData
): JSONSchema6Definition {
  const types = t.getUnionTypes();
  const stringsOnly = types.every((subType) => subType.isStringLiteral());

  // If we only have string literals then we can use an enum
  if (stringsOnly) {
    const values = new Set(
      types.map((subType) => subType.getLiteralValue() as string)
    );
    return {
      type: "string",
      enum: [...values],
    };
  }

  // If we only have a number literals then we can use an enum
  const numbersOnly = types.every((subType) => subType.isNumberLiteral());
  if (numbersOnly) {
    const values = new Set(
      types.map((subType) => subType.getLiteralValue() as number)
    );
    return {
      type: "number",
      enum: [...values],
    };
  }

  // If we have mixed types

  // We seperate the booleans literals from the rest
  // because if we have different boolean values we want
  // only one "boolean" type in the schema instead of several ones
  // with different enum values
  const { booleanTypes, otherTypes } = t.getUnionTypes().reduce(
    (acc, type) => {
      const bucket = type.isBooleanLiteral() ? "booleanTypes" : "otherTypes";
      acc[bucket].push(type);
      return acc;
    },
    {
      booleanTypes: [] as Type<ts.Type>[],
      otherTypes: [] as Type<ts.Type>[],
    }
  );

  const anyOf = [
    ...otherTypes.map((subType, index) => {
      return convertTypeToJsonSchema(
        subType,
        fileData,
        [...path, "anyOf", index.toString()],
        visitedTypes
      );
    }),
  ];

  // We check if we have different boolean values
  const hasMixedBooleans = booleanTypes.some((t, index) => {
    const next = booleanTypes[(index + 1) % booleanTypes.length];
    return t.getText() !== next.getText();
  });

  if (booleanTypes.length > 0) {
    anyOf.push({
      type: "boolean",
      ...(hasMixedBooleans
        ? {}
        : { enum: [booleanTypes[0].getText() === "true"] }),
    });
  }

  return { anyOf };
}

function convertIntersectionTypeToJsonSchema(
  t: Type<ts.Type>,
  path: string[],
  visitedTypes: { type: Type<ts.Type>; path: string[] }[],
  fileData: FileData
): JSONSchema6Definition {
  const types = t.getIntersectionTypes();
  return types.reduce(
    (acc: JSONSchema6, subType) => {
      const schema = convertTypeToJsonSchema(
        subType,
        fileData,
        path,
        visitedTypes
      );

      const required = [...(acc.required ?? []), ...(schema.required ?? [])];
      const properties = {
        ...acc.properties,
        ...schema.properties,
      };
      const additionalProperties = schema.additionalProperties;

      return {
        ...acc,
        ...(additionalProperties ? { additionalProperties } : {}),
        ...(required.length > 0 ? { required } : {}),
        ...(Object.keys(properties).length > 0 ? { properties } : {}),
      };
    },
    { type: "object", additionalProperties: false }
  );
}

function convertNullTypeToJsonSchema(): JSONSchema6Definition {
  return {
    type: "null",
  };
}

function convertAnyTypeToJsonSchema(): JSONSchema6Definition {
  return {};
}

const CONVERTERS: [
  (t: Type<ts.Type>) => boolean,
  (
    t: Type<ts.Type>,
    path: string[],
    visitedTypes: { type: Type<ts.Type>; path: string[] }[],
    fileData: FileData
  ) => JSONSchema6Definition
][] = [
  [(t) => t.isNumber(), convertNumberTypeToJsonSchema],
  [(t) => t.isNumberLiteral(), convertNumberLiteralTypeToJsonSchema],
  [(t) => t.isBoolean(), convertBooleanTypeToJsonSchema],
  [(t) => t.isBooleanLiteral(), convertBooleanLiteralTypeToJsonSchema],
  [(t) => t.isString(), convertStringTypeToJsonSchema],
  [(t) => t.isStringLiteral(), convertStringLiteralTypeToJsonSchema],
  [(t) => t.isArray(), convertArrayTypeToJsonSchema],
  [(t) => t.isTuple(), convertTupleTypeToJsonSchema],
  [(t) => t.isObject(), convertObjectTypeToJsonSchema],
  [(t) => t.isEnum(), convertEnumTypeToJsonSchema],
  [(t) => t.isUnion(), convertUnionTypeToJsonSchema],
  [(t) => t.isIntersection(), convertIntersectionTypeToJsonSchema],
  [
    (t) => t.isUndefined() || t.isNull() || t.getText() === "void",
    convertNullTypeToJsonSchema,
  ],
  [(t) => t.isUnknown() || t.isAny(), convertAnyTypeToJsonSchema],
];

/**
 * Convert a typescript type to JSON schema
 * @param type Typescript type
 * @returns JSON schema corresponding to the provided type
 */
export function convertTypeToJsonSchema(
  type: Type<ts.Type>,
  fileData: FileData,
  path: string[] = [],
  visitedTypes: { type: Type<ts.Type>; path: string[] }[] = []
): Exclude<JSONSchema6Definition, boolean> {
  const schema = CONVERTERS.find(([tester]) => tester(type))?.[1](
    type,
    path,
    visitedTypes,
    fileData
  );

  if (schema === undefined || typeof schema === "boolean") {
    throw new TypeNotConvertibleError(
      type,
      fileData,
      'Type is not supported. Please check that it does not evaluate to "never"'
    );
  }

  return schema;
}
