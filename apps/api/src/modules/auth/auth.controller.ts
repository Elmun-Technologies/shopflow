import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { LoginDto, RefreshDto, RegisterDto } from "./auth.dto.js";
import { Public } from "../../common/auth/auth.decorators.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @HttpCode(200)
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @HttpCode(200)
  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto);
  }

  @Public()
  @HttpCode(204)
  @Post("logout")
  async logout(@Body() dto: RefreshDto) {
    await this.auth.revoke(dto.refreshToken);
  }
}
