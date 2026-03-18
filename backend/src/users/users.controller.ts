import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateDisplayNameDto } from './dtos/update-display-name.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@Req() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    return {
      id: user?.id,
      email: user?.email,
      displayName: user?.displayName,
    };
  }

  @Patch('me')
  async updateMe(@Req() req: any, @Body() dto: UpdateDisplayNameDto) {
    const updated = await this.usersService.updateDisplayName(req.user.userId, dto.displayName);
    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
    };
  }
}

