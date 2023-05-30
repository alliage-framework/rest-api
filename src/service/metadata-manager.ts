import path from "path";
import fs from "fs/promises";

import { parse } from "comment-parser";
import { pathToRegexp } from "path-to-regexp";
import {
  ClassDeclaration,
  Decorator,
  DefinitionInfo,
  LanguageService,
  MethodDeclaration,
  Node,
  Project,
  SourceFile,
  SyntaxKind,
  ts,
} from "ts-morph";

import { convertTypeToJsonSchema, getFileData } from "../utils/json-schema";

const PATTERN_REGEXP = /^\/(.*)\/([dgimsuy]+)$/;

export type ControllerMetadata = Exclude<
  ReturnType<typeof getControllerMetadata>,
  undefined
>;

export type ActionMetadata = Omit<
  ControllerMetadata["actions"][0],
  "routes"
> & {
  controllerName?: string;
};
export interface Metadata {
  [method: string]: {
    pattern: string;
    path: string;
    actionMetadata: ActionMetadata;
  }[];
}
export class MetadataManager {
  private metadata?: Metadata;

  constructor(
    private env: string,
    private sources: string[],
    private metadataPath: string,
    private disableMetadataGeneration: boolean,
    private tsConfigPath: string = "./tsconfig.json"
  ) {}

  /**
   * Loads metadata in memory by reading the file located
   * at `metadataPath`
   */
  async loadMetadata() {
    /**
     * To avoid the developer having to do it manually while developping
     * we trigger the generation of the metadata before loading them
     */
    if (this.env === "development" && !this.disableMetadataGeneration) {
      await this.generateMetadata();
      return;
    }
    this.metadata = JSON.parse(
      await fs.readFile(this.metadataPath, { encoding: "utf-8" })
    );
  }

  /**
   * Generates metadata from typescript files included in
   * `sources` and writes them in the file located at
   * `metadataPath`
   */
  async generateMetadata() {
    const project = new Project({
      tsConfigFilePath: path.resolve(this.tsConfigPath),
    });

    const files = project.getSourceFiles(this.sources);
    this.metadata = files.reduce((m: Metadata, file) => {
      const cm = getControllerMetadata(file);
      if (!cm) {
        return m;
      }
      cm.actions.forEach(({ routes, ...action }) => {
        routes.forEach((route) => {
          m[route.method] = m[route.method] ?? [];
          m[route.method].push({
            pattern: pathToRegexp(route.path).toString(),
            path: route.path,
            actionMetadata: {
              controllerName: cm.name,
              ...action,
            },
          });
        });
      });
      return m;
    }, {});

    await fs.writeFile(this.metadataPath, JSON.stringify(this.metadata));
  }

  /**
   * Finds the metadata corresponding to a given `method`
   * and a given `path`
   * @param method HTTP verb
   * @param path Path of the request
   */
  findMetadata(method: string, path: string): ActionMetadata | undefined {
    if (!this.metadata) {
      throw new Error("Controllers metadata is not loaded");
    }

    return this.metadata[method.toLowerCase()]?.find((m) => {
      const match = PATTERN_REGEXP.exec(m.pattern);
      if (!match) {
        return false;
      }
      const [, pattern, flags] = match;
      return RegExp(pattern, flags).test(path);
    })?.actionMetadata;
  }

  /**
   * Returns the controllers metadata
   * @returns metadata
   */
  getMetadata() {
    if (!this.metadata) {
      throw new Error("Controllers metadata is not loaded");
    }
    return this.metadata;
  }
}

/* istanbul ignore next */
const ALLIAGE_WEB_MODULE_PATH =
  process.env.__ALLIAGE_WEB_MODULE_PATH__ ??
  path.dirname(require.resolve("@alliage/webserver"));
/* istanbul ignore next */
const ALLIAGE_REST_API_MODULE_PATH =
  process.env.__ALLIAGE_REST_API_MODULE_PATH__ ??
  path.dirname(require.resolve("@alliage/rest-api"));

function PREPEND_PATTERN(prefix: string, pattern: RegExp) {
  return new RegExp(`${prefix}${pattern.source}`, pattern.flags);
}

