import { Injectable, BadRequestException } from '@nestjs/common';


import { HttpService } from '@nestjs/axios';
import { IntegrationService } from '../integSettings/integSettings.service';

@Injectable()
export class SurepassService {
  constructor(
    private readonly integrationService: IntegrationService,
    // private readonly http: HttpService,
  ) {}

//   async verifyPan(pan: string) {
 async verifyPan(pan: string) {
    const config = await this.integrationService.getIntegrationConfig(
      'surepass',
    );

    return config;

    // return this.http.axiosRef.post(
    //   `${config.base_url}/api/v1/pan/pan`,
    //   {
    //     id_number: pan,
    //   },
    //   {
    //     headers: {
    //       Authorization: `Bearer ${config.api_key}`,
    //     },
    //   },
    // );
  }
}