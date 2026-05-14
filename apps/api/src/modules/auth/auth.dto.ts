import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  tenantName!: string;

  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/, {
    message: "tenantSlug must be 2-30 chars, lowercase letters, digits, hyphens; no leading/trailing hyphen",
  })
  tenantSlug!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  /** Optional — required when the user is part of multiple tenants. */
  @IsString()
  tenantSlug?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