function getRootClass(
  cd: ClassDeclaration,
  languageService: LanguageService
): ClassDeclaration {
  // Get the "extends" expression
  const ce = cd.getExtends();
  if (!ce) {
    return cd;
  }

  // Get the symbol and the definition of that "extends" expression
  let defs: DefinitionInfo<ts.DefinitionInfo>[] = [];
  try {
    defs = languageService.getDefinitions(ce);
  } catch {
    return cd;
  }
  if (defs.length === 0) {
    return cd;
  }
  const ceSymbol = ce.getType().getSymbolOrThrow();

  // Find the class declaration corresponding to that symbol
  const parentClass = defs[0].getSourceFile().getClass(ceSymbol.getName());
  if (!parentClass) {
    return cd;
  }

  return getRootClass(parentClass, languageService);
}

const ABSTRACT_CONTROLLER_NAME = "AbstractController";
const ABSTRACT_CONTROLLER_PATH_REGEXP = PREPEND_PATTERN(
  ALLIAGE_WEB_MODULE_PATH,
  /\/controller\/index(\.d)?\.ts$/
);

function isAbstractController(classDecl: ClassDeclaration) {
  return (
    classDecl.getName() === ABSTRACT_CONTROLLER_NAME &&
    ABSTRACT_CONTROLLER_PATH_REGEXP.test(
      classDecl.getSourceFile().getFilePath()
    )
  );
}

const ABSTRACT_REQUEST_NAME = "AbstractRequest";
const ABSTRACT_REQUEST_PATH_REGEXP = PREPEND_PATTERN(
  ALLIAGE_WEB_MODULE_PATH,
  /\/network\/request(\.d)?\.ts$/
);

function isAbstractRequest(node: Node<ts.Node>) {
  const symbol = node.getType().getSymbolOrThrow();
  return symbol.getDeclarations().some((decl) => {
    const classDecl = decl.asKind(ts.SyntaxKind.ClassDeclaration);
    return (
      classDecl &&
      classDecl.getName() === ABSTRACT_REQUEST_NAME &&
      ABSTRACT_REQUEST_PATH_REGEXP.test(classDecl.getSourceFile().getFilePath())
    );
  });
}

const DECORATORS_PATH_REGEXP = PREPEND_PATTERN(
  ALLIAGE_WEB_MODULE_PATH,
  /\/controller\/decorations(\.d)?\.ts$/
);
const ALLOWED_DECORATORS_ARGUMENT_KINDS = [
  SyntaxKind.StringLiteral,
  SyntaxKind.NoSubstitutionTemplateLiteral,
];

function getActionDecoratorMetadata(decorator: Decorator) {
  const callExpression = decorator.getCallExpressionOrThrow();

  const originalDef = callExpression
    .getExpression()
    .asKindOrThrow(ts.SyntaxKind.Identifier)
    .getDefinitions()
    .find((def) => {
      return DECORATORS_PATH_REGEXP.test(def.getSourceFile().getFilePath());
    });

  const path = callExpression.getArguments()[0];

  return (
    originalDef &&
    path &&
    // We check if the first argument is a non-dynamic string
    ALLOWED_DECORATORS_ARGUMENT_KINDS.includes(path.getKind()) && {
      // We get the original name of the decorator
      method: originalDef.getName().toLowerCase(),
      path: eval(path.getText()),
    }
  );
}

const HTTP_ERROR_NAME = "HttpError";
const HTTP_ERROR_PATH_REGEXP = PREPEND_PATTERN(
  ALLIAGE_REST_API_MODULE_PATH,
  /\/error(\.d)?\.ts$/
);
function getActionErrorsMetadata(
  methodDecl: MethodDeclaration,
  languageService: LanguageService
) {
  return methodDecl
    .getBodyOrThrow()
    .getDescendantsOfKind(ts.SyntaxKind.ThrowStatement)
    .flatMap((throwStatement) => {
      const comments = throwStatement.getLeadingCommentRanges();
      const doc =
        comments.length > 0
          ? parse(comments[comments.length - 1].getText())
          : undefined;
      const symbol = throwStatement.getExpression().getType().getSymbol();

      if (!symbol) {
        return [];
      }

      return symbol.getDeclarations().flatMap((d) => {
        const cd = d.asKind(ts.SyntaxKind.ClassDeclaration);
        if (!cd) {
          // Is not a class
          return [];
        }

        const rcd = getRootClass(cd, languageService);

        if (
          rcd.getName() !== HTTP_ERROR_NAME ||
          !HTTP_ERROR_PATH_REGEXP.test(rcd.getSourceFile().getFilePath())
        ) {
          // Is not an HttpError
          return [];
        }

        // We get the type provided to the generic class HttpError
        const [codeType, payloadType] = throwStatement
          .getExpression()
          .getType()
          .getTypeArguments();

        return [
          {
            description: doc?.map(({ description }) => description).join("\n"),
            code: codeType.getLiteralValue()?.toString() ?? "500",
            payloadType,
          },
        ];
      });
    });
}

