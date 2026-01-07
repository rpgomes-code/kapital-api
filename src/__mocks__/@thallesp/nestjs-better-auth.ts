// Mock for @thallesp/nestjs-better-auth
export const Session = () => () => {};
export const AllowAnonymous = () => () => {};

export class AuthModule {
  static forRoot() {
    return {
      module: AuthModule,
      providers: [],
      exports: [],
    };
  }
}

export interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}
