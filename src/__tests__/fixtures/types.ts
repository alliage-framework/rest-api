/* eslint-disable */
type NumberType = number;

type NumberLiteralType = 42;

type StringType = string;

type StringLiteralType = "foo";

type BooleanType = boolean;

type BooleanLiteralType = true;

type ArrayType = number[];

type TupleType = [number, string, number];

type ObjectType = {
  numberProp: number;
  stringProp: string;
  booleanProp: boolean;
};

type ObjectTypeWithOptionalProps = {
  numberProp?: number;
  stringProp: string;
};

type StringIndexObjectType = {
  [key: string]: number;
};

type NumberIndexObjectType = {
  [key: number]: string;
};

type ObjectTypeWithComments = {
  /**
   * This is a number prop
   */
  numberProp: number;
};

type ObjectTypeWithMetadata = {
  /**
   * @minimum 3
   * @maximum 10
   */
  numberProp: number;

  /**
   * @pattern "^[a-z]+$"
   */
  stringProp: string;
};

type ObjectTypeWithInvalidMetadata = {
  /**
   * @minimum 3"¨*¨P
   * @maximum 10
   */
  numberProp: number;
};

type ObjectTypeWithIgnoredProp = {
  /**
   * @ignore
   */
  numberProp: number;
  stringProp: string;
};

type ObjectTypeWithOverriddenSchema = {
  /**
   * @type "string"
   * @pattern "[0-9]{2}-[0-9]{2}-[0-9]{4}"
   */
  date: Date;
};

type NestedObjectType = {
  nestedObjectProp: ObjectType;
  otherNestedObjectProp: {
    deeperNestedObjectProp: ObjectType;
  };
};

type Item = {
  name: string;
  children: Item[];
};

type ObjectWithRecursion = {
  recursiveProperty: Item;
};

type UnionType = number | string | boolean | ObjectType;

type StringUnionType = "foo" | "bar" | "baz";

type NumberUnionType = 1 | 2 | 3;

type SingleBooleanLiteralUnionType = true | string;

type BooleanUnionType = true | false | true | true | false;

type TrueBooleanLiteralUnionType = true | true | true;

type FalseBooleanLiteralUnionType = false | false | false;

type IntersectionTypePart1 = {
  [key: string]: string;
};
type IntersectionTypePart2 = {
  numberProp?: number;
};
type IntersectionTypePart3 = { stringProp: string };
type IntersectionTypePart4 = { booleanProp: boolean };

type IntersectionType = IntersectionTypePart1 &
  IntersectionTypePart2 &
  IntersectionTypePart3 &
  IntersectionTypePart4;

enum StringEnumType {
  FOO = "foo",
  BAR = "bar",
  BAZ = "baz",
}

enum NumberEnumType {
  ONE = 1,
  TWO = 2,
  THREE = 3,
}

enum EmptyEnumType {}

type NullType = null;

type UndefinedType = undefined;

type AnyType = any;

type UnknownType = unknown;

type InvalidType = string & number;