function getActionDefaultStatusCode(methodDecl: MethodDeclaration) {
  const tags = methodDecl.getSymbolOrThrow().getJsDocTags();
  const scTag = tags.find((t) => t.getName() === "defaultStatusCode");

  let statusCode = 200;
  if (scTag) {
    const code = parseInt(
      scTag
        .getText()
        .map((t) => t.text)
        .join(""),
      10
    );
    statusCode = !isNaN(code) ? code : 200;
  }
  return statusCode;
}

function getActionValidateInputFlag(methodDecl: MethodDeclaration) {
  const tags = methodDecl.getSymbolOrThrow().getJsDocTags();
  const viTag = tags.find((t) => t.getName() === "validateInput");

  return viTag
    ?.getText()
    .map((t) => t.text)
    .join("") === "false"
    ? false
    : true;
}

function getActionValidateOutputFlag(methodDecl: MethodDeclaration) {
  const tags = methodDecl.getSymbolOrThrow().getJsDocTags();
  const viTag = tags.find((t) => t.getName() === "validateOutput");

  return viTag
    ?.getText()
    .map((t) => t.text)
    .join("") === "false"
    ? false
    : true;
}

export function getControllerMetadata(file: SourceFile) {
  const languageService = file.getProject().getLanguageService();

  // Checks if we have a default export
  const classDecl = file
    .getDefaultExportSymbol()
    ?.getValueDeclaration()
    ?.asKind(ts.SyntaxKind.ClassDeclaration);

  if (!classDecl) {
    return undefined;
  }

  // Gets the root parent class
  const rootParentClass = getRootClass(classDecl, languageService);

  // Checks if the classDecl extends the AbstractController
  if (rootParentClass === classDecl || !isAbstractController(rootParentClass)) {
    return undefined;
  }

  // Gets all the controller's actions with their routes
  const actions = classDecl.getMethods().flatMap((methodDecl) => {
    const params = methodDecl.getParameters();
    const paramDeclaration = params[0];

    const routes = methodDecl.getDecorators().flatMap((decorator) => {
      const data = getActionDecoratorMetadata(decorator);
      return data ? [data] : [];
    });

    // If no route is assigned to the controller
    if (routes.length === 0) {
      return [];
    }

    const [paramsType, queryType, bodyType] =
      params.length > 0 && isAbstractRequest(paramDeclaration)
        ? paramDeclaration.getType().getTypeArguments()
        : [null, null, null];

    const returnType = methodDecl.getReturnType();

    const errors = getActionErrorsMetadata(methodDecl, languageService);

    const defaultStatusCode = getActionDefaultStatusCode(methodDecl);
    const validateInput = getActionValidateInputFlag(methodDecl);
    const validateOutput = getActionValidateOutputFlag(methodDecl);

    return [
      {
        name: methodDecl.getName(),
        defaultStatusCode,
        validateInput,
        validateOutput,
        routes,
        paramsType: paramsType
          ? convertTypeToJsonSchema(
              paramsType,
              getFileData(paramDeclaration.getSymbolOrThrow())
            )
          : {},
        queryType: queryType
          ? convertTypeToJsonSchema(
              queryType,
              getFileData(paramDeclaration.getSymbolOrThrow())
            )
          : {},
        bodyType: bodyType
          ? convertTypeToJsonSchema(
              bodyType,
              getFileData(paramDeclaration.getSymbolOrThrow())
            )
          : {},
        returnType:
          returnType.getSymbolOrThrow().getName() === "Promise"
            ? convertTypeToJsonSchema(
                methodDecl.getReturnType().getTypeArguments()[0],
                getFileData(methodDecl.getSymbolOrThrow())
              )
            : {},
        errors: errors.map(({ payloadType, ...e }) => ({
          ...e,
          payloadType: convertTypeToJsonSchema(
            payloadType,
            getFileData(methodDecl.getSymbolOrThrow())
          ),
        })),
      },
    ];
  });

  return {
    name: classDecl.getName(),
    actions,
  };
}
