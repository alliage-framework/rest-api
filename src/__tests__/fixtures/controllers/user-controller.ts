import { Service } from "@alliage/service-loader";
import {
  AbstractController,
  Delete,
  Get,
  Post,
  AbstractRequest,
} from "@alliage/webserver";

import { createHttpError } from "../../../error";

interface User {
  id: number;
  email: string;
  password: string;
  username: string;
  birthDate: string;
}

type LoginPayload = Pick<User, "email" | "password">;

interface UserParams {
  id: number;
}

type UserPayload = Omit<User, "id">;

let idCount = 0;
const users: User[] = [];

@Service("user_controller")
export default class UserController extends AbstractController {
  @Post("/api/login")
  public async login(request: AbstractRequest<unknown, unknown, LoginPayload>) {
    const { email, password } = request.getBody();

    if (email !== "admin@acme.com" || password !== "qwerty") {
      /**
       * Error raised when the credentials are incorrect
       */
      throw createHttpError(401, {
        message: "Wrong credentials",
      });
    }

    return {
      token: `ACCESS_TOKEN`,
    };
  }

  /**
   * @defaultStatusCode 201
   */
  @Post("/api/users/create")
  public async createUser(
    request: AbstractRequest<unknown, unknown, UserPayload>
  ) {
    const payload = request.getBody();
    if (users.find(({ email }) => email === payload.email)) {
      throw createHttpError(400, {
        email: "This email already exists.",
      });
    }

    const newUser = {
      id: idCount,
      ...payload,
    };

    users.push(newUser);
    idCount++;

    return newUser;
  }

  @Get("/api/users/:id")
  public async getUser(request: AbstractRequest<UserParams, unknown>) {
    const { id } = request.getParams();
    const user = users.find((u) => id === u.id);
    if (!user) {
      /**
       * Error returned if the user
       * does not exist
       */
      throw createHttpError(404, {
        message: "User not found",
      });
    }
    return user;
  }

  /**
   * @defaultStatusCode 204
   */
  @Delete("/api/users/:id")
  public async deleteUser(request: AbstractRequest<UserParams, unknown>) {
    const { id } = request.getParams();
    const index = users.findIndex((u) => id === u.id);

    if (index === -1) {
      throw createHttpError(404, {
        message: "User not found",
      });
    }

    users.splice(index, 1);

    return { success: true };
  }

  @Get("/api/users")
  public async listUsers() {
    return users;
  }
}
