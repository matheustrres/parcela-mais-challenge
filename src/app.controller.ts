import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AppService } from '@/app.service';

import { SwaggerRoute } from '@/shared/swagger';

@ApiTags('health')
@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	@Get('health')
	@SwaggerRoute({
		operation: 'Health check',
		responses: [{ status: 200, description: 'Application is healthy.' }],
	})
	getHealth(): { status: 'ok' } {
		return this.appService.getHealth();
	}
}
