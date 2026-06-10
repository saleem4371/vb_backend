import { Controller, Get , UseGuards } from '@nestjs/common';
import { HomeService } from './home.service';

import { JwtAuthGuard } from '../../modules/auth/strategies/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';

@Controller('home')
export class HomeController {
  constructor(private homeService: HomeService) {}

  @Get()
  getHome() {
    return this.homeService.getHomePageData();
  } 
   @UseGuards(JwtAuthGuard)
  @Get('recent_views')
  getUserRecentViews(@CurrentUser() user: any) {
    const userId = user?.id;
    return this.homeService.getUserRecentViews(userId);
  }

   @UseGuards(JwtAuthGuard)
  @Get('vendor_category')
  vendor_category(@CurrentUser() user: any) {
    const userId = user?.id;
    return this.homeService.vendor_category(userId);
  }
}