import { JwtModuleOptions } from '@nestjs/jwt';

export const getJwtConfig = (): JwtModuleOptions => {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('Missing required env JWT_SECRET');
  }

  return {
    secret: jwtSecret,
    signOptions: {
      expiresIn: '1h',
    },
  };
};
